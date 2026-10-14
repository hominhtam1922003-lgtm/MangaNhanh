// Vòng 17: đổi tên gọn gàng + gói tin nhắn đúng chuẩn (reaction/unsend/typing/read/
// profile), vuốt trả lời bằng react-native-gesture-handler + reanimated, trái tim
// 3D WebGL đập theo giọng nói, TURN riêng của chủ app (Metered "couple-love"),
// và tự nối lại ICE khi mạng 4G đổi trạm.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ICE_POLICY,
  PEER_CLOUD,
  RTC_ICE_SERVERS,
  RTC_PEER_MS,
  RTC_TRY_MS,
  RTC_TURN_SERVERS,
} from "../src/logic/rtcSignal.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const urlsOf = (server) =>
  Array.isArray(server.urls) ? server.urls : [server.urls];

test("TURN riêng của chủ app: cổng 80, 443 và TCP 443, có tài khoản", () => {
  const own = RTC_TURN_SERVERS.find((server) =>
    urlsOf(server).some((url) => url.includes("couple-love.metered.live")),
  );
  assert.equal(Boolean(own), true, "có máy chủ trung chuyển riêng");
  const urls = urlsOf(own);
  assert.deepEqual(urls, [
    "turn:couple-love.metered.live:80",
    "turn:couple-love.metered.live:443",
    "turn:couple-love.metered.live:443?transport=tcp",
  ]);
  assert.equal(typeof own.username, "string");
  assert.equal(own.username.length > 8, true);
  assert.equal(typeof own.credential, "string");
  assert.equal(own.credential.length > 8, true);
  // Đặt TRƯỚC các bộ công cộng để ICE thử ngay từ đầu.
  assert.equal(RTC_TURN_SERVERS[0], own);
  assert.equal(ICE_POLICY, "all", "vẫn ưu tiên nối trực tiếp máy-tới-máy");
});

test("STUN của Google và các lớp dự phòng vẫn còn nguyên", () => {
  const urls = RTC_ICE_SERVERS.flatMap(urlsOf);
  for (const stun of [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
  ])
    assert.equal(urls.includes(stun), true, `có ${stun}`);
  assert.equal(
    urls.some((url) => url.includes("peerjs.com")),
    true,
    "vẫn còn TURN miễn phí của PeerJS",
  );
  assert.equal(PEER_CLOUD.host, "0.peerjs.com");
  // Thang dự phòng giữ nguyên: PeerJS 2,5 giây → WebRTC thuần → tiếng qua kênh ghép nối.
  assert.equal(RTC_PEER_MS, 2500);
  assert.equal(RTC_TRY_MS, 4000);
});

test("Mạng 4G đổi trạm: giữ sẵn nhiều địa chỉ và tự nối lại ICE trước khi bỏ cuộc", () => {
  const call = read("src/services/rtcCall.ts");
  assert.match(call, /iceCandidatePoolSize: 6/);
  assert.match(call, /this\.pc\?\.restartIce\?\.\(\)/);
  assert.match(call, /this\.peerMedia\?\.peerConnection\?\.restartIce\?\.\(\)/);
  assert.match(call, /rtcStateIsLost/, "vẫn giữ đường lùi khi mất hẳn");
});

