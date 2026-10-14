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
import {
  CALL_ALIVE_MS,
  CALL_SILENT_END_MS,
  callEvent,
  callTimedOut,
  newCall,
} from "../src/logic/callLogic.mjs";
import { MESSAGE_KINDS, emptyState, reduce } from "../src/logic/localState.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const at = (hour, minute = 0, second = 0) =>
  new Date(2026, 9, 14, hour, minute, second).getTime();

test("Tiếng nói: mảnh ngắn, xếp hàng theo số thứ tự, phát cách nhau", () => {
  assert.equal(CALL_FRAME_MS <= 1000, true, "mảnh ngắn để trễ thấp");
  const bytes = frameBytesFor(32000, CALL_FRAME_MS);
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
  for (let seq = 1; seq <= 12; seq++)
    long = pushFrame(long, { seq, uri: `f${seq}` });
  assert.equal(queueSize(long), 8);
  assert.equal(long[0].seq, 5);
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
  // Dòng tin được vẽ trong components/MessageRow.tsx từ bản dọn dẹp 1.18.0.
  const row = read("src/components/MessageRow.tsx");
  assert.match(row, /message\.kind === "call"/);
  assert.match(row, /📞 \{message\.body\}/);
  const relay = read("src/services/relayProtocol.mjs");
  assert.match(relay, /"call",\n\s*\].includes\(message\.kind\)/);
});

test("Bỏ hình cầu tình yêu: trái tim ở giữa, vũ trụ trái tim quay quanh", () => {
  assert.equal(
    existsSync(new URL("../src/components/LoveBridgeArt.tsx", import.meta.url)),
    false,
    "hình cầu đã bỏ hẳn khỏi máy",
  );
  const heart = read("src/components/ThreeHeart.tsx");
  assert.match(heart, /ORBITS/, "có các quỹ đạo quay quanh trái tim giữa");
  assert.match(heart, /function Orbit/, "mỗi quỹ đạo mang các trái tim nhỏ");
  assert.match(heart, /useStars/, "nền vũ trụ có sao");
  assert.match(heart, /torusGeometry/, "quỹ đạo là vòng mảnh");
  assert.doesNotMatch(heart, /BridgeGroup/, "không còn vẽ cầu trong GL");
  assert.match(heart, /antialias: false/, "hạ tải đồ hoạ cho máy yếu");
  const home = read("src/screens/local/HomeLocal.tsx");
  assert.doesNotMatch(
    home,
    /LoveBridgeArt/,
    "màn hình chính không còn hình cầu",
  );
  assert.match(home, /<ThreeHeart reduced=\{reduced\} height=\{330\} \/>/);
  // Chỉ còn MỘT vùng WebGL trong cả app: hai canvas cùng lúc làm máy ảo đơ.
  const canvases = [
    "src/components/ThreeHeart.tsx",
    "src/screens/local/HomeLocal.tsx",
  ]
    .map((path) => (read(path).match(/<Canvas/g) ?? []).length)
    .reduce((total, count) => total + count, 0);
  assert.equal(canvases, 1, "chỉ một vùng WebGL");
});

test("Máy này tắt thì máy kia cũng tắt cuộc gọi", () => {
  assert.equal(
    CALL_SILENT_END_MS <= 6000,
    true,
    "chỉ chờ vài giây, không treo",
  );
  const t0 = at(15, 0);
  let call = newCall({ id: "c9", role: "caller", name: "Ngọc", at: t0 });
  call = callEvent(call, { type: "accept" }, t0);
  assert.equal(callTimedOut(call, t0 + CALL_SILENT_END_MS - 100), false);
  assert.equal(callTimedOut(call, t0 + CALL_SILENT_END_MS + 100), true);
  call = callEvent(call, { type: "alive" }, t0 + 3000);
  assert.equal(
    callTimedOut(call, t0 + 4000),
    false,
    "có nhịp thì tiếp tục gọi",
  );
  const lost = callEvent(call, { type: "lost" }, t0 + 4000);
  assert.equal(lost.phase, "ended");
  assert.equal(lost.reason, "Người thương đã kết thúc cuộc gọi");
  const app = read("App.tsx");
  assert.match(app, /callTimedOut\(/, "mỗi giây kiểm tra nhịp sống");
  assert.match(app, /event: "alive"/, "hai bên gửi nhịp còn sống");
  assert.match(
    app,
    /\[250, 500\]\.forEach/,
    "tín hiệu kết thúc gửi lại để không mất gói",
  );
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
  assert.match(
    read("src/components/MessageRow.tsx"),
    /export const MessageRow = React\.memo/,
    "mỗi dòng tin vẽ riêng (đã tách sang components/MessageRow.tsx)",
  );
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

test("Bỏ tab Cảm xúc khỏi chế độ trên máy", () => {
  const app = read("App.tsx");
  // `localTabs` vẫn nằm ở App.tsx; bảng tab của chế độ đồng bộ đã chuyển sang
  // src/screens/CloudApp.tsx từ bản dọn dẹp 1.18.0 nên chỉ cần cắt tới hết mảng.
  const tabs = app.slice(
    app.indexOf("const localTabs = ["),
    app.indexOf("];", app.indexOf("const localTabs = [")) + 2,
  );
  assert.doesNotMatch(tabs, /Cảm xúc/, "không còn mục Cảm xúc trên thanh dưới");
  assert.match(tabs, /Nhật ký/, "vẫn giữ Nhật ký");
  assert.match(tabs, /Cài đặt/, "vẫn giữ Cài đặt");
  assert.doesNotMatch(
    app,
    /<MoodLocal/,
    "không còn màn Cảm xúc của chế độ trên máy",
  );
  // Dọn rác 1.18.0: tệp màn hình Cảm xúc của chế độ trên máy đã bị xoá hẳn
  // (không còn ai import từ khi bỏ mục "Cảm xúc" khỏi thanh dưới).
  assert.equal(
    existsSync(new URL("../src/screens/local/MoodLocal.tsx", import.meta.url)),
    false,
    "không giữ lại tệp màn hình không còn đường tới",
  );
});
