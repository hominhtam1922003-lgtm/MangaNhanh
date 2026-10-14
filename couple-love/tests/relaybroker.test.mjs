// Bài kiểm thử này dựng một broker MQTT thật (thư viện aedes) ngay trong máy,
// rồi cho hai RelayClient nói chuyện với nhau qua broker đó — đúng đường đi thật
// của app (WebSocket → MQTT CONNECT/SUBSCRIBE/PUBLISH), để chắc chắn gói tự viết
// được broker thật chấp nhận và hai máy cùng nhận dữ liệu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Aedes } from "aedes";
import { WebSocketServer, createWebSocketStream, WebSocket } from "ws";
import {
  RelayClient,
  buildRelayPayload,
  roomFromCode,
} from "../src/services/relayProtocol.mjs";
import {
  PhotoAssembler,
  photoMessages,
} from "../src/services/momentTransfer.mjs";
import { dateOnly } from "../src/logic/time.mjs";
import { emptyState, reduce } from "../src/logic/localState.mjs";
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const stateWith = (nickname, diaryTitle) => {
  let state = emptyState("2026-01-01T00:00:00.000Z");
  state = reduce(state, {
    type: "profile.set",
    nickname,
    mood: "love",
    moodNote: `nhớ ${nickname}`,
  });
  state = reduce(state, {
    type: "diary.add",
    title: diaryTitle,
    body: "ghi chú",
  });
  state = reduce(state, {
    type: "cycle.save",
    lastPeriod: "2026-01-01",
    cycleLength: 28,
    periodLength: 5,
  });
  return state;
};
test("Broker MQTT thật: hai máy nhập cùng mã 6 số thì cả hai cùng nhận dữ liệu", async () => {
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
    const code = "593184";
    const statusA = [];
    const statusB = [];
    const gotA = [];
    const gotB = [];
    const mayA = new RelayClient({
      room: roomFromCode(code),
      brokers: [`ws://127.0.0.1:${port}/`],
      deviceId: "may-A",
      onPayload: (payload) => gotA.push(payload),
      onStatus: (status) => statusA.push(status),
    });
    const mayB = new RelayClient({
      room: roomFromCode(code),
      brokers: [`ws://127.0.0.1:${port}/`],
      deviceId: "may-B",
      onPayload: (payload) => gotB.push(payload),
      onStatus: (status) => statusB.push(status),
    });
    clients.push(mayA, mayB);
    mayA.start();
    await wait(120);
    assert.equal(
      mayA.connected,
      true,
      "máy A nối được broker thật bằng gói CONNECT tự viết",
    );
    // Máy A ở một mình: bản tin của chính A (broker dội lại) không được coi là người thương.
    assert.equal(
      mayA.status.partnerOnline,
      false,
      "một máy không tự nhận mình là người thương",
    );
    assert.equal(gotA.length, 0, "không tự nhận bản tin của mình");
    mayB.start();
    await wait(400);
    assert.equal(mayB.connected, true, "máy B nối được broker thật");
    assert.equal(mayA.status.partnerOnline, true, "A thấy B vào phòng");
    assert.equal(mayB.status.partnerOnline, true, "B thấy A trong phòng");
    // Đúng cách App làm: khi thấy người thương trực tuyến thì gửi toàn bộ dữ liệu của mình.
    const stateA = stateWith("Minh", "Hẹn hò đầu tiên");
    const stateB = stateWith("Ngọc Ánh", "Đi Đà Lạt");
    assert.equal(
      mayA.publishState(buildRelayPayload(stateA, 60000, "may-A"), "Minh"),
      true,
    );
    assert.equal(
      mayB.publishState(buildRelayPayload(stateB, 60000, "may-B"), "Ngọc Ánh"),
      true,
    );
    await wait(250);
    assert.equal(gotA.length, 1, "A nhận đúng một gói của B");
    assert.equal(gotB.length, 1, "B nhận đúng một gói của A");
    assert.equal(gotA[0].from.nickname, "Ngọc Ánh");
    assert.equal(gotB[0].from.nickname, "Minh");
    let trenA = stateA;
    let trenB = stateB;
    for (const payload of gotA)
      trenA = reduce(trenA, { type: "partner.merge", state: payload });
    for (const payload of gotB)
      trenB = reduce(trenB, { type: "partner.merge", state: payload });
    assert.equal(
      trenA.partner.nickname,
      "Ngọc Ánh",
      "máy A nhận ghép nối với B",
    );
    assert.equal(trenB.partner.nickname, "Minh", "máy B nhận ghép nối với A");
    assert.equal(trenA.cycle.cycleLength, 28, "chu kỳ của B sang được A");
    assert.deepEqual(
      trenA.diary.map((entry) => entry.title).sort(),
      trenB.diary.map((entry) => entry.title).sort(),
      "hai máy giữ cùng danh sách kỷ niệm",
    );
    assert.equal(mayA.status.state, "online");
    assert.equal(mayB.status.state, "online");
    assert.equal(mayA.status.partnerName, "Ngọc Ánh");
    assert.equal(mayB.status.partnerName, "Minh");
    // Gửi lại y nguyên (như khi một bên bấm "Gửi lại toàn bộ dữ liệu ngay") không nhân đôi dữ liệu.
    mayB.publishState(buildRelayPayload(stateB, 60000, "may-B"), "Ngọc Ánh");
    await wait(200);
    let lai = trenA;
    for (const payload of gotA.slice(1))
      lai = reduce(lai, { type: "partner.merge", state: payload });
    assert.equal(
      lai.diary.length,
      trenA.diary.length,
      "gửi lại không nhân đôi kỷ niệm",
    );
    // Máy thứ ba nhập sai mã 6 số thì không thấy gì của hai bạn.
    const mayLa = new RelayClient({
      room: roomFromCode("000111"),
      brokers: [`ws://127.0.0.1:${port}/`],
      deviceId: "may-C",
      onPayload: () => {},
      onStatus: () => {},
    });
    clients.push(mayLa);
    mayLa.start();
    await wait(150);
    assert.equal(mayLa.connected, true);
    assert.equal(
      mayLa.status.partnerOnline,
      false,
      "nhập sai mã thì ở phòng khác, không thấy ai",
    );
    assert.equal(
      statusA.at(-1).partnerOnline,
      true,
      "hai bạn vẫn đang trực tuyến với nhau",
    );
  } finally {
    for (const client of clients) client.stop();
    globalThis.WebSocket = realWebSocket;
    await new Promise((resolve) => sockets.close(resolve));
    await new Promise((resolve) => http.close(resolve));
    broker.close();
  }
});

