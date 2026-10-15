/**
 * Plugin Expo:
 * 1. Đổi kiểu dịch vụ chạy nổi của Notifee thành "microphone|dataSync" và thêm
 *    các quyền cần thiết trên Android 14+.
 * 2. Vá trực tiếp `expo-audio` trên cả Android (`AudioModule.kt`) và iOS
 *    (`AudioRecords.swift` + `AudioModule.swift`) khi chạy `expo prebuild` để
 *    nút Loa ngoài (Speakerphone) / Loa thoại trong (Earpiece) chuyển luồng âm
 *    thanh phần cứng 100% chính xác trong cuộc gọi WebRTC (kể cả Android 12–15
 *    dùng `setCommunicationDevice`).
 */
const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
} = require("@expo/config-plugins");

const SERVICE_NAME = "app.notifee.core.ForegroundService";
/**
 * Hai kiểu dịch vụ chạy nổi mà app dùng:
 * · `microphone` — cuộc gọi tiếp tục thu tiếng khi tắt màn hình (1.15.0);
 * · `dataSync`   — giữ kết nối để tin nhắn vẫn nổi thông báo khi app ở chế độ
 *   nền / tắt màn hình (1.16.0, bật trong Cài đặt).
 */
const FGS_TYPE = "microphone|dataSync";

function patchExpoAudioAndroid(projectRoot) {
  const ktFile = path.join(
    projectRoot,
    "node_modules",
    "expo-audio",
    "android",
    "src",
    "main",
    "java",
    "expo",
    "modules",
    "audio",
    "AudioModule.kt",
  );
  if (!fs.existsSync(ktFile)) return;
  const src = fs.readFileSync(ktFile, "utf8");
  if (src.includes("availableCommunicationDevices")) return;
  const oldFn = `  @Suppress("DEPRECATION")
  private fun updatePlaySoundThroughEarpiece(playThroughEarpiece: Boolean) {
    audioManager.mode = if (playThroughEarpiece) AudioManager.MODE_IN_COMMUNICATION else AudioManager.MODE_NORMAL
    audioManager.setSpeakerphoneOn(!playThroughEarpiece)
  }`;
  const newFn = `  @Suppress("DEPRECATION")
  private fun updatePlaySoundThroughEarpiece(playThroughEarpiece: Boolean) {
    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
    audioManager.isSpeakerphoneOn = !playThroughEarpiece
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
      try {
        val targetType = if (playThroughEarpiece) {
          android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
        } else {
          android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
        }
        val device = audioManager.availableCommunicationDevices.firstOrNull { it.type == targetType }
        if (device != null) {
          audioManager.setCommunicationDevice(device)
        } else if (!playThroughEarpiece) {
          audioManager.clearCommunicationDevice()
        }
      } catch (_: Throwable) {}
    }
  }`;
  if (src.includes(oldFn)) {
    fs.writeFileSync(ktFile, src.replace(oldFn, newFn), "utf8");
  }
}

function patchExpoAudioIos(projectRoot) {
  const recordsFile = path.join(
    projectRoot,
    "node_modules",
    "expo-audio",
    "ios",
    "AudioRecords.swift",
  );
  const moduleFile = path.join(
    projectRoot,
    "node_modules",
    "expo-audio",
    "ios",
    "AudioModule.swift",
  );
  if (fs.existsSync(recordsFile)) {
    const rec = fs.readFileSync(recordsFile, "utf8");
    if (!rec.includes("shouldRouteThroughEarpiece")) {
      const updated = rec.replace(
        "@Field var shouldPlayInBackground: Bool = false",
        "@Field var shouldPlayInBackground: Bool = false\n  @Field var shouldRouteThroughEarpiece: Bool = false",
      );
      fs.writeFileSync(recordsFile, updated, "utf8");
    }
  }
  if (fs.existsSync(moduleFile)) {
    const mod = fs.readFileSync(moduleFile, "utf8");
    if (!mod.includes("overrideOutputAudioPort")) {
      const target = `      if category == .playAndRecord {
        categoryOptions.insert(.allowBluetooth)
      }`;
      const replacement = `      if category == .playAndRecord {
        categoryOptions.insert(.allowBluetooth)
        if !mode.shouldRouteThroughEarpiece {
          categoryOptions.insert(.defaultToSpeaker)
        }
      }`;
      let next = mod.replace(target, replacement);
      next = next.replace(
        "try session.setCategory(category, options: sessionOptions)",
        "try session.setCategory(category, options: sessionOptions)\n    if category == .playAndRecord {\n      try? session.overrideOutputAudioPort(mode.shouldRouteThroughEarpiece ? .none : .speaker)\n    }",
      );
      fs.writeFileSync(moduleFile, next, "utf8");
    }
  }
}

function withCallForegroundService(config) {
  config = withAndroidManifest(config, (current) => {
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
      "android:stopWithTask": "false",
      "android:foregroundServiceType": FGS_TYPE,
      "tools:replace": "android:foregroundServiceType",
    };
    const existing = application.service.find(
      (service) => service?.$?.["android:name"] === SERVICE_NAME,
    );
    if (existing) existing.$ = { ...existing.$, ...attributes };
    else application.service.push({ $: attributes });

    // Đảm bảo có đủ quyền hiển thị cuộc gọi toàn màn hình trên màn hình khoá
    // (USE_FULL_SCREEN_INTENT) và giữ máy thức (WAKE_LOCK / VIBRATE).
    manifest.manifest["uses-permission"] =
      manifest.manifest["uses-permission"] || [];
    const requiredPerms = [
      "android.permission.USE_FULL_SCREEN_INTENT",
      "android.permission.WAKE_LOCK",
      "android.permission.VIBRATE",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    ];
    for (const perm of requiredPerms) {
      const hasPerm = manifest.manifest["uses-permission"].some(
        (p) => p?.$?.["android:name"] === perm,
      );
      if (!hasPerm) {
        manifest.manifest["uses-permission"].push({
          $: { "android:name": perm },
        });
      }
    }
    return current;
  });

  config = withDangerousMod(config, [
    "android",
    async (current) => {
      patchExpoAudioAndroid(current.modRequest.projectRoot);
      return current;
    },
  ]);

  config = withInfoPlist(config, (current) => {
    const existing = Array.isArray(current.modResults.UIBackgroundModes)
      ? current.modResults.UIBackgroundModes
      : [];
    const modes = new Set([
      ...existing,
      "audio",
      "voip",
      "fetch",
      "remote-notification",
    ]);
    current.modResults.UIBackgroundModes = Array.from(modes);
    return current;
  });

  config = withDangerousMod(config, [
    "ios",
    async (current) => {
      patchExpoAudioIos(current.modRequest.projectRoot);
      return current;
    },
  ]);

  return config;
}

module.exports = withCallForegroundService;
