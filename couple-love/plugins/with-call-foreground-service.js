/**
 * Plugin Expo: đổi kiểu dịch vụ chạy nổi của Notifee thành "microphone" và thêm
 * các quyền cần thiết.
 *
 * Vì sao phải viết plugin: Notifee khai dịch vụ `app.notifee.core.ForegroundService`
 * trong thư viện của họ với kiểu mặc định `shortService`. Kiểu đó (a) chỉ sống
 * tối đa ~3 phút nên cuộc gọi dài là tắt, (b) KHÔNG được phép dùng micro khi app
 * ở chế độ nền. Trên Android 14, xin kiểu không nằm trong khai báo của manifest
 * sẽ bị ném lỗi ngay (`foregroundServiceType … is not a subset …`). Vì vậy ta ghi
 * đè thành `microphone` bằng `tools:replace` — đúng cách Notifee hướng dẫn.
 *
 * Quyền thì khai trong `app.config.js` (`android.permissions`) cho dễ đọc:
 * `FOREGROUND_SERVICE` (bắt buộc từ Android 9), `FOREGROUND_SERVICE_MICROPHONE`
 * (bắt buộc từ Android 14), `WAKE_LOCK`; `RECORD_AUDIO` đã có sẵn từ plugin
 * expo-audio. Plugin này chỉ lo phần manifest mà app.config.js không viết được.
 *
 * Chạy tự động trong `expo prebuild` nên APK dựng trên CI cũng có đủ.
 */
const { AndroidConfig, withAndroidManifest } = require("@expo/config-plugins");

const SERVICE_NAME = "app.notifee.core.ForegroundService";
const FGS_TYPE = "microphone";

function withCallForegroundService(config) {
  return withAndroidManifest(config, (current) => {
    const manifest = current.modResults;
    manifest.manifest.$ = manifest.manifest.$ || {};
    if (!manifest.manifest.$["xmlns:tools"]) {
      manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }
    const application =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.service = application.service || [];
    const attributes = {
      "android:name": SERVICE_NAME,
      "android:exported": "false",
      "android:foregroundServiceType": FGS_TYPE,
      "tools:replace": "android:foregroundServiceType",
    };
    const existing = application.service.find(
      (service) => service?.$?.["android:name"] === SERVICE_NAME,
    );
    if (existing) existing.$ = { ...existing.$, ...attributes };
    else application.service.push({ $: attributes });
    return current;
  });
}

module.exports = withCallForegroundService;
