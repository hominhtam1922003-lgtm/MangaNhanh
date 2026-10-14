// Vòng 16: nhắn tin kiểu Messenger/Zalo cho hai bạn —
// thả cảm xúc vào tin nhắn, THU HỒI tin (xoá cả hai bên), trả lời trích dẫn,
// chấm "đang nhập…", lưu ảnh người thương gửi về máy, ảnh đại diện sang máy kia,
// trái tim đập theo giọng nói trong cuộc gọi, thông báo có nút Trả lời và dịch vụ
// giữ kết nối để tin nhắn vẫn nổi khi tắt màn hình. Kèm sửa lỗi hộp chọn ảnh bị
// "unregistered ActivityResultLauncher" trên Android.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  REACTIONS,
  audioLevelFromBytes,
  audioLevelFromReport,
  emptyReact,
  heartIdleScale,
  heartScale,
  isRecalled,
  normalizeReact,
  reactList,
  recallMessage,
  recallText,
  replyPreview,
  setReact,
  smoothLevel,
  toggleReact,
  typingText,
} from "../src/logic/chatExtras.mjs";
import { emptyState, mergeState, reduce } from "../src/logic/localState.mjs";
import { buildRelayPayload } from "../src/services/relayProtocol.mjs";
import {
  AVATAR_LIMIT_BYTES,
  photoMessages,
} from "../src/services/momentTransfer.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Thả cảm xúc: chọn, đổi và bấm lại để bỏ (như Messenger)", () => {
  assert.equal(REACTIONS.includes("❤️"), true);
  assert.equal(REACTIONS.includes("😂"), true);
  assert.equal(toggleReact(null, "❤️"), "❤️");
  assert.equal(toggleReact("❤️", "😂"), "😂", "đổi cảm xúc");
  assert.equal(toggleReact("❤️", "❤️"), null, "bấm lại thì bỏ");
  assert.equal(toggleReact("❤️", ""), null);
  assert.equal(toggleReact("❤️", "🚀"), null, "chỉ nhận bộ cảm xúc có sẵn");
});

test("Cảm xúc hai bên cùng hiện trên một tin nhắn", () => {
  let message = { id: "m1", body: "hi", react: emptyReact() };
  message = setReact(message, "me", "❤️");
  message = setReact(message, "them", "😂");
  const list = reactList(message.react);
  assert.deepEqual(list, [
    { who: "me", emoji: "❤️" },
    { who: "them", emoji: "😂" },
  ]);
  assert.deepEqual(normalizeReact({ me: "❤️", them: "sai" }), {
    me: "❤️",
    them: null,
  });
  assert.deepEqual(normalizeReact(null), { me: null, them: null });
});

test("Thu hồi tin nhắn: xoá chữ, ảnh, tin thoại, vị trí nhưng giữ dấu thu hồi", () => {
  const recalled = recallMessage(
    {
      id: "p1",
      kind: "photo",
      body: "ảnh của em",
      photo: "chatpix-p1.jpg",
      audio: "voice-p1.m4a",
      lat: 10.36,
      lng: 106.36,
      durationMs: 4200,
      reply: { id: "m0", body: "cũ", mine: true },
    },
    "2026-10-14T10:00:00.000Z",
  );
  assert.equal(recalled.kind, "recalled");
  assert.equal(recalled.body, "");
  assert.equal(recalled.photo, null, "ảnh bị xoá khỏi máy người nhận");
  assert.equal(recalled.audio, null);
  assert.equal(recalled.lat, null);
  assert.equal(recalled.durationMs, 0);
  assert.equal(recalled.reply, null);
  assert.equal(recalled.recalledAt, "2026-10-14T10:00:00.000Z");
  assert.equal(isRecalled(recalled), true);
  assert.equal(isRecalled({ kind: "text", body: "còn nguyên" }), false);
  assert.equal(recallText(true), "Bạn đã thu hồi một tin nhắn");
  assert.equal(recallText(false), "Người thương đã thu hồi một tin nhắn");
});

