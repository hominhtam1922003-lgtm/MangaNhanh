// Vòng 13: cầu tình yêu 3D, gọi nói liên tục, nhạc chuông trong máy, nhật ký
// cuộc gọi, tối ưu tốc độ nhắn tin và độ mượt của app.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

import {
  CALL_CLOSE_MS,
  CALL_FRAME_MS,
  CALL_PLAY_GAP_MS,
  callBarText,
  callLogText,
  frameBytesFor,
  frameIsSilent,
  frameUsable,
  isMissedCall,
  newAudioQueue,
  pushFrame,
  queueSize,
  takeFrame,
} from "../src/logic/callAudio.mjs";
import { callEvent, newCall } from "../src/logic/callLogic.mjs";
import { MESSAGE_KINDS, emptyState, reduce } from "../src/logic/localState.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const at = (hour, minute = 0, second = 0) =>
  new Date(2026, 9, 14, hour, minute, second).getTime();

test("Tiếng nói: mảnh ngắn, xếp hàng theo số thứ tự, phát cách nhau", () => {
  assert.equal(CALL_FRAME_MS <= 1000, true, "mảnh ngắn để trễ thấp");
  const bytes = frameBytesFor(24000, CALL_FRAME_MS);
  assert.equal(bytes > 1000 && bytes < 8000, true, `mảnh ~${bytes} byte`);
  let queue = newAudioQueue();
  queue = pushFrame(queue, { seq: 3, uri: "f3" });
  queue = pushFrame(queue, { seq: 1, uri: "f1" });
  queue = pushFrame(queue, { seq: 2, uri: "f2" });
  queue = pushFrame(queue, { seq: 2, uri: "f2" });
  assert.deepEqual(
    queue.map((f) => f.seq),
    [1, 2, 3],
    "sắp theo thứ tự và bỏ mảnh trùng",
  );
  const first = takeFrame(queue, at(15, 0), 0);
  assert.equal(first.frame.seq, 1);
  assert.equal(queueSize(first.queue), 2);
  // Chưa đủ khoảng cách thì chưa phát mảnh kế tiếp.
  const tooSoon = takeFrame(
    first.queue,
    at(15, 0, 0) + 1,
    at(15, 0),
    CALL_PLAY_GAP_MS,
  );
  assert.equal(tooSoon.frame, null);
  // Hàng quá dài thì bỏ mảnh cũ nhất để không trễ.
  let long = newAudioQueue();
  for (let seq = 1; seq <= 9; seq++)
    long = pushFrame(long, { seq, uri: `f${seq}` });
  assert.equal(queueSize(long), 6);
  assert.equal(long[0].seq, 4);
  assert.equal(frameUsable(2000, true), true);
  assert.equal(frameUsable(2000, false), false, "mic tắt thì không gửi tiếng");
  assert.equal(frameUsable(0, true), false);
  assert.equal(frameIsSilent(120), true);
});

test("Nhật ký cuộc gọi: hiện đã nói bao lâu và tự đóng cửa sổ", () => {
  const started = at(15, 0, 0);
  const outgoing = {
    ...newCall({ id: "c1", role: "caller", name: "Ngọc", at: started }),
    phase: "active",
    startedAt: started,
  };
  const ended = callEvent(outgoing, { type: "hangup" }, started + 83000);
  assert.equal(ended.phase, "ended");
  assert.equal(callLogText(ended, started + 83000), "Cuộc gọi đi · 01:23");
  const incoming = { ...ended, role: "callee" };
  assert.equal(callLogText(incoming, started + 83000), "Cuộc gọi đến · 01:23");
  const missed = callEvent(
    newCall({ id: "c2", role: "callee", name: "Ngọc" }),
    { type: "hangup" },
    started,
  );
  assert.equal(callLogText(missed, started), "Cuộc gọi nhỡ");
  assert.equal(isMissedCall(missed), true);
  assert.equal(isMissedCall(ended), false);
  assert.equal(callBarText(ended, started + 83000), "Cuộc gọi đã kết thúc");
  assert.equal(
    CALL_CLOSE_MS <= 3000,
    true,
    "kết thúc là tự đóng, không phải bấm",
  );
  const logic = read("src/logic/callLogic.mjs");
  assert.match(logic, /Người thương đang bận/);
});

test("Gọi nói liên tục: không còn giữ nút, có hồi chuông hai bên", () => {
  const call = read("src/screens/local/CallLocal.tsx");
  assert.doesNotMatch(call, /giữ nút để nói/i, "bỏ kiểu bộ đàm giữ để nói");
  assert.match(call, /Nói bình thường, không cần giữ nút/);
  assert.match(call, /ringback/, "bên gọi cũng nghe chuông");
  assert.match(call, /role === "callee"/);
  assert.match(call, /takeFrame/, "loa phát từng mảnh tiếng nhận được");
  assert.match(call, /onMinimize/, "thu nhỏ cửa sổ khi đang gọi");
  assert.match(call, /endedLog/, "hiện thông tin cuộc gọi đã kết thúc");
  const app = read("App.tsx");
  assert.match(app, /event: "audio"/, "gửi tiếng nói qua kênh ghép nối");
  assert.match(
    app,
    /writeBase64\(name, data\)/,
    "lưu tiếng nhận được rồi phát",
  );
  assert.match(app, /kind: "call", body/, "ghi nhật ký cuộc gọi vào đoạn chat");
  assert.match(app, /CALL_CLOSE_MS/, "tự đóng cửa sổ cuộc gọi");
  assert.match(app, /useAudioRecorder/);
  assert.equal(
    existsSync(new URL("../assets/ringtone.wav", import.meta.url)),
    true,
  );
  assert.equal(
    existsSync(new URL("../assets/ringback.wav", import.meta.url)),
    true,
  );
});

