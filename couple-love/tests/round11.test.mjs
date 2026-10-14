import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dueLoveNote,
  isQuietTime,
  minutesToNextLoveNote,
  unansweredMessage,
  waitingNotice,
  WAIT_NUDGE_TEXT,
} from "../src/logic/autoLove.mjs";
import {
  callClock,
  callEvent,
  callSeconds,
  newCall,
  ringTimedOut,
} from "../src/logic/callLogic.mjs";
import { LOVE_POEMS, loveNoteFor } from "../src/logic/lovelines.mjs";
import { emptyState, reduce } from "../src/logic/localState.mjs";
import {
  CHAT_PHOTO_LIMIT_BYTES,
  photoMessages,
} from "../src/services/momentTransfer.mjs";
import { buildRelayPayload } from "../src/services/relayProtocol.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const at = (hour, minute = 0, second = 0) =>
  new Date(2026, 9, 14, hour, minute, second).getTime();
const message = (id, authorId, createdAt) => ({ id, authorId, createdAt });

test("Nhắc trả lời: quá 3 phút thì nhắc, quá 1 tiếng nhắc thêm, đêm không nhắc", () => {
  const createdAt = new Date(at(15, 0) - 5 * 60 * 1000).toISOString();
  const messages = [message("m1", "partner", createdAt)];
  const first = waitingNotice({ messages, now: at(15, 5) });
  assert.equal(first?.stage, "3m");
  assert.equal(first?.body, WAIT_NUDGE_TEXT);
  // Nhắc lại đúng mức 3 phút cho cùng một tin thì không nhắc nữa.
  assert.equal(
    waitingNotice({
      messages,
      now: at(15, 6),
      lastNotice: { key: "m1", stage: "3m", at: at(15, 5) },
    }),
    null,
  );
  // Quá 1 tiếng: nhắc kèm giờ người thương nhắn.
  const later = waitingNotice({ messages, now: at(16, 30) });
  assert.equal(later?.stage, "1h");
  assert.match(later.body, /trả lời một câu/);
  // Trong vòng 1 tiếng kể từ lần nhắc 1h thì không nhắc lại.
  assert.equal(
    waitingNotice({
      messages,
      now: at(16, 50),
      lastNotice: { key: "m1", stage: "1h", at: at(16, 30) },
    }),
    null,
  );
  assert.equal(
    waitingNotice({
      messages,
      now: at(17, 40),
      lastNotice: { key: "m1", stage: "1h", at: at(16, 30) },
    })?.stage,
    "1h",
  );
  // Đã trả lời rồi thì thôi.
  assert.equal(
    unansweredMessage([
      message("m2", "me", new Date(at(15, 2)).toISOString()),
      ...messages,
    ]),
    null,
  );
  assert.equal(
    waitingNotice({
      messages: [
        message("m2", "me", new Date(at(15, 2)).toISOString()),
        ...messages,
      ],
      now: at(15, 30),
    }),
    null,
  );
  // Ban đêm 22:00–07:00 không nhắc; tắt trong Cài đặt cũng không nhắc.
  assert.equal(waitingNotice({ messages, now: at(23, 0) }), null);
  assert.equal(waitingNotice({ messages, now: at(5, 0) }), null);
  assert.equal(
    waitingNotice({ messages, now: at(15, 30), enabled: false }),
    null,
  );
  assert.equal(isQuietTime(at(22, 0)), true);
  assert.equal(isQuietTime(at(6, 59)), true);
  assert.equal(isQuietTime(at(7, 0)), false);
  assert.equal(isQuietTime(at(21, 59)), false);
});

