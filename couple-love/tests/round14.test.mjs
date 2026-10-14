// Vòng 14: bỏ hình cầu để trái tim ở chính giữa có vũ trụ trái tim quay quanh,
// và đưa cuộc gọi sang đường tiếng trực tiếp (WebRTC) cho liền mạch như gọi thường.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  RTC_DROP_MS,
  RTC_ICE_SERVERS,
  RTC_MEDIA,
  RTC_RETRY_SIGNAL_MS,
  RTC_SIGNAL_KEEP,
  RTC_SUBS,
  RTC_TRY_MS,
  hasSignal,
  isRtcPacket,
  rememberSignal,
  rtcPacket,
  rtcStateIsLive,
  rtcStateIsLost,
  rtcStatusText,
  rtcWaitingTooLong,
  signalFingerprint,
  signalId,
} from "../src/logic/rtcSignal.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Trái tim ở chính giữa, vũ trụ trái tim quay quanh", () => {
  const heart = read("src/components/ThreeHeart.tsx");
  // Ba quỹ đạo nghiêng khác nhau, mỗi quỹ đạo có trái tim nhỏ.
  const orbits = heart.match(/radius: [\d.]+,/g) ?? [];
  assert.equal(orbits.length >= 3, true, "có ít nhất ba quỹ đạo");
  assert.match(heart, /config\.speed/, "mỗi quỹ đạo quay một tốc độ khác nhau");
  assert.match(
    heart,
    /config\.tilt/,
    "quỹ đạo nghiêng nhau nên nhìn ra vũ trụ",
  );
  assert.match(heart, /trái tim lớn ở chính giữa/i, "ghi rõ trái tim ở giữa");
  assert.match(heart, /additive/i, "quầng sáng cộng màu cho ra dáng tinh vân");
  assert.match(heart, /height = 320/, "trái tim vẫn tự chỉnh chiều cao");
  // Không được quay lại hình cầu hay mô hình đồ chơi.
  assert.equal(
    existsSync(new URL("../src/components/LoveBridgeArt.tsx", import.meta.url)),
    false,
  );
  assert.equal(
    existsSync(new URL("../src/components/LoveBridge.tsx", import.meta.url)),
    false,
  );
  assert.doesNotMatch(heart, /Bridge/);
});

test("Tín hiệu WebRTC: gói đúng dạng, gửi lại không áp dụng hai lần", () => {
  const packet = rtcPacket("c7", "offer", { sdp: "v=0 mời nối" });
  assert.equal(packet.kind, "call", "đi chung kênh với tín hiệu cuộc gọi");
  assert.equal(packet.event, "rtc");
  assert.equal(packet.callId, "c7");
  assert.equal(packet.sub, "offer");
  assert.equal(typeof packet.sid, "string");
  assert.equal(isRtcPacket(packet), true);
  assert.equal(isRtcPacket({ kind: "call", event: "ring" }), false);
  assert.equal(isRtcPacket({ kind: "call", event: "rtc", sub: "lạ" }), false);
  assert.equal(RTC_SUBS.includes("ice"), true);

  // Cùng nội dung (gửi lại để chống mất gói) thì cùng mã → bên nhận bỏ qua bản lặp.
  const again = rtcPacket("c7", "offer", { sdp: "v=0 mời nối" });
  assert.equal(again.sid, packet.sid);
  const other = rtcPacket("c7", "offer", { sdp: "v=0 mời nối lần hai" });
  assert.notEqual(other.sid, packet.sid);
  assert.notEqual(
    signalId("c7", "ice", { candidate: { candidate: "a" } }),
    signalId("c7", "ice", { candidate: { candidate: "b" } }),
  );
  assert.equal(signalFingerprint("abc"), signalFingerprint("abc"));
  assert.notEqual(signalFingerprint("abc"), signalFingerprint("abd"));

  let seen = [];
  assert.equal(hasSignal(seen, packet.sid), false);
  seen = rememberSignal(seen, packet.sid);
  assert.equal(hasSignal(seen, packet.sid), true, "lần hai bị bỏ qua");
  assert.equal(rememberSignal(seen, packet.sid).length, 1, "không ghi trùng");
  for (let index = 0; index < RTC_SIGNAL_KEEP + 20; index += 1) {
    seen = rememberSignal(seen, `x${index}`);
  }
  assert.equal(seen.length, RTC_SIGNAL_KEEP, "danh sách mã không phình ra");
  assert.equal(
    hasSignal(seen, packet.sid),
    false,
    "mã cũ bị đẩy ra khỏi danh sách",
  );
});