test("Trả lời trích dẫn: đọc được mọi loại tin, không lộ ảnh hay tiếng", () => {
  assert.equal(
    replyPreview({ kind: "text", body: "ngủ ngon nhé" }),
    "ngủ ngon nhé",
  );
  assert.equal(
    replyPreview({ kind: "photo", body: "", photo: "a.jpg" }),
    "[Ảnh]",
  );
  assert.equal(replyPreview({ kind: "voice", body: "" }), "[Tin thoại]");
  assert.equal(replyPreview({ kind: "location", body: "10,20" }), "[Vị trí]");
  assert.equal(replyPreview({ kind: "sticker", body: "🐻" }), "[Sticker 🐻]");
  assert.equal(
    replyPreview({ kind: "call", body: "Cuộc gọi đi · 01:20" }),
    "Cuộc gọi đi · 01:20",
  );
  assert.equal(
    replyPreview(recallMessage({ id: "x", body: "bí mật" })),
    "Tin nhắn đã thu hồi",
  );
  assert.equal(replyPreview(null), "");
  assert.equal(
    replyPreview({ kind: "text", body: "x".repeat(300) }).length,
    90,
  );
});

test("Chấm “đang nhập…” đọc đúng tên người thương", () => {
  assert.equal(typingText("Bé"), "Bé đang nhập…");
  assert.equal(typingText("   "), "Đang nhập…");
  assert.equal(typingText(""), "Đang nhập…");
});

test("Mức tiếng nói lấy từ WebRTC: ưu tiên luồng tiếng nhận vào", () => {
  const report = (items) => ({ forEach: (cb) => items.forEach(cb) });
  const remote = audioLevelFromReport(
    report([
      { type: "media-source", kind: "audio", audioLevel: 0.01 },
      { type: "inbound-rtp", kind: "audio", audioLevel: 0.08 },
    ]),
  );
  assert.equal(remote.source, "remote");
  assert.equal(remote.level, 0.32, "0,08 × 4 = 0,32");
  const local = audioLevelFromReport(
    report([{ type: "media-source", kind: "audio", audioLevel: 0.5 }]),
  );
  assert.equal(local.source, "local");
  assert.equal(local.level, 1, "kẹp trong khoảng 0..1");
  assert.deepEqual(audioLevelFromReport(report([{ type: "outbound-rtp" }])), {
    source: "",
    level: null,
  });
  assert.deepEqual(audioLevelFromReport(null), { source: "", level: null });
});

test("Máy ảo không trả audioLevel thì ước lượng theo byte tiếng", () => {
  const quiet = audioLevelFromBytes(1000, 1000, 500);
  const talking = audioLevelFromBytes(1000, 6000, 500);
  assert.equal(quiet.source, "bytes");
  assert.equal(quiet.level, 0, "không có byte mới thì coi như im");
  assert.equal(talking.level > quiet.level, true);
  assert.equal(talking.level <= 1, true);
  // Khoảng thời gian 0 hoặc số âm không được làm vỡ phép tính.
  assert.equal(audioLevelFromBytes(0, 5000, 0).level >= 0, true);
});

test("Nhịp tim: lên nhanh, xuống chậm, to nhất 1,34 lần", () => {
  const up = smoothLevel(0, 1);
  const down = smoothLevel(1, 0);
  assert.equal(up > 0.5, true, "bắt đầu nói là tim to lên ngay");
  assert.equal(down > 0.7, true, "ngừng nói thì tim nhỏ xuống từ từ");
  assert.equal(heartScale(0), 1);
  assert.equal(heartScale(1), 1.34);
  assert.equal(heartScale(5), 1.34, "kẹp lại");
  assert.equal(Math.abs(heartIdleScale(0) - 1) < 0.05, true);
});