test("Nhạc chuông lấy từ thư viện nhạc trong máy", () => {
  let state = emptyState();
  assert.equal(state.settings.ringtone, "");
  state = reduce(state, {
    type: "settings.set",
    ringtone: "ringtone-custom.mp3",
    ringtoneName: "Nhạc của em.mp3",
  });
  assert.equal(state.settings.ringtone, "ringtone-custom.mp3");
  assert.equal(state.settings.ringtoneName, "Nhạc của em.mp3");
  const app = read("App.tsx");
  assert.match(app, /DocumentPicker\.getDocumentAsync/);
  assert.match(app, /type: "audio\/\*"/);
  const settings = read("src/screens/local/SettingsLocal.tsx");
  assert.match(settings, /Chọn nhạc trong máy/);
  assert.match(settings, /Nhạc mặc định/);
  const call = read("src/screens/local/CallLocal.tsx");
  assert.match(call, /ringtoneUri \? \{ uri: ringtoneUri \} : RINGTONE/);
});

test("Nhật ký cuộc gọi là một loại tin nhắn thật, hiện giữa khung chat", () => {
  assert.equal(MESSAGE_KINDS.includes("call"), true);
  let state = emptyState();
  state = reduce(state, {
    type: "message.add",
    kind: "call",
    body: "Cuộc gọi đi · 00:12",
  });
  const message = state.messages[state.messages.length - 1];
  assert.equal(message.kind, "call");
  assert.equal(message.body, "Cuộc gọi đi · 00:12");
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.match(chat, /message\.kind === "call"/);
  assert.match(chat, /📞 \{message\.body\}/);
  const relay = read("src/services/relayProtocol.mjs");
  assert.match(relay, /"call",\n\s*\].includes\(message\.kind\)/);
});

test("Cầu tình yêu 3D dùng chung một canvas với trái tim", () => {
  const bridge = read("src/components/LoveBridge.tsx");
  assert.match(bridge, /useFrame/, "hoạt ảnh chạy lại gần nhau");
  assert.match(bridge, /BRIDGE_CURVE/, "vòm cầu theo đường cong");
  assert.match(bridge, /Bride/, "cô dâu");
  assert.match(bridge, /Groom/, "chú rể");
  assert.match(bridge, /Magpie/, "chim Ô Thước");
  assert.match(bridge, /instancedMesh/, "ván cầu và cột dựng theo lô, nhẹ máy");
  assert.match(bridge, /octahedronGeometry/, "trái tim khi gặp nhau");
  assert.match(bridge, /palette/, "màu cầu lấy theo chủ đề đang dùng");
  // Chỉ MỘT vùng WebGL trên màn hình: hai canvas cùng lúc làm máy ảo đơ.
  assert.doesNotMatch(
    bridge,
    /<Canvas/,
    "cầu không được tự mở canvas riêng (gây dính màn hình trên máy ảo)",
  );
  const heart = read("src/components/ThreeHeart.tsx");
  assert.match(heart, /BridgeGroup/, "cầu nằm trong canvas của trái tim");
  assert.match(heart, /antialias: false/, "hạ tải đồ hoạ cho máy yếu");
  const home = read("src/screens/local/HomeLocal.tsx");
  assert.match(
    home,
    /<ThreeHeart reduced=\{reduced\} height=\{360\} withBridge \/>/,
  );
  assert.doesNotMatch(home, /LoveBridge/, "không còn canvas cầu riêng");
});

test("Nhắn tin nhanh hơn: không đẩy cả gói dữ liệu lớn vì một tin nhắn", () => {
  const app = read("App.tsx");
  assert.match(
    app,
    /const lite = payloadKey\(/,
    "có khoá so sánh phần không phải tin nhắn",
  );
  assert.match(app, /lastLiteRef/, "nhớ lần gửi trước");
  assert.match(app, /lastSlowRef/, "vẫn có nhịp an toàn 20 giây");
  assert.match(app, /persistSoon\(next\)/, "gộp ghi dữ liệu xuống máy");
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.match(chat, /const MessageRow = React\.memo/, "mỗi dòng tin vẽ riêng");
  assert.match(
    chat,
    /const renderItem = useCallback/,
    "danh sách không vẽ lại khi gõ",
  );
  assert.match(chat, /windowSize=\{9\}/, "chỉ vẽ các dòng đang thấy");
  assert.match(chat, /removeClippedSubviews/);
  const relay = read("src/services/relayProtocol.mjs");
  assert.match(relay, /\.slice\(0, 40\)/, "gói dữ liệu vẫn giới hạn số tin");
});
