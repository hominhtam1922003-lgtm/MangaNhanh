// Vòng 15: cuộc gọi "không nghe được gì" — đẩy tiếng ra loa ngoài trên Android,
// đọc số liệu tiếng thật của WebRTC để biết có tiếng hay không, tự quay về đường
// tiếng qua kênh ghép nối khi nối rồi mà im, và nút chuyển tay khi vẫn không nghe.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PEER_CLOUD,
  RTC_DEAD_MS,
  RTC_ICE_SERVERS,
  RTC_MEDIA,
  RTC_OPUS_BITRATE,
  RTC_PEER_MS,
  RTC_STATS_MS,
  RTC_SUBS,
  RTC_TURN_SERVERS,
  formatAudioBytes,
  rtcAudioIsDead,
  rtcAudioText,
  tuneOpusSdp,
} from "../src/logic/rtcSignal.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Opus được bật FEC và tắt DTX để tiếng đi liền mạch", () => {
  const sdp = [
    "v=0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111 0 8",
    "a=rtpmap:111 opus/48000/2",
    "a=fmtp:111 minptime=10;useinbandfec=1",
    "a=rtpmap:0 PCMU/8000",
    "a=sendrecv",
  ].join("\r\n");
  const out = tuneOpusSdp(sdp);
  assert.match(
    out,
    /a=fmtp:111 .*useinbandfec=1/,
    "bật FEC để mất gói vẫn nghe",
  );
  assert.match(out, /a=fmtp:111 .*usedtx=0/, "không tắt tiếng khi im lặng");
  assert.match(
    out,
    new RegExp(`maxaveragebitrate=${RTC_OPUS_BITRATE}`),
    "đặt mức tiếng nói",
  );
  assert.match(out, /minptime=10/, "giữ nguyên tham số cũ");
  assert.equal(out.split("\r\n").length, sdp.split("\r\n").length + 0);
  assert.equal(
    out.includes("a=rtpmap:0 PCMU/8000"),
    true,
    "không đụng codec khác",
  );
});

test("SDP chưa có dòng fmtp của Opus thì được thêm vào ngay sau rtpmap", () => {
  const sdp = ["m=audio 9 RTP/SAVPF 111", "a=rtpmap:111 opus/48000/2"].join(
    "\r\n",
  );
  const out = tuneOpusSdp(sdp);
  const lines = out.split("\r\n");
  assert.equal(
    lines[2],
    `a=fmtp:111 useinbandfec=1;usedtx=0;maxaveragebitrate=${RTC_OPUS_BITRATE}`,
  );
  // SDP không có Opus, hoặc rỗng: trả về nguyên bản.
  assert.equal(tuneOpusSdp(""), "");
  assert.equal(tuneOpusSdp("a=rtpmap:0 PCMU/8000"), "a=rtpmap:0 PCMU/8000");
});

test("Nối rồi mà không có byte tiếng nào thì coi như không nghe được", () => {
  assert.equal(RTC_DEAD_MS >= 4000, true, "chờ đủ lâu mới kết luận");
  assert.equal(RTC_STATS_MS, 2000);
  assert.equal(rtcAudioIsDead(10000, 9000), false, "vừa có byte thì còn sống");
  assert.equal(
    rtcAudioIsDead(9000 + RTC_DEAD_MS + 1, 9000),
    true,
    "im quá lâu thì chuyển đường tiếng",
  );
  assert.equal(rtcAudioIsDead(999999, 0), false, "chưa ghi nhận thì bỏ qua");
  assert.equal(
    rtcAudioIsDead(999999, 9000, 1),
    true,
    "ngưỡng nhỏ nhất là 2 giây, không chuyển đường tiếng quá sớm",
  );
});

test("Dòng số liệu tiếng hiện bằng số thật, viết kiểu Việt Nam", () => {
  assert.equal(formatAudioBytes(0), "0 B");
  assert.equal(formatAudioBytes(512), "512 B");
  assert.equal(formatAudioBytes(12544), "12,3 KB");
  assert.equal(formatAudioBytes(2 * 1024 * 1024), "2,00 MB");
  assert.equal(
    rtcAudioText(12544, 9988),
    "tiếng vào 12,3 KB · tiếng ra 9,8 KB",
  );
});