test("Lời yêu tự động: đúng 2 tiếng một lần, chỉ trong khung thức", () => {
  assert.equal(dueLoveNote({ now: at(15, 0), lastAt: at(12, 55) }), true);
  assert.equal(
    dueLoveNote({ now: at(15, 0), lastAt: at(13, 30) }),
    false,
    "chưa đủ 2 tiếng thì chưa gửi",
  );
  assert.equal(dueLoveNote({ now: at(15, 0), lastAt: at(14, 30) }), false);
  assert.equal(dueLoveNote({ now: at(15, 0), lastAt: 0 }), false);
  assert.equal(dueLoveNote({ now: at(23, 0), lastAt: at(13, 0) }), false);
  assert.equal(
    dueLoveNote({ now: at(15, 0), lastAt: at(13, 0), enabled: false }),
    false,
  );
  assert.equal(
    minutesToNextLoveNote({ now: at(15, 0), lastAt: at(14, 0) }),
    60,
  );
  assert.equal(minutesToNextLoveNote({ now: at(15, 0), lastAt: at(12, 0) }), 0);
  // Lời nhắn tự động xen kẽ lời yêu và thơ, hai máy cùng mốc thì cùng câu.
  const note1 = loveNoteFor(new Date(at(13, 0)));
  assert.equal(typeof note1.text, "string");
  assert.equal(note1.text.length > 8, true);
  assert.deepEqual(note1, loveNoteFor(new Date(at(13, 0))));
  // Trong ngày có cả lời yêu lẫn thơ (hai loại xen kẽ nhau).
  const slots = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const poems = slots.filter(
    (slot) => loveNoteFor(new Date(at(slot, 0))).text.split("\n").length >= 4,
  );
  assert.equal(poems.length > 0, true, "phải có lúc gửi thơ");
  assert.equal(poems.length < slots.length, true, "phải có lúc gửi lời yêu");
  const poem = loveNoteFor(new Date(at(poems[0], 0)));
  assert.equal(poem.text.split("\n").length >= 4, true, "thơ phải đủ câu");
  assert.equal(LOVE_POEMS.length >= 10, true);
  for (const item of LOVE_POEMS) {
    assert.equal(item.lines.length >= 4, true);
    for (const line of item.lines) assert.equal(line.trim().length > 6, true);
  }
});

test("Cuộc gọi: đổ chuông → nghe → kết thúc, có thu nhỏ và tắt mic", () => {
  const call = newCall({ id: "c1", role: "callee", name: "Ngọc" });
  assert.equal(call.phase, "ringing");
  assert.equal(call.micOn, true);
  const active = callEvent(call, { type: "accept" }, at(15, 0));
  assert.equal(active.phase, "active");
  assert.equal(callSeconds(active, at(15, 1, 5)), 65);
  assert.equal(callClock(65), "01:05");
  assert.equal(callClock(0), "00:00");
  assert.equal(callEvent(active, { type: "mic", on: false }).micOn, false);
  assert.equal(
    callEvent(active, { type: "minimize", min: true }).minimized,
    true,
    "thu nhỏ cửa sổ khi đang gọi",
  );
  assert.equal(callEvent(active, { type: "hangup" }).phase, "ended");
  assert.equal(
    callEvent(active, { type: "hangup" }).reason,
    "Cuộc gọi đã kết thúc",
  );
  assert.equal(
    callEvent(call, { type: "reject" }).reason,
    "Người thương đang bận",
  );
  assert.equal(
    callEvent(call, { type: "timeout" }).reason,
    "Người thương không trả lời",
  );
  // Chuông reo quá 45 giây thì tự kết thúc, không reo mãi.
  assert.equal(ringTimedOut(call, call.at + 44000), false);
  assert.equal(ringTimedOut(call, call.at + 46000), true);
  assert.equal(ringTimedOut(active, call.at + 60000), false);
});