test("Gói tin nhắn đúng chuẩn mới và vẫn hiểu máy ở bản cũ", () => {
  const app = read("App.tsx");
  // Gửi: gói mới + gói cũ để hai máy khác phiên bản vẫn hiểu nhau.
  assert.match(app, /type: "reaction",\n\s+messageId: id,/);
  assert.match(app, /emotion: emoji,/);
  assert.match(app, /\{ kind: "chatReact", id, emoji \}/);
  assert.match(app, /type: "unsend", messageId: id/);
  assert.match(app, /\{ kind: "chatRecall", id \}/);
  assert.match(app, /type: "read",\n\s+lastMessageId: fresh\[0\],/);
  assert.match(app, /\{ kind: "chatRead", ids: fresh \}/);
  assert.match(app, /type: "typing", state: active/);
  assert.match(app, /kind: "profile",\n\s+type: "profile",/);
  // Nhận: hiểu cả hai cách đặt tên.
  assert.match(app, /if \(kind === "reaction"\) \{/);
  assert.match(app, /if \(kind === "unsend"\) \{/);
  assert.match(app, /if \(kind === "read"\) \{/);
  assert.match(app, /if \(kind === "profile"\) \{/);
  assert.match(app, /if \(kind === "chatReact"\) \{/);
  assert.match(app, /if \(kind === "chatRecall"\) \{/);
  assert.match(app, /if \(kind === "chatRead"\) \{/);
});

test("Đổi ảnh đại diện: báo máy kia ngay rồi gửi kèm tệp ảnh", () => {
  const app = read("App.tsx");
  assert.match(app, /const pushedAvatarRef = useRef<string \| null>\(null\)/);
  assert.match(
    app,
    /if \(firstRun\) return;/,
    "lần mở đầu tiên thì để gói dữ liệu lo, không gửi trùng",
  );
  assert.match(app, /function sendAvatarFile\(note = ""\)/);
  assert.match(app, /role: "avatar",\n\s+avatarId: name,/);
  assert.match(app, /Đã gửi ảnh đại diện mới cho người thương/);
  // Máy nhận: thiếu tệp ảnh thì xin lại ngay trong gói hồ sơ.
  assert.match(
    app,
    /if \(avatar && !imageExists\(avatar\) && shouldAsk\(avatar, 20000\)\)/,
  );
});

test("Vuốt để trả lời dùng react-native-gesture-handler + reanimated", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["react-native-gesture-handler"], "~2.28.0");
  assert.equal(pkg.dependencies["react-native-reanimated"], "~4.1.1");
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.match(chat, /from "react-native-gesture-handler"/);
  assert.match(chat, /from "react-native-reanimated"/);
  assert.match(chat, /Gesture\.Pan\(\)/);
  assert.match(chat, /GestureDetector/);
  assert.match(chat, /useSharedValue\(0\)/);
  assert.match(chat, /useAnimatedStyle/);
  assert.match(chat, /activeOffsetX\(14\)/, "chỉ giành cử chỉ khi vuốt ngang");
  assert.match(chat, /REPLY_SWIPE_PX/);
  const app = read("App.tsx");
  assert.match(app, /import "react-native-gesture-handler";/);
  assert.match(app, /<GestureHandlerRootView style=\{\{ flex: 1 \}\}>/);
});

test("Trái tim 3D (WebGL) đập theo cường độ giọng nói", () => {
  const heart = read("src/components/ThreeHeart.tsx");
  assert.match(heart, /level\?: number/);
  assert.match(heart, /interactive\?: boolean/);
  assert.match(heart, /smoothLevel\.current/, "làm mượt mức tiếng");
  assert.match(
    heart,
    /smoothLevel\.current \* 0\.3/,
    "đập tối đa +30% theo giọng",
  );
  assert.match(heart, /pointerEvents=\{interactive \? "auto" : "none"\}/);
  const call = read("src/screens/local/CallLocal.tsx");
  assert.match(call, /import ThreeHeart from "..\/..\/components\/ThreeHeart"/);
  assert.match(call, /level=\{active && rtcLive \? rtcAudio\.level : 0\}/);
  assert.match(call, /reduced = false/);
  assert.match(read("App.tsx"), /reduced=\{reduceMotion\}/);
});

test("Nút điều khiển cuộc gọi nằm nửa dưới, tròn lớn, dễ bấm một tay", () => {
  const call = read("src/screens/local/CallLocal.tsx");
  assert.match(call, /size=\{68\}/, "nút mic tròn lớn");
  assert.match(call, /size=\{80\}/, "nút Cúp máy to nhất");
  assert.match(call, /tone="red"/);
  assert.match(call, /items-end mt-\d/, "cụm nút đẩy xuống nửa dưới màn hình");
});

test("Đổi tên app đã sạch, gói cài vẫn giữ nguyên nên cài đè được", () => {
  const config = read("app.config.js");
  assert.match(config, /name: "Mật Mã Yêu"/);
  assert.match(config, /slug: "hai-trai-tim"/, "slug giữ nguyên để cài đè");
  assert.match(config, /scheme: "haitraitim"/);
  const pkg = JSON.parse(read("package.json"));
  assert.equal(config.includes(`version: "${pkg.version}"`), true);
  assert.ok(
    Number(/versionCode: (\d+)/.exec(config)?.[1] ?? 0) >= 19,
    "số bản dựng tăng dần",
  );
  for (const file of ["App.tsx", "src/screens/local/PairLocal.tsx"])
    assert.equal(
      read(file).includes("Hai Trái Tim"),
      false,
      `${file} không còn tên cũ`,
    );
  const settings = read("src/screens/local/SettingsLocal.tsx");
  assert.match(settings, /Mật Mã Yêu \{Constants\.expoConfig\?\.version/);
});