test("WebRTC tự đo tiếng thật và tự quay về kênh ghép nối khi im", () => {
  const call = read("src/services/rtcCall.ts");
  assert.match(call, /getStats\(\)/, "đọc số liệu thật của WebRTC");
  assert.match(call, /inbound-rtp/, "đếm byte tiếng vào");
  assert.match(call, /outbound-rtp/, "đếm byte tiếng ra");
  assert.match(call, /rtcAudioIsDead\(/, "dùng ngưỡng đã kiểm thử ở trên");
  assert.match(call, /onStats\?\.\(/, "báo số liệu lên màn hình gọi");
  assert.match(
    call,
    /tuneOpusSdp\(offer\.sdp\)/,
    "chỉnh Opus trước khi gửi lời mời",
  );
  assert.match(call, /tuneOpusSdp\(answer\.sdp\)/, "và trước khi trả lời");
  assert.match(call, /giveUp\(/, "có hàm chuyển tay sang đường tiếng thường");
  const media = JSON.stringify(RTC_MEDIA);
  assert.match(media, /echoCancellation/, "khử vọng để hai bên nói chồng được");
});

test("Android đẩy tiếng cuộc gọi ra loa ngoài và nhắc lại trong lúc gọi", () => {
  const app = read("App.tsx");
  const route = app.match(/shouldRouteThroughEarpiece: false[\s\S]{0,80}?\}/);
  assert.equal(route !== null, true, "đặt đường tiếng ra loa ngoài");
  assert.match(
    app,
    /setInterval\(route, \d{4}\)/,
    "nhắc lại vài giây một lần vì máy có thể đổi lại",
  );
  assert.match(app, /rtcStats|onStats/, "gắn số liệu vào giao diện");
  assert.match(app, /setRtcAudio\(info\)/, "lưu số liệu tiếng vào state");
  assert.match(app, /useLegacyAudio/, "có nút chuyển tay cho người dùng");
});

test("Màn hình gọi hiện số liệu tiếng và nút 'nghe không được'", () => {
  const screen = read("src/screens/local/CallLocal.tsx");
  assert.match(
    screen,
    /formatAudioBytes/,
    "hiện số byte thật, không phải chữ suông",
  );
  assert.match(screen, /Tiếng vào \{formatAudioBytes/, "hiện tiếng vào");
  assert.match(screen, /tiếng ra/, "hiện tiếng ra");
  assert.match(
    screen,
    /Nghe không được\?/,
    "có nút chuyển sang đường tiếng thường",
  );
  assert.match(screen, /onUseLegacyAudio/, "nút gọi đúng hàm");
  assert.match(screen, /rtcAudio/, "nhận số liệu từ App");
});

test("Bản 1.15.0 (bản dựng 17) đã sẵn sàng", () => {
  const config = read("app.config.js");
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.version, "1.15.0");
  assert.equal(config.includes('version: "1.15.0"'), true);
  assert.equal(config.includes("versionCode: 17"), true);
  const settings = read("src/screens/local/SettingsLocal.tsx");
  assert.match(settings, /1\.15\.0/, "màn hình Cài đặt dự phòng đúng bản mới");
});

test("Lớp 1 dùng PeerJS: máy chủ chào hỏi + TURN miễn phí, không tài khoản", () => {
  assert.equal(PEER_CLOUD.host, "0.peerjs.com", "máy chủ công cộng của PeerJS");
  assert.equal(PEER_CLOUD.port, 443);
  assert.equal(PEER_CLOUD.secure, true, "đi qua wss, không cần mở cổng lạ");
  assert.equal(
    RTC_TURN_SERVERS.length >= 1,
    true,
    "có TURN để nối qua NAT khó",
  );
  for (const server of RTC_TURN_SERVERS) {
    assert.equal(
      server.urls.every((url) => url.startsWith("turn:")),
      true,
      "đúng máy chủ trung chuyển",
    );
    assert.equal(typeof server.username, "string");
    assert.equal(typeof server.credential, "string");
    assert.equal(
      server.urls.every((url) => url.includes("peerjs.com")),
      true,
      "máy chủ trung chuyển miễn phí đi kèm PeerJS, không phải của ta",
    );
  }
  const urls = RTC_ICE_SERVERS.flatMap((server) =>
    Array.isArray(server.urls) ? server.urls : [server.urls],
  );
  assert.equal(
    urls.some((url) => url.startsWith("turn:")),
    true,
  );
  assert.equal(
    RTC_SUBS.includes("pid"),
    true,
    "mã máy trao đổi qua kênh ghép nối đang chạy sẵn",
  );
  assert.equal(
    RTC_PEER_MS >= 1000 && RTC_PEER_MS <= 4000,
    true,
    "chờ vừa phải",
  );
});

test("peerjs chạy được trong React Native: thay thư viện vá trình duyệt", () => {
  const shim = read("shims/webrtc-adapter.js");
  assert.match(shim, /browserDetails/, "peerjs đọc browserDetails khi nạp");
  assert.match(shim, /browser: "firefox"/, "nhánh unified-plan của peerjs");
  const metro = read("metro.config.js");
  assert.match(
    metro,
    /webrtc-adapter/,
    "metro trỏ webrtc-adapter vào bản thay thế",
  );
  assert.match(metro, /shims\/webrtc-adapter\.js/);
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies.peerjs, "1.5.5", "ghim đúng bản đã kiểm thử");
  assert.match(
    read("src/services/rtcCall.ts"),
    /registerGlobals\?\.\(\)/,
    "đăng ký WebRTC toàn cục trước khi nạp peerjs",
  );
});

test("Ba lớp đường tiếng nối tiếp nhau, lớp trên hỏng thì hạ xuống lớp dưới", () => {
  const call = read("src/services/rtcCall.ts");
  assert.match(call, /require\("peerjs"\)/, "lớp 1: PeerJS");
  assert.match(call, /peer\.call\(this\.remotePeerId, this\.mic\)/, "bên gọi");
  assert.match(call, /incoming\.answer\(this\.mic\)/, "bên nghe nhấc máy");
  assert.match(call, /markLive\("PeerJS"\)/, "nối được qua PeerJS là nói được");
  assert.match(call, /stopPeer\(\)/, "hết thời gian chờ thì dọn PeerJS");
  assert.match(
    call,
    /stage = "native"/,
    "lớp 2: WebRTC tự nối qua kênh ghép nối",
  );
  assert.match(
    call,
    /this\.early\.push\(message\)/,
    "giữ tín hiệu của máy chạy bản cũ để dùng khi hạ xuống lớp 2",
  );
  assert.match(
    call,
    /rtcPacket\(this\.opts\.callId, "pid"|sendSignal\("pid"/,
    "gửi mã máy qua kênh ghép nối",
  );
  assert.match(
    call,
    /getUserMedia/,
    "lớp 3 vẫn là kênh ghép nối khi cả hai lớp kia không nối được",
  );
});