test("Bản cũ đọc lên vẫn giữ nguyên tin nhắn và thêm trường mới", () => {
  const old = {
    version: 1,
    me: { nickname: "Bạn" },
    messages: [
      {
        id: "m1",
        authorId: "me",
        kind: "text",
        body: "tin cũ",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
    ],
  };
  const migrated = reduce(emptyState(), {
    type: "partner.merge",
    state: { ...old, from: { id: "me", nickname: "Bạn" } },
  });
  const message = migrated.messages.find((item) => item.id === "m1");
  assert.equal(Boolean(message), true, "tin cũ không bị mất");
  assert.equal(message.body, "tin cũ");
  assert.deepEqual(message.react, { me: null, them: null });
  assert.equal(message.recalledAt, null);
  assert.equal(message.reply, null);
});

test("Hai máy: cảm xúc, thu hồi, trả lời đi qua kênh ghép nối", () => {
  let state = emptyState();
  state = reduce(state, {
    type: "message.add",
    kind: "text",
    body: "anh ăn cơm chưa",
  });
  const id = state.messages[0].id;
  state = reduce(state, {
    type: "message.setReact",
    id,
    side: "me",
    emoji: "❤️",
  });
  assert.equal(state.messages[0].react.me, "❤️");
  state = reduce(state, {
    type: "message.setReact",
    id,
    side: "them",
    emoji: "😂",
  });
  assert.equal(state.messages[0].react.them, "😂");
  state = reduce(state, { type: "message.recall", id });
  assert.equal(state.messages[0].kind, "recalled");
  assert.equal(
    state.messages[0].react.me,
    "❤️",
    "cảm xúc cũ vẫn còn nhưng nội dung đã xoá",
  );
});

test("Gói dữ liệu gửi đi có ảnh đại diện, cảm xúc, tin đã đọc, thu hồi, trả lời", () => {
  let state = emptyState();
  state = {
    ...state,
    me: { ...state.me, nickname: "Bạn", avatar: "avatar-abc.jpg" },
  };
  state = reduce(state, {
    type: "message.add",
    kind: "text",
    body: "câu của mình",
  });
  const mine = state.messages[0].id;
  state = reduce(state, {
    type: "message.received",
    id: "t1",
    kind: "text",
    body: "câu của người thương",
  });
  state = reduce(state, {
    type: "message.setReact",
    id: "t1",
    side: "me",
    emoji: "👍",
  });
  state = reduce(state, { type: "message.read" });
  state = reduce(state, {
    type: "message.add",
    id: "m2",
    kind: "text",
    body: "trả lời nè",
  });
  state = reduce(state, {
    type: "message.setReact",
    id: "m2",
    side: "them",
    emoji: "❤️",
  });

  const payload = buildRelayPayload(state, 60000, "dev-1", "1.16.0");
  assert.equal(
    payload.from.avatar,
    "avatar-abc.jpg",
    "gửi kèm tên tệp ảnh đại diện",
  );
  assert.deepEqual(
    payload.reactTo,
    [{ id: "t1", emoji: "👍" }],
    "cảm xúc thả vào tin người thương",
  );
  assert.equal(payload.readTo, "t1", "báo mình đã đọc tới tin nào");
  const mineMessage = payload.messages.find((item) => item.id === mine);
  assert.equal(Boolean(mineMessage), true);
  assert.deepEqual(
    mineMessage.react,
    { me: null },
    "chỉ gửi cảm xúc của chính mình",
  );
});

test("Nhận dữ liệu: ảnh đại diện, cảm xúc của người thương, tin họ đã đọc", () => {
  let state = emptyState();
  state = reduce(state, {
    type: "message.add",
    kind: "text",
    body: "mình gửi trước",
  });
  const mine = state.messages[0].id;
  const merged = mergeState(state, {
    v: 3,
    from: { id: "me", nickname: "Bé", avatar: "avatar-xyz.jpg" },
    messages: [],
    reactTo: [{ id: mine, emoji: "❤️" }],
    readTo: mine,
  });
  assert.equal(
    merged.partner.avatar,
    "avatar-xyz.jpg",
    "ảnh đại diện của người thương",
  );
  assert.equal(merged.partner.nickname, "Bé");
  const message = merged.messages.find((item) => item.id === mine);
  assert.equal(message.react.them, "❤️", "cảm xúc họ thả vào tin của mình");
  assert.equal(Boolean(message.readAt), true, "họ đã xem tin mình");
});

test("Ảnh đại diện đi theo gói ảnh riêng, có hạn mức riêng", () => {
  const packets = photoMessages({
    id: "avatar-xyz.jpg",
    base64: "A".repeat(40),
    nickname: "Bé",
    role: "avatar",
    avatarId: "avatar-xyz.jpg",
  });
  assert.equal(packets.length, 1);
  assert.equal(packets[0].meta.role, "avatar");
  assert.equal(packets[0].meta.avatarId, "avatar-xyz.jpg");
  assert.equal(AVATAR_LIMIT_BYTES >= 60 * 1024, true);
});

test("Sửa lỗi hộp chọn ảnh: Activity không bị huỷ khi đổi cỡ chữ / ngôn ngữ", () => {
  const plugin = read("plugins/with-android-activity-config.js");
  for (const change of [
    "fontScale",
    "locale",
    "layoutDirection",
    "uiMode",
    "density",
  ])
    assert.equal(plugin.includes(change), true, `khai báo ${change}`);
  assert.match(plugin, /MainActivity/, "chỉ đụng vào Activity chính");
  const config = read("app.config.js");
  assert.match(config, /with-android-activity-config/, "plugin được bật");
});

test("Ảnh trong chat dùng thư viện ảnh trong app, không dùng hộp thoại hệ thống", () => {
  const picker = read("src/components/PhotoPicker.tsx");
  assert.match(picker, /expo-camera/, "chụp ảnh ngay trong app");
  assert.match(picker, /listPhotos/, "đọc thư viện ảnh của máy");
  assert.match(picker, /takePictureAsync/);
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.equal(
    chat.includes("expo-image-picker"),
    false,
    "không còn gọi hộp chọn ảnh hệ thống trong màn hình chat",
  );
  const settings = read("src/screens/local/SettingsLocal.tsx");
  assert.equal(
    settings.includes("expo-image-picker"),
    false,
    "đổi ảnh đại diện cũng dùng thư viện trong app",
  );
  assert.match(settings, /PhotoPicker/);
  const media = read("src/services/media.ts");
  assert.match(media, /saveToLibraryAsync/, "lưu ảnh về thư viện ảnh của máy");
  assert.match(
    media,
    /shareAsync/,
    "máy thiếu quyền thì mở bảng chia sẻ để lưu",
  );
});

test("Tin nhắn mới: chấm đang gõ, cảm xúc và thu hồi đi qua kênh ghép nối", () => {
  const app = read("App.tsx");
  assert.match(app, /kind: "typing"/, "gửi tín hiệu đang nhập");
  assert.match(app, /kind === "typing"/, "nhận tín hiệu đang nhập");
  assert.match(app, /kind: "chatReact"/);
  assert.match(app, /kind === "chatReact"/);
  assert.match(app, /kind: "chatRecall"/);
  assert.match(app, /kind === "chatRecall"/);
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.match(chat, /partnerTyping/, "hiện ba chấm trong khung chat");
  assert.match(chat, /SwipeRow/, "vuốt để trả lời");
  assert.match(
    chat,
    /PanResponder/,
    "vuốt bằng công cụ sẵn có của React Native",
  );
  assert.match(chat, /Thu hồi \(xoá cả hai bên\)/, "có nút thu hồi");
  assert.match(chat, /Lưu ảnh về máy/, "có nút lưu ảnh người thương gửi");
  assert.match(
    chat,
    /Giữ và nói… nhả ra là gửi/,
    "giữ nút mic để gửi tin thoại",
  );
  assert.match(chat, /minHeight: 160/, "thanh nhập liệu dạng viên thuốc");
});

test("Thông báo: bấm là vào đoạn chat, có nút Trả lời ngay trên thông báo", () => {
  const notify = read("src/services/localnotify.ts");
  assert.match(
    notify,
    /setNotificationCategoryAsync/,
    "tạo nhóm nút trên thông báo",
  );
  assert.match(notify, /tra-loi/, "nút Trả lời");
  assert.match(notify, /textInput/, "ô nhập trả lời nhanh");
  assert.match(
    notify,
    /open: chat \? "chat" : "alerts"/,
    "đánh dấu mở thẳng đoạn chat",
  );
  const app = read("App.tsx");
  assert.match(
    app,
    /addNotificationResponseReceivedListener/,
    "nghe người dùng bấm thông báo",
  );
  assert.match(app, /action === "tra-loi" && quick/, "gửi tin trả lời nhanh");
  assert.match(app, /setTab\("chat"\)/, "mở thẳng đoạn chat");
});

test("Giữ kết nối khi tắt màn hình: dịch vụ chạy nổi kiểu dataSync + công tắc", () => {
  const service = read("src/services/relayService.ts");
  assert.match(
    service,
    /FOREGROUND_SERVICE_TYPE_DATA_SYNC|FOREGROUND_SERVICE_TYPE_DATA_SYNC \?\?/,
  );
  assert.match(service, /asForegroundService: true/);
  assert.match(service, /tat-giu-ket-noi/, "có nút Tắt trên thông báo");
  assert.match(service, /stopForegroundService/);
  const plugin = read("plugins/with-call-foreground-service.js");
  assert.match(
    plugin,
    /microphone\|dataSync/,
    "manifest khai cả hai kiểu dịch vụ",
  );
  const core = read("src/services/notifeeCore.ts");
  assert.match(core, /registerForegroundService/, "một chỗ đăng ký duy nhất");
  assert.match(
    core,
    /onForegroundEvent/,
    "chia sự kiện cho cả cuộc gọi và giữ kết nối",
  );
  const config = read("app.config.js");
  assert.match(config, /FOREGROUND_SERVICE_DATA_SYNC/);
  assert.match(config, /POST_NOTIFICATIONS/);
  const app = read("App.tsx");
  assert.match(app, /startRelayService/, "bật dịch vụ khi người dùng muốn");
  assert.match(
    app,
    /keepAlive: false/,
    "bấm Tắt trên thông báo là tắt công tắc",
  );
  const settings = read("src/screens/local/SettingsLocal.tsx");
  assert.match(settings, /Giữ kết nối khi tắt màn hình/);
});

test("Trái tim đập theo giọng nói: lấy mức tiếng từ track WebRTC", () => {
  const call = read("src/services/rtcCall.ts");
  assert.match(call, /audioLevelFromReport/, "đọc audioLevel thật của WebRTC");
  assert.match(
    call,
    /audioLevelFromBytes/,
    "máy ảo thiếu số liệu thì ước lượng",
  );
  assert.match(call, /level: this.lastLevel/, "báo mức tiếng cho giao diện");
  const screen = read("src/screens/local/CallLocal.tsx");
  assert.match(screen, /rtcAudio\.level/, "màn hình gọi dùng mức tiếng");
  assert.match(screen, /heartScale/, "trái tim to nhỏ theo giọng nói");
  assert.match(screen, /size=\{80\}/, "nút Cúp máy to, dễ bấm");
  assert.match(screen, /size=\{68\}/, "nút mic to trong hình tròn");
});

test("Đổi tên app thành Mật Mã Yêu và gói mới 1.16.0 (bản dựng 18)", () => {
  const config = read("app.config.js");
  assert.match(config, /name: "Mật Mã Yêu"/);
  assert.equal(
    config.includes("expo-media-library"),
    true,
    "thư viện ảnh được bật",
  );
  assert.equal(config.includes("granularPermissions"), true);
  const app = read("App.tsx");
  assert.equal(
    app.includes("Hai Trái Tim"),
    false,
    "không còn tên cũ trong giao diện",
  );
  assert.match(app, /Mật Mã Yêu/);
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["expo-media-library"], "~18.2.1");
});
