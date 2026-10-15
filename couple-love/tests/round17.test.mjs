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
  RTC_MEDIA,
  RTC_PEER_MS,
  RTC_TRY_MS,
  RTC_TURN_SERVERS,
  RTC_VIDEO_BITRATE_KBPS,
  rtcMediaConstraints,
  tuneAdaptiveSdp,
} from "../src/logic/rtcSignal.mjs";
import { callEvent, newCall } from "../src/logic/callLogic.mjs";
import { MESSENGER_THEMES, themeById } from "../src/logic/themes.mjs";
import {
  PET_DECAY_INTERVAL_MS,
  PET_SPEECH_BUBBLES,
  applyBiologicalDecay,
  buildPetReminderText,
  computeLevelProgress,
  computePetStatus,
  defaultPet,
  interactPet,
  levelExpRequirement,
} from "../src/logic/pet.mjs";

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
  // Từ bản dọn dẹp 1.18.0, phần cử chỉ vuốt nằm trong components/SwipeRow.tsx
  // (ChatLocal chỉ còn dùng lại) — kiểm tra đúng tệp đang chạy.
  const swipe = read("src/components/SwipeRow.tsx");
  assert.match(swipe, /from "react-native-gesture-handler"/);
  assert.match(swipe, /from "react-native-reanimated"/);
  assert.match(swipe, /Gesture\.Pan\(\)/);
  assert.match(swipe, /GestureDetector/);
  assert.match(swipe, /useSharedValue\(0\)/);
  assert.match(swipe, /useAnimatedStyle/);
  assert.match(swipe, /activeOffsetX\(14\)/, "chỉ giành cử chỉ khi vuốt ngang");
  assert.match(swipe, /REPLY_SWIPE_PX/);
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.match(
    chat,
    /from "\.\.\/\.\.\/components\/SwipeRow"/,
    "ChatLocal dùng lại SwipeRow",
  );
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

