import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEMES } from "../src/logic/themes.mjs";
import {
  VOICE_LIMIT_BYTES,
  PHOTO_LIMIT_BYTES,
} from "../src/services/momentTransfer.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Bảng tin nhắn cố định: tin mới trôi lên, kéo xem lại như Messenger/Zalo", () => {
  const source = read("src/screens/local/ChatLocal.tsx");
  assert.match(source, /<FlatList/, "bảng tin phải là danh sách cuộn riêng");
  assert.doesNotMatch(
    source,
    /\binverted\b/,
    "không lật danh sách (Android lật cả chữ trong ô rỗng)",
  );
  assert.match(source, /scrollToEnd/, "có tin mới thì tự cuộn xuống cuối");
  assert.match(source, /const ordered/, "hiển thị theo thứ tự cũ → mới");
  assert.doesNotMatch(
    source,
    /messages\.map\(/,
    "không vẽ hết tin trong khung giãn dài theo số dòng",
  );
  assert.match(source, /busyRef/, "chặn bấm gửi hai lần cùng một tin");
  const app = read("App.tsx");
  assert.match(
    app,
    /tab === "chat" \? \(\s*<View[\s\S]{0,160}flex: 1/,
    "khung Tin nhắn chiếm hết chiều cao nên ô nhắn tin đứng yên, chỉ tin nhắn cuộn",
  );
  assert.doesNotMatch(
    app,
    /tab === "chat" \? \(\s*<ChatLocal/,
    "bảng tin không nằm trong khung cuộn chung của cả màn hình",
  );
  assert.match(
    app,
    /tab === "chat" \? null : \(\s*<ScrollView/,
    "màn Tin nhắn và khung cuộn chung không bao giờ cùng dựng (tránh dính màn hình)",
  );
});

test("Thông báo: hỏi quyền khi mở app, kênh riêng mức cao nhất cho tin nhắn", () => {
  const notify = read("src/services/localnotify.ts");
  assert.match(notify, /setNotificationHandler/);
  assert.match(notify, /love-messages/);
  assert.match(notify, /AndroidImportance\.MAX/);
  assert.match(notify, /askNotificationPermission/);
  const app = read("App.tsx");
  assert.match(app, /askNotificationPermission\(\)/);
  assert.match(app, /chat = true/, "thông báo tin nhắn dùng kênh tin nhắn");
  assert.match(app, /notificationPermission/, "hiện cảnh báo khi quyền bị tắt");
});

test("Chủ đề có hoạ tiết nền thật, không chỉ đổi màu chữ", () => {
  for (const theme of THEMES)
    assert.equal(
      Array.isArray(theme.deco) && theme.deco.length >= 3,
      true,
      `${theme.id}: thiếu hoạ tiết nền`,
    );
  const ui = read("src/components/UI.tsx");
  assert.match(ui, /ThemeDeco/);
  assert.match(read("App.tsx"), /<ThemeDeco/);
});

test("Tin thoại: hạn mức riêng và tự xin gửi lại khi máy kia còn thiếu tệp", () => {
  assert.equal(VOICE_LIMIT_BYTES > PHOTO_LIMIT_BYTES, true);
  const app = read("App.tsx");
  assert.match(app, /missingVoiceIds/);
  assert.match(app, /shouldAsk\(/, "vẫn thiếu tệp thì xin lại, không bỏ qua");
  assert.match(app, /VOICE_LIMIT_BYTES/);
});
