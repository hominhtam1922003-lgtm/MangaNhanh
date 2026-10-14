/**
 * Vì sao cần plugin này — lỗi "Chưa gửi được ảnh" mà app từng gặp:
 *
 * Trên Android, expo-image-picker (và mọi thư viện mở hộp thoại hệ thống như
 * hộp chọn ảnh, máy ảnh, chọn thư mục) đăng ký một `ActivityResultLauncher`
 * gắn với Activity đang chạy. Khi Android HUỶ rồi TẠO LẠI Activity vì một thay
 * đổi cấu hình (người dùng đổi cỡ chữ, đổi ngôn ngữ, đổi chế độ sáng/tối, đổi
 * mật độ màn hình…), launcher cũ bị bỏ đăng ký nhưng không đăng ký lại — từ đó
 * mọi lần mở hộp chọn ảnh đều lỗi:
 *
 *   java.lang.IllegalStateException: Attempting to launch an unregistered
 *   ActivityResultLauncher with contract …ImageLibraryContract…
 *
 * Cách chữa chắc ăn nhất (và cũng là cách React Native khuyên dùng): khai báo
 * các thay đổi cấu hình đó trong `android:configChanges` của MainActivity để
 * Android KHÔNG huỷ Activity nữa — app tự vẽ lại giao diện khi cấu hình đổi.
 * Không còn huỷ Activity thì không còn launcher chết, hộp chọn ảnh và máy ảnh
 * luôn mở được.
 *
 * Xem: expo/expo#50386, expo/expo#19512, expo/expo#41252.
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
      // Chỉ đụng vào Activity chính của app (MainActivity).
      if (!name.endsWith("MainActivity")) continue;
      activity.$["android:configChanges"] = CONFIG_CHANGES;
      patched += 1;
    }
    if (patched === 0)
      console.warn(
        "[with-android-activity-config] Không thấy MainActivity trong AndroidManifest — hộp chọn ảnh có thể lỗi sau khi đổi cỡ chữ/ngôn ngữ.",
      );
    return result;
  });
};