test("Nâng cấp 1.18.7: Chống ồn Adaptive Filter, SDP thích ứng, Flat Call UI + Gọi Video & Chủ đề Messenger", () => {
  // 1. Chống ồn phần cứng + Adaptive Filter
  assert.equal(RTC_MEDIA.audio.echoCancellation, true);
  assert.equal(RTC_MEDIA.audio.noiseSuppression, true);
  assert.equal(RTC_MEDIA.audio.autoGainControl, true);
  assert.equal(RTC_MEDIA.audio.googHighpassFilter, true);
  assert.equal(RTC_MEDIA.audio.googEchoCancellation2, true);
  assert.equal(RTC_MEDIA.audio.googDAEchoCancellation, true);
  assert.equal(RTC_MEDIA.audio.googNoiseSuppression2, true);
  assert.equal(RTC_MEDIA.audio.googAutoGainControl2, true);
  const videoMedia = rtcMediaConstraints(true);
  assert.equal(typeof videoMedia.video, "object");

  // 2. SDP thích ứng cho cả Audio (Opus FEC) và Video (b=AS + x-google-*-bitrate)
  const rawSdp = [
    "v=0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
    "m=video 9 UDP/TLS/RTP/SAVPF 96",
    "c=IN IP4 0.0.0.0",
    "a=rtpmap:96 VP8/90000",
    "a=fmtp:96 max-fr=30",
  ].join("\r\n");
  const tuned = tuneAdaptiveSdp(rawSdp, { videoBitrateKbps: 380 });
  assert.match(tuned, /useinbandfec=1;usedtx=0/);
  assert.match(tuned, new RegExp(`b=AS:${RTC_VIDEO_BITRATE_KBPS}`));
  assert.match(tuned, /x-google-max-bitrate=380/);

  // 3. Trạng thái cuộc gọi hỗ trợ Video, Camera & Loa ngoài (Speakerphone)
  let c = newCall({ id: "v1", role: "caller", name: "Ngọc", video: true });
  assert.equal(c.video, true);
  assert.equal(c.camOn, true);
  assert.equal(c.speakerOn, true);
  c = callEvent(c, { type: "speaker", on: false });
  assert.equal(c.speakerOn, false);
  c = callEvent(c, { type: "cam", on: false });
  assert.equal(c.camOn, false);

  // 4. Giao diện Flat Call UI, nút Gọi Video trong màn Chat & Thanh công cụ cuộc gọi
  const callUi = read("src/screens/local/CallLocal.tsx");
  assert.match(callUi, /const flatUi = true/, "chuyển sang Flat UI mượt mà");
  assert.match(callUi, /Loa ngoài/, "có nút Loa ngoài");
  assert.match(callUi, /Tắt cam|Bật cam/, "có nút Bật/Tắt Camera");
  assert.match(
    callUi,
    /justifyContent: "space-between"/,
    "nút Từ chối và Nghe tách rời đối xứng hai bên",
  );
  const chatUi = read("src/screens/local/ChatLocal.tsx");
  assert.match(
    chatUi,
    /Gọi Video cho người thương/,
    "nút Gọi Video gọn gàng trong màn Chat",
  );

  // 5. Hệ thống Chủ đề phong cách Messenger đồng bộ
  const labels = MESSENGER_THEMES.map((item) => item.label);
  assert.equal(labels.includes("Hồng ngọt ngào"), true);
  assert.equal(labels.includes("Nâu trà sữa"), true);
  assert.equal(labels.includes("Xanh mộng mơ"), true);
  assert.equal(themeById("nau-tra-sua").id, "meo");
  assert.equal(themeById("xanh-mong-mo").id, "bien");
  assert.equal(Array.isArray(themeById("hong").bubbleMine), true);

  // 6. Tính năng Nuôi Thú Cưng Ảo (Couple Pet - phong cách Widgetable chuẩn 1.18.9)
  assert.equal(
    PET_SPEECH_BUBBLES.includes(
      "Nhìn vào mắt đằng ấy, thấy sao một thế giới màu hồng ❤️",
    ),
    true,
  );
  const p0 = defaultPet(1000);
  assert.equal(p0.totalExp, 0, "khởi tạo Exp = 0/1000 ở Level 1");
  assert.equal(p0.todayExp, 0, "khởi tạo Exp hôm nay = 0/100");
  assert.equal(levelExpRequirement(1), 1000, "Lv.1 cần 1000 Exp");
  assert.equal(levelExpRequirement(2), 2000, "Lv.2 cần 2000 Exp");
  assert.equal(computeLevelProgress(0).level, 1);
  assert.equal(computeLevelProgress(0).levelExp, 0);
  assert.equal(computeLevelProgress(0).levelGoal, 1000);
  assert.equal(computeLevelProgress(1000).level, 2);
  assert.equal(computeLevelProgress(1000).levelGoal, 2000);

  // Điểm cộng dồn: Tương tác phòng (+5), Nhắn tin (+10), Gọi thoại/video (+25)
  const pFeed = interactPet(p0, "feed", "me", 2000);
  assert.equal(pFeed.totalExp, 5, "tương tác phòng +5 Exp");
  const pChat = interactPet(pFeed, "chat", "me", 3000);
  assert.equal(pChat.totalExp, 15, "nhắn tin +10 Exp");
  const pCall = interactPet(pChat, "call", "me", 4000);
  assert.equal(pCall.totalExp, 40, "gọi thoại/video +25 Exp");

  // Giới hạn tối đa 100 Exp mỗi ngày cho mỗi người dùng
  let pCap = p0;
  for (let i = 0; i < 10; i += 1) {
    pCap = interactPet(pCap, "call", "me", 5000 + i * 100);
  }
  assert.equal(pCap.meTodayExp, 100, "mỗi người tối đa 100 Exp/ngày");
  assert.equal(
    pCap.totalExp,
    100,
    "vượt 100 Exp/ngày của 1 người không cộng thêm",
  );

  // Chu kỳ 15 phút giảm chỉ số sinh học (Đói, Dơ, Yêu thương)
  assert.equal(PET_DECAY_INTERVAL_MS, 15 * 60 * 1000);
  const decayed = applyBiologicalDecay(p0, 1000 + 2 * PET_DECAY_INTERVAL_MS);
  assert.equal(decayed.decayCycles, 2);
  assert.equal(decayed.hunger < p0.hunger, true, "đói giảm sau mỗi 15 phút");
  assert.equal(
    decayed.cleanliness < p0.cleanliness,
    true,
    "sạch sẽ giảm sau mỗi 15 phút",
  );
  assert.equal(
    decayed.affection < p0.affection,
    true,
    "yêu thương giảm sau mỗi 15 phút",
  );

  // Nhắc nhở thời gian thực
  assert.match(
    buildPetReminderText(p0, 2000),
    /Boss.*đang đòi ăn kìa, vào cho Boss ăn cùng em đi anh ơi!/,
  );

  // Giao diện Full-screen Call + RTCView cover + Loa ngoài
  assert.match(callUi, /Modal/, "màn hình gọi Full-screen Modal");
  assert.match(
    callUi,
    /StyleSheet\.absoluteFillObject/,
    "RTCView phủ kín màn hình",
  );
  assert.match(callUi, /objectFit="cover"/, "RTCView objectFit cover");

  const status = computePetStatus({ pet: pFeed, messages: [] }, 2500);
  assert.equal(status.level, 1);
  assert.equal(status.levelGoal, 1000);
  assert.match(status.energyIcons, /⚡/);
  const petUi = read("src/screens/local/PetLocal.tsx");
  assert.match(petUi, /Exp hôm nay:/);
  assert.match(petUi, /Cho ăn/);
  assert.match(petUi, /Tắm rửa/);
  assert.match(petUi, /Đi ngủ/);
  assert.match(petUi, /Nhắc nhở/);
  assert.match(petUi, /Quà tặng/);
});
