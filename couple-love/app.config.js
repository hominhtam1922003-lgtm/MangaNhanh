const fs = require("fs");
module.exports = {
  expo: {
    name: "Mật Mã Yêu",
    slug: "hai-trai-tim",
    version: "1.16.0",
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
      versionCode: 18,
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
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
      supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
      eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "" },
    },
  },
};
