const fs = require("fs");
module.exports = {
  expo: {
    name: "Hai Trái Tim",
    slug: "hai-trai-tim",
    version: "1.15.0",
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
      ],
      versionCode: 17,
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
        NSFaceIDUsageDescription:
          "Xác thực để mở nhật ký và dữ liệu riêng tư của bạn.",
        // WebRTC tự tìm đường nối trực tiếp giữa hai máy trong cùng mạng Wi-Fi.
        NSLocalNetworkUsageDescription:
          "Tìm máy của người thương trong cùng mạng Wi-Fi để nối cuộc gọi trực tiếp.",
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