test("WebRTC: máy chủ STUN/TURN miễn phí, chỉ lấy tiếng, có khử vọng", () => {
  const urls = RTC_ICE_SERVERS.flatMap((server) =>
    Array.isArray(server.urls) ? server.urls : [server.urls],
  );
  assert.equal(
    urls.every((url) => url.startsWith("stun:") || url.startsWith("turn:")),
    true,
    "chỉ dùng máy chủ công khai có sẵn, không cần máy chủ riêng của mình",
  );
  assert.equal(
    urls.some((url) => url.startsWith("turn:")),
    true,
    "có TURN miễn phí để nối được cả khi NAT khó",
  );
  assert.equal(
    urls.some((url) => url.includes("stun.l.google.com")),
    true,
  );
  assert.equal(RTC_MEDIA.video, false, "chỉ gọi tiếng");
  assert.equal(
    RTC_MEDIA.audio.echoCancellation,
    true,
    "khử vọng của chính WebRTC",
  );
  assert.equal(RTC_MEDIA.audio.noiseSuppression, true);
  assert.equal(rtcStateIsLive("connected"), true);
  assert.equal(rtcStateIsLive("completed"), true);
  assert.equal(rtcStateIsLive("connecting"), false);
  assert.equal(rtcStateIsLost("failed"), true);
  assert.equal(rtcStateIsLost("connected"), false);
  assert.match(rtcStatusText("live"), /trực tiếp/);
  assert.match(rtcStatusText("failed"), /kênh ghép nối/);
});

test("WebRTC chậm quá thì quay về kênh ghép nối, không để mất cuộc gọi", () => {
  assert.equal(RTC_TRY_MS >= 4000 && RTC_TRY_MS <= 12000, true);
  assert.equal(rtcWaitingTooLong(1000, 0), false, "chưa thử thì không tính");
  assert.equal(rtcWaitingTooLong(RTC_TRY_MS, 0), false);
  assert.equal(rtcWaitingTooLong(RTC_TRY_MS + 10, 1), true);
  assert.equal(rtcWaitingTooLong(RTC_TRY_MS - 10, 1), false);
  assert.equal(RTC_DROP_MS >= 1000 && RTC_DROP_MS <= 6000, true);
  assert.equal(RTC_RETRY_SIGNAL_MS > 200, true, "chờ một nhịp rồi mới gửi lại");

  const service = read("src/services/rtcCall.ts");
  // Nạp thư viện native muộn + bọc try/catch: bản build thiếu WebRTC vẫn chạy được.
  assert.match(service, /require\("react-native-webrtc"\)/);
  assert.match(service, /try \{\s*nativeModule = require/);
  assert.match(service, /rtcStatusText/);
  assert.match(service, /addIceCandidate/);
  assert.match(service, /restart|createOffer/);
  assert.match(service, /setMic\(on: boolean\)/);
  assert.equal(
    existsSync(new URL("../src/logic/rtcSignal.mjs", import.meta.url)),
    true,
  );
});

test("Cuộc gọi dùng đường tiếng trực tiếp: ghi âm cũ dừng, mic tắt theo nút", () => {
  const app = read("App.tsx");
  assert.match(app, /new RtcCall\(/);
  assert.match(
    app,
    /if \(event === "rtc"\)/,
    "nhận tín hiệu WebRTC của máy kia",
  );
  assert.match(app, /rtcRef\.current\?\.setMic\(Boolean\(event\.on\)\)/);
  assert.match(
    app,
    /if \(!active \|\| rtcLive \|\| !rtcFallback\) return;/,
    "chỉ ghi âm khi WebRTC đã bỏ cuộc: micro phục vụ một đường tiếng",
  );
  assert.match(
    app,
    /rtcLiveRef\.current/,
    "nhịp sống biết khi nào tiếng đã đi trực tiếp",
  );
  assert.match(
    app,
    /rtcLive=\{rtcLive\}/,
    "màn hình gọi biết đang nói trực tiếp",
  );
  assert.match(
    app,
    /\}, \[call\?\.phase, call\?\.id, rtcLive, rtcFallback\]\)/,
    "đổi đường tiếng thì dừng ghi âm",
  );

  const call = read("src/screens/local/CallLocal.tsx");
  assert.match(call, /rtcInfo: \{ state: string; detail: string \}/);
  assert.match(
    call,
    /if \(!active \|\| rtcLive\) \{/,
    "không phát lại mảnh cũ khi đã nối trực tiếp",
  );
  assert.match(
    call,
    /rtcInfo\.detail/,
    "hiện trạng thái đường tiếng trên màn hình gọi",
  );

  const config = read("app.config.js");
  assert.match(
    config,
    /MODIFY_AUDIO_SETTINGS/,
    "WebRTC cần quyền đổi chế độ âm thanh",
  );
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["react-native-webrtc"], "124.0.8");
  assert.equal(pkg.version, "1.15.0");
  assert.equal(config.includes('version: "1.15.0"'), true);
});
