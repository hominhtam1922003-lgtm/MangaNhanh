const fs = require("fs");

// ── Dự án ghép nối (Supabase) ─────────────────────────────────────────────────
// Khoá publishable là khoá công khai; quyền thật do RLS trên máy chủ quyết định.
const SUPABASE_URL = "https://nbbopfvsthuopiopupqd.supabase.co";
const SUPABASE_KEY = "sb_publishable_ycuVrcaQYdRT8mgQx5vypg_-ir0JLv6";
function sameHost(candidate) {
  try {
    return new URL(candidate).hostname === new URL(SUPABASE_URL).hostname;
  } catch {
    return false;
  }
}
function supabaseUrl() {
  const fromEnv = String(process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  if (fromEnv && !sameHost(fromEnv))
    console.warn(
      "Cảnh báo: EXPO_PUBLIC_SUPABASE_URL trỏ " +
        fromEnv +
        " nhưng bản dựng dùng " +
        SUPABASE_URL +
        " để bảo đảm đúng dự án ghép nối.",
    );
  return SUPABASE_URL;
}
function supabaseKey() {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  ).trim();
  if (fromEnv.startsWith("sb_secret_") || fromEnv.startsWith("eyJ"))
    return SUPABASE_KEY;
  return fromEnv || SUPABASE_KEY;
}
module.exports = {
  expo: {
    name: "Mật Mã Yêu",
    slug: "hai-trai-tim",
    version: "1.18.8",
    orientation: "portrait",
    scheme: "haitraitim",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    icon: "./assets/icon.png",
    android: {
      package: "vn.haitraitim.app",
      // WebRTC (cuộc gọi tiếng trực tiếp) cần đổi chế độ âm thanh và theo dõi
      // mạng của máy; RECORD_AUDIO do plugin expo-audio thêm sẵn.
      permissions: [
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.CHANGE_NETWORK_STATE",
        // Cuộc gọi vẫn chạy khi tắt màn hình: dịch vụ chạy nổi (micro) + quyền
        // giữ máy thức. RECORD_AUDIO do plugin expo-audio thêm sẵn.
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MICROPHONE",
        // Giữ kết nối khi app ở chế độ nền để tin nhắn vẫn nổi thông báo.
        "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
        "android.permission.WAKE_LOCK",
        // Thông báo tin nhắn trên Android 13+ (hệ thống vẫn hỏi người dùng).
        "android.permission.POST_NOTIFICATIONS",
      ],
      // 1.18.8: tính năng Nuôi Thú Cưng Ảo (Couple Pet phong cách Widgetable),
      // thay tab Nhật ký & Chăm sóc bằng Thú Cưng, sửa triệt để hiển thị Video
      // Call (remoteStream.toURL) và tách đối xứng nút Từ chối / Nghe.
      versionCode: 28,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#fff1f2",
      },
      ...(fs.existsSync("google-services.json")
        ? { googleServicesFile: "./google-services.json" }
        : {}),
    },
    ios: {
      bundleIdentifier: "vn.haitraitim.app",
      supportsTablet: true,
      icon: "./assets/icon.png",
      infoPlist: {
        // Mở thông báo tin nhắn là vào thẳng đoạn chat để trả lời.
        NSCameraUsageDescription: "Chụp ảnh để gửi cho người thương.",
        NSPhotoLibraryUsageDescription:
          "Chọn ảnh trong máy để gửi cho người thương.",
        NSPhotoLibraryAddUsageDescription:
          "Lưu ảnh người thương gửi vào thư viện ảnh của bạn.",
        NSFaceIDUsageDescription:
          "Xác thực để mở nhật ký và dữ liệu riêng tư của bạn.",
        // WebRTC tự tìm đường nối trực tiếp giữa hai máy trong cùng mạng Wi-Fi.
        NSLocalNetworkUsageDescription:
          "Tìm máy của người thương trong cùng mạng Wi-Fi để nối cuộc gọi trực tiếp.",
        // Chạy nền: iOS chỉ cho thu/phát tiếng tiếp khi khai báo đúng hai chế độ
        // này. (App cài bằng Apple ID miễn phí / Sideloadly, không nộp App Store.)
        UIBackgroundModes: ["audio", "voip"],
      },
    },
    plugins: [
      "expo-asset",
      [
        "expo-audio",
        {
          microphonePermission:
            "Ghi âm tin thoại gửi cho người thương của bạn.",
        },
      ],
      "expo-secure-store",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Gửi vị trí đang ở cho người thương khi bạn bấm nút vị trí trong mục Tin nhắn.",
        },
      ],
      "expo-local-authentication",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#fff1f2",
          image: "./assets/splash-icon.png",
          imageWidth: 220,
          resizeMode: "contain",
        },
      ],
      [
        "expo-notifications",
        { icon: "./assets/notification-icon.png", color: "#e64980" },
      ],
      // Ảnh: chọn ảnh trong máy (thư viện ảnh của hệ thống) và lưu ảnh về máy.
      [
        "expo-media-library",
        {
          photosPermission:
            "Chọn ảnh trong máy để gửi cho người thương và lưu ảnh người thương gửi.",
          savePhotosPermission:
            "Lưu ảnh người thương gửi vào thư viện ảnh của bạn.",
          granularPermissions: ["photo"],
        },
      ],
      // Đổi dịch vụ chạy nổi của Notifee sang kiểu "microphone" (cuộc gọi khi
      // tắt màn hình) và "dataSync" (giữ kết nối để nhận tin nhắn khi ở nền).
      "./plugins/with-call-foreground-service",
      // Không để Android huỷ Activity khi đổi cỡ chữ / ngôn ngữ / sáng tối —
      // nếu không, hộp chọn ảnh và máy ảnh sẽ chết với lỗi
      // "unregistered ActivityResultLauncher" (xem tệp plugin để rõ chi tiết).
      "./plugins/with-android-activity-config",
      [
        "expo-image-picker",
        {
          photosPermission: "Chọn ảnh đại diện hoặc ảnh kỷ niệm của hai bạn.",
          cameraPermission: "Chụp ảnh kỷ niệm.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Quét mã QR để ghép đôi với người thương.",
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      "@react-native-community/datetimepicker",
    ],
    extra: {
      // Dự án ghép nối của bản 1.18.0. Khoá dưới đây là khoá CÔNG KHAI
      // (publishable/anon) — Supabase thiết kế để khoá này nằm trong app; quyền
      // hạn thật do RLS quyết định nên đây KHÔNG phải bí mật. Giá trị trong bản
      // dựng luôn thắng biến môi trường: nếu kho secret cũ trên GitHub còn trỏ
      // dự án khác thì bản dựng vẫn dùng đúng dự án này, chỉ ghi cảnh báo ở CI.
      supabaseUrl: supabaseUrl(),
      supabaseKey: supabaseKey(),
      eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "" },
    },
  },
};
