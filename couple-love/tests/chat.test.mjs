import { test } from "node:test";

import { testRoom } from "./helpers/rooms.mjs";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Aedes } from "aedes";
import { WebSocketServer, createWebSocketStream, WebSocket } from "ws";
import { emptyState, reduce } from "../src/logic/localState.mjs";
import {
  buildRelayPayload,
  RelayClient,
} from "../src/services/relayProtocol.mjs";
import {
  PhotoAssembler,
  missingVoiceIds,
  photoMessages,
  WALLPAPER_LIMIT_BYTES,
} from "../src/services/momentTransfer.mjs";
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
// Máy chủ CI chạy nhiều bài song song nên chờ theo điều kiện thay vì chờ cứng.
async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await wait(100);
  }
  return false;
}
const phone = (name) => {
  let state = emptyState("2026-10-14T00:00:00.000Z");
  return reduce(state, {
    type: "profile.set",
    nickname: name,
    mood: "love",
    moodNote: "",
  });
};
test("Tin nhắn: gửi, nhận, đã đọc, chặn tin rỗng, không nhân đôi khi gửi lại", () => {
  let mine = phone("Minh");
  mine = reduce(mine, {
    type: "message.add",
    id: "t1",
    kind: "text",
    body: "  Nhớ em  ",
  });
  mine = reduce(mine, {
    type: "message.add",
    id: "v1",
    kind: "voice",
    audio: "voice-v1.m4a",
    durationMs: 3200,
  });
  assert.equal(mine.messages.length, 2);
  assert.equal(mine.messages[1].body, "Nhớ em", "tự cắt khoảng trắng");
  assert.equal(mine.messages[0].sentAt, null, "chưa gửi thì chưa có mốc gửi");
  mine = reduce(mine, { type: "message.sent", id: "v1" });
  assert.match(mine.messages[0].sentAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.throws(
    () => reduce(mine, { type: "message.add", kind: "text", body: "   " }),
    /còn trống/,
  );
  assert.throws(
    () => reduce(mine, { type: "message.add", kind: "voice", body: "x" }),
    /chưa ghi xong/,
  );
  assert.throws(
    () => reduce(mine, { type: "message.received", body: "x" }),
    /thiếu mã/,
  );
  // Máy kia: chỉ gửi tin của mình, người nhận thấy là tin của "người thương".
  let theirs = phone("Ngọc");
  theirs = reduce(theirs, {
    type: "message.add",
    id: "p1",
    kind: "emoji",
    body: "🥰",
  });
  const payload = buildRelayPayload(theirs, 60000, "may-B");
  assert.deepEqual(
    payload.messages.map((message) => [message.id, message.kind, message.body]),
    [["p1", "emoji", "🥰"]],
  );
  const merged = reduce(mine, { type: "partner.merge", state: payload });
  const incoming = merged.messages.find((message) => message.id === "p1");
  assert.equal(incoming.authorId, "partner");
  assert.equal(incoming.readAt, null);
  const read = reduce(merged, { type: "message.read" });
  assert.match(
    read.messages.find((message) => message.id === "p1").readAt,
    /^\d{4}-\d{2}-\d{2}T/,
  );
  assert.equal(
    read.messages.find((message) => message.id === "t1").readAt,
    null,
    "không đánh dấu đọc tin của mình",
  );
  // Gửi lại y nguyên: không nhân đôi, tin thoại đã có thì giữ tệp.
  const withAudio = reduce(read, {
    type: "message.audio",
    id: "p1",
    file: "voice-p1.m4a",
  });
  const again = reduce(withAudio, { type: "partner.merge", state: payload });
  assert.equal(
    again.messages.filter((message) => message.id === "p1").length,
    1,
  );
  assert.equal(
    again.messages.find((message) => message.id === "p1").audio,
    "voice-p1.m4a",
  );
  // Hủy ghép nối: bỏ tin của người thương, giữ tin của mình.
  const unlinked = reduce(again, { type: "partner.unlink" });
  assert.deepEqual(unlinked.messages.map((message) => message.id).sort(), [
    "t1",
    "v1",
  ]);
  assert.deepEqual(
    reduce(unlinked, { type: "message.remove", id: "t1" }).messages.map(
      (message) => message.id,
    ),
    ["v1"],
  );
});
test("Tin thoại: cắt gói, ghép lại đúng từng ký tự, xin gửi lại khi còn thiếu", () => {
  const base64 = Buffer.from(
    "giong noi cua nguoi thuong ".repeat(300),
    "utf8",
  ).toString("base64");
  const packets = photoMessages(
    {
      id: "v9",
      base64,
      role: "voice",
      voiceId: "v9",
      durationMs: 5400,
      nickname: "Ngọc",
    },
    3500,
  );
  assert.equal(
    packets.length > 1,
    true,
    "tin thoại dài phải bị cắt thành nhiều gói",
  );
  assert.equal(packets[0].meta.role, "voice");
  assert.equal(packets[0].meta.voiceId, "v9");
  assert.equal(packets[0].meta.durationMs, 5400);
  const assembler = new PhotoAssembler();
  let done = null;
  for (const packet of [...packets].reverse())
    done = assembler.add(packet) ?? done;
  assert.equal(done.base64, base64);
  assert.equal(done.meta.voiceId, "v9");
  assert.equal(
    base64.length < WALLPAPER_LIMIT_BYTES * 1.4,
    true,
    "tin thoại 30 giây vẫn gửi được",
  );
  const missing = missingVoiceIds(
    [
      { id: "v9", authorId: "partner", kind: "voice", audio: null },
      { id: "v9b", authorId: "partner", kind: "voice", audio: "voice-v9b.m4a" },
      { id: "v9c", authorId: "me", kind: "voice", audio: null },
      { id: "t9", authorId: "partner", kind: "text", audio: null },
    ],
    (message) => Boolean(message.audio && message.audio.startsWith("voice-")),
  );
  assert.deepEqual(
    missing,
    ["v9"],
    "chỉ xin lại tin thoại của người thương còn thiếu tệp",
  );
});
test("Broker MQTT thật: nhắn tin và tin thoại sang máy kia, xin gửi lại cũng chạy", async () => {
  const broker = await Aedes.createBroker();
  const http = createServer();
  const sockets = new WebSocketServer({ server: http });
  sockets.on("connection", (socket) =>
    broker.handle(createWebSocketStream(socket)),
  );
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  const port = http.address().port;
  const realWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = WebSocket;
  const clients = [];
  try {
    const room = testRoom("246810");
    let received = null;
    let audio = null;
    let asked = null;
    const assembler = new PhotoAssembler();
    const mayA = new RelayClient({
      room,
      brokers: [`ws://127.0.0.1:${port}/`],
      deviceId: "may-A",
      onPayload: () => {},
      onStatus: () => {},
      onLog: () => {},
      onMessage: (message) => {
        if (message.kind === "photoRequest") asked = message.ids;
      },
    });
    const mayB = new RelayClient({
      room,
      brokers: [`ws://127.0.0.1:${port}/`],
      deviceId: "may-B",
      onPayload: () => {},
      onStatus: () => {},
      onLog: () => {},
      onMessage: (message) => {
        if (message.kind === "chat") received = message.message;
        if (message.kind === "photo") {
          const done = assembler.add(message);
          if (done) audio = done;
        }
      },
    });
    clients.push(mayA, mayB);
    mayA.start();
    await waitFor(() => mayA.connected, 20000);
    mayB.start();
    await waitFor(
      () => mayB.connected && mayB.slots.every((slot) => slot.subscribed),
      20000,
    );
    assert.equal(mayA.connected && mayB.connected, true);
    // A nhắn một câu như giao diện thật gửi đi.
    assert.equal(
      mayA.publish({
        kind: "chat",
        name: "Minh",
        message: {
          id: "t1",
          kind: "text",
          body: "Nhớ em nhiều lắm 💌",
          createdAt: "2026-10-14T09:30:00.000Z",
          durationMs: 0,
        },
      }),
      true,
    );
    for (let attempt = 0; attempt < 100 && !received; attempt++) {
      await wait(200);
      if (!received && attempt > 0)
        mayA.publish({
          kind: "chat",
          name: "Minh",
          message: {
            id: "t1",
            kind: "text",
            body: "Nhớ em nhiều lắm 💌",
            createdAt: "2026-10-14T09:30:00.000Z",
            durationMs: 0,
          },
        });
    }
    assert.deepEqual(
      [received.id, received.body, received.kind],
      ["t1", "Nhớ em nhiều lắm 💌", "text"],
      "máy B nhận đúng tin nhắn kèm emoji",
    );
    // A gửi tin thoại: một gói mô tả + các gói âm thanh.
    const base64 = Buffer.from("a".repeat(9000), "utf8").toString("base64");
    const packets = photoMessages({
      id: "v2",
      base64,
      role: "voice",
      voiceId: "v2",
      durationMs: 6000,
    });
    assert.equal(
      mayA.publish({
        kind: "chat",
        name: "Minh",
        message: {
          id: "v2",
          kind: "voice",
          body: "",
          durationMs: 6000,
          hasAudio: true,
          createdAt: new Date().toISOString(),
        },
      }),
      true,
    );
    for (const packet of packets) {
      assert.equal(mayA.publish(packet), true);
      await wait(20);
    }
    for (let attempt = 0; attempt < 100 && !audio; attempt++) await wait(200);
    assert.ok(audio, "máy B phải ghép xong tin thoại");
    assert.equal(audio.meta.voiceId, "v2");
    assert.equal(audio.base64, base64);
    // B xin lại tin thoại thì lời xin phải tới được A (giao diện sẽ gửi lại).
    assert.equal(mayB.publish({ kind: "photoRequest", ids: ["v2"] }), true);
    for (let attempt = 0; attempt < 60 && !asked; attempt++) await wait(200);
    assert.deepEqual(asked, ["v2"]);
  } finally {
    for (const client of clients) client.stop();
    globalThis.WebSocket = realWebSocket;
    await new Promise((resolve) => sockets.close(resolve));
    await new Promise((resolve) => http.close(resolve));
    broker.close();
  }
});

test("Gói dữ liệu lớn vẫn giữ nhật ký của mình", () => {
  const messages = Array.from({ length: 60 }, (_, index) => ({
    id: "m" + index,
    authorId: index % 2 ? "me" : "partner",
    kind: "text",
    body: "Nhớ em nhiều lắm ".repeat(20),
    audio: null,
    durationMs: 0,
    createdAt: new Date(Date.now() - index * 1000).toISOString(),
  }));
  const diary = Array.from({ length: 30 }, (_, index) => ({
    id: "d" + index,
    authorId: "me",
    title: "Kỷ niệm " + index,
    body: "Hôm nay hai đứa đi chơi rất vui. ".repeat(40),
    image: "anh-" + index + ".jpg",
    createdAt: new Date(Date.now() - index * 60000).toISOString(),
    updatedAt: new Date(Date.now() - index * 60000).toISOString(),
  }));
  const state = {
    ...emptyState("2026-10-14T00:00:00.000Z"),
    me: {
      ...emptyState("2026-10-14T00:00:00.000Z").me,
      nickname: "Minh",
    },
    messages,
    diary,
    alerts: Array.from({ length: 80 }, (_, index) => ({
      id: "a" + index,
      key: "a" + index,
      title: "Nhắc nhẹ",
      body: "Uống nước nhé ".repeat(10),
      category: "love",
      createdAt: new Date().toISOString(),
      readAt: null,
    })),
  };
  const payload = buildRelayPayload(state, 60000, "may-A");
  assert.equal(JSON.stringify(payload).length <= 60000, true);
  assert.equal(payload.diary.length > 0, true);
  assert.equal(
    payload.diary.every((entry) => entry.authorId !== "partner"),
    true,
  );
});
