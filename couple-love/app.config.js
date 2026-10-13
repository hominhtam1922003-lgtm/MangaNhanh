const fs = require("fs");
module.exports = {
  expo: {
    name: "Hai Trái Tim",
    slug: "hai-trai-tim",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "haitraitim",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    android: {
      package: "vn.haitraitim.app",
      versionCode: 2,
      ...(fs.existsSync("google-services.json")
        ? { googleServicesFile: "./google-services.json" }
        : {}),
    },
    ios: {
      bundleIdentifier: "vn.haitraitim.app",
      supportsTablet: true,
      infoPlist: {
        NSFaceIDUsageDescription:
          "Xác thực để mở nhật ký và dữ liệu riêng tư của bạn.",
      },
    },
    plugins: [
      "expo-asset",
      "expo-secure-store",
      "expo-local-authentication",
      ["expo-notifications", { color: "#e64980" }],
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
