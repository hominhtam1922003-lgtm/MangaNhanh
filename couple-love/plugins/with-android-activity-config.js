/**
 * Vì sao cần plugin này — lỗi "Chưa gửi được ảnh" + đánh thức màn hình khi có
 * cuộc gọi đến:
 *
 * 1. Trên Android, expo-image-picker đăng ký `ActivityResultLauncher` gắn với
 *    Activity đang chạy. Khai báo đầy đủ `android:configChanges` để Android
 *    KHÔNG huỷ MainActivity khi đổi cỡ chữ / ngôn ngữ / sáng tối.
 * 2. Bật `android:showWhenLocked="true"` và `android:turnScreenOn="true"` trên
 *    MainActivity để khi có cuộc gọi đến lúc đang tắt/khoá màn hình, hệ thống
 *    đánh thức màn hình và hiển thị giao diện cuộc gọi Full-screen ngay lập tức.
 */
const { withAndroidManifest } = require("expo/config-plugins");

/** Mọi thứ Android có thể đổi lúc đang chạy, để app tự xử lý thay vì bị khởi động lại. */
const CONFIG_CHANGES = [
  "mcc",
  "mnc",
  "locale",
  "layoutDirection",
  "fontScale",
  "density",
  "touchscreen",
  "keyboard",
  "keyboardHidden",
  "navigation",
  "orientation",
  "screenLayout",
  "screenSize",
  "smallestScreenSize",
  "uiMode",
  "colorMode",
].join("|");

module.exports = function withAndroidActivityConfig(config) {
  return withAndroidManifest(config, (result) => {
    const application = result.modResults?.manifest?.application?.[0];
    const activities = application?.activity ?? [];
    let patched = 0;
    for (const activity of activities) {
      const name = String(activity?.$?.["android:name"] ?? "");
      if (!name.endsWith("MainActivity")) continue;
      activity.$["android:configChanges"] = CONFIG_CHANGES;
      activity.$["android:showWhenLocked"] = "true";
      activity.$["android:turnScreenOn"] = "true";
      patched += 1;
    }
    if (patched === 0)
      console.warn(
        "[with-android-activity-config] Không thấy MainActivity trong AndroidManifest — hộp chọn ảnh có thể lỗi sau khi đổi cỡ chữ/ngôn ngữ.",
      );
    return result;
  });
};