test("Broker MQTT thật: gửi ảnh khoảnh khắc từ máy A sang máy B rồi lưu lại", async () => {
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
    const room = roomFromCode("778811");
    const assembler = new PhotoAssembler();
    let received = null;
    const mayA = new RelayClient({
      room,
      brokers: [`ws://127.0.0.1:${port}/`],
      deviceId: "may-A",
      onPayload: () => {},
      onStatus: () => {},
      onLog: () => {},
    });
    const mayB = new RelayClient({
      room,
      brokers: [`ws://127.0.0.1:${port}/`],
      deviceId: "may-B",
      onPayload: () => {},
      onStatus: () => {},
      onLog: () => {},
      onMessage: (message) => {
        const done = assembler.add(message);
        if (done) received = done;
      },
    });
    clients.push(mayA, mayB);
    mayA.start();
    await wait(120);
    mayB.start();
    await wait(250);
    assert.equal(mayA.connected && mayB.connected, true);
    // Ảnh giả 12.000 ký tự base64 ≈ ảnh nén nhỏ thật.
    const base64 = Buffer.from("anh khoanh khac ".repeat(700), "utf8").toString(
      "base64",
    );
    const messages = photoMessages(
      {
        id: "moment-that-1",
        base64,
        caption: "Đà Lạt chiều mưa",
        createdAt: "2026-10-14T09:30:00.000Z",
        nickname: "Minh",
      },
      3500,
    );
    assert.equal(messages.length > 1, true, "ảnh phải bị cắt thành nhiều gói");
    for (const message of messages) {
      assert.equal(mayA.publish(message), true, "máy A gửi được từng gói ảnh");
      await wait(20);
    }
    for (let attempt = 0; attempt < 60 && !received; attempt++) await wait(100);
    assert.ok(received, "máy B phải ghép xong ảnh");
    assert.equal(received.id, "moment-that-1");
    assert.equal(received.base64, base64, "ảnh nhận được giống hệt ảnh gửi đi");
    assert.equal(received.meta.caption, "Đà Lạt chiều mưa");
    assert.equal(received.meta.nickname, "Minh");
    // Máy B xin lại ảnh còn thiếu thì lời xin phải tới được máy A, và khi app
    // gửi lại (đúng như App.tsx làm) thì máy B nhận đủ ảnh lần nữa.
    let asked = null;
    mayA.onMessage = (message) => {
      if (message.kind === "photoRequest") asked = message.ids;
    };
    assert.equal(
      mayB.publish({ kind: "photoRequest", ids: ["moment-that-1"] }),
      true,
    );
    for (let attempt = 0; attempt < 40 && !asked; attempt++) await wait(100);
    assert.deepEqual(
      asked,
      ["moment-that-1"],
      "máy A nhận được lời xin gửi lại",
    );
    const second = new PhotoAssembler();
    let again = null;
    mayB.onMessage = (message) => {
      const done = second.add(message);
      if (done) again = done;
    };
    for (const message of messages) {
      assert.equal(mayA.publish(message), true);
      await wait(20);
    }
    for (let attempt = 0; attempt < 60 && !again; attempt++) await wait(100);
    assert.ok(again, "máy B phải nhận lại được ảnh sau khi xin");
    assert.equal(again.base64, base64, "ảnh gửi lại vẫn đúng từng ký tự");
  } finally {
    for (const client of clients) client.stop();
    globalThis.WebSocket = realWebSocket;
    await new Promise((resolve) => sockets.close(resolve));
    await new Promise((resolve) => http.close(resolve));
    broker.close();
  }
});