test("Tin nhắn mới: sticker, ảnh trong đoạn chat và vị trí đi qua kênh ghép nối", () => {
  let state = emptyState("2026-10-01T00:00:00.000Z");
  state = reduce(state, { type: "message.add", kind: "sticker", body: "🐻" });
  state = reduce(state, {
    type: "message.add",
    kind: "location",
    body: "10.36000, 106.36000",
    lat: 10.36,
    lng: 106.36,
  });
  state = reduce(state, {
    type: "message.add",
    kind: "photo",
    body: "cơm tối nè",
    photo: "chatpix-p1.jpg",
  });
  assert.deepEqual(
    state.messages.map((item) => item.kind),
    ["photo", "location", "sticker"],
  );
  assert.equal(state.messages[1].lat, 10.36);
  assert.throws(
    () =>
      reduce(state, {
        type: "message.add",
        kind: "photo",
        body: "không có tệp",
      }),
    /Ảnh chưa lưu xong/,
  );
  const payload = buildRelayPayload(state, 60000, "may-A");
  const sent = payload.messages.find((item) => item.kind === "location");
  assert.equal(sent.lat, 10.36);
  assert.equal(sent.lng, 106.36);
  assert.equal(
    payload.messages.find((item) => item.kind === "photo").hasPhoto,
    true,
  );
  assert.equal(
    payload.messages.find((item) => item.kind === "sticker").body,
    "🐻",
  );
  // Ảnh trong đoạn chat cũng bị cắt thành nhiều gói và giữ đúng mã tin.
  const packets = photoMessages({
    id: "p1",
    base64: Buffer.from("anh trong doan chat ".repeat(400), "utf8").toString(
      "base64",
    ),
    role: "chat",
    chatId: "p1",
  });
  assert.equal(packets.length > 1, true);
  assert.equal(packets[0].meta.role, "chat");
  assert.equal(packets[0].meta.chatId, "p1");
  assert.equal(CHAT_PHOTO_LIMIT_BYTES >= 100 * 1024, true);
  // Ảnh tới trước phần mô tả tin thì vẫn tạo tin, không mất ảnh.
  const late = reduce(state, {
    type: "message.photo",
    id: "p9",
    file: "chatpix-p9.jpg",
  });
  assert.equal(late.messages[0].id, "p9");
  assert.equal(late.messages[0].photo, "chatpix-p9.jpg");
  assert.equal(late.messages[0].authorId, "partner");
});

test("Đã xem: bật tắt được và tin của mình hiện “đã xem” khi máy kia báo", () => {
  let state = emptyState("2026-10-01T00:00:00.000Z");
  assert.equal(state.settings.readReceipts, true);
  assert.equal(state.settings.autoLove, true);
  assert.equal(state.settings.replyNudge, true);
  state = reduce(state, {
    type: "message.add",
    kind: "text",
    body: "ngủ ngon nhé",
  });
  const id = state.messages[0].id;
  state = reduce(state, { type: "message.seen", ids: [id] });
  assert.equal(Boolean(state.messages[0].readAt), true);
  state = reduce(state, {
    type: "settings.set",
    notify: true,
    relay: true,
    theme: "hong",
    readReceipts: false,
    autoLove: false,
  });
  assert.equal(state.settings.readReceipts, false);
  assert.equal(state.settings.autoLove, false);
  const kept = reduce(state, {
    type: "settings.set",
    notify: true,
    relay: true,
    theme: "tim",
  });
  assert.equal(
    kept.settings.readReceipts,
    false,
    "không truyền thì giữ nguyên",
  );
  assert.equal(state.autoLoveAt, 0);
  assert.equal(
    reduce(state, { type: "autoLove.sent", at: 1234 }).autoLoveAt,
    1234,
  );
  const app = read("App.tsx");
  assert.match(app, /chatRead/, "gửi báo đã xem qua kênh ghép nối");
  assert.match(app, /kind: "call"/, "có tín hiệu cuộc gọi");
  assert.match(app, /startCall/, "có hàm bắt đầu gọi");
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.doesNotMatch(chat, /inverted/, "bảng tin không dùng danh sách lật");
  assert.match(chat, /scrollToEnd/, "tin mới thì cuộn xuống cuối");
  assert.match(chat, /STICKER_PACKS/);
  assert.match(chat, /onSendLocation/);
  assert.match(chat, /onStartCall/);
  const callUi = read("src/screens/local/CallLocal.tsx");
  assert.match(callUi, /giữ nút/);
  assert.match(callUi, /Thu nhỏ/);
  assert.match(callUi, /Mic đang tắt/);
  assert.match(callUi, /ring\.wav/);
});
