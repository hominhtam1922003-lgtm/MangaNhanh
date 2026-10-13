const fs = require("fs");
const names = [
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];
const present = names.filter((n) => process.env[n]);
if (present.length && present.length !== names.length)
  throw new Error("Cần cung cấp đủ bốn secret ký Android.");
if (!present.length) {
  console.log(
    "APK thử nghiệm: sử dụng chữ ký debug của mẫu Expo, không dành phát hành lên cửa hàng.",
  );
  process.exit(0);
}
fs.writeFileSync(
  "android/app/release.jks",
  Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, "base64"),
  { mode: 0o600 },
);
const path = "android/app/build.gradle";
let text = fs.readFileSync(path, "utf8");
text = text.replace(
  /(\s*)buildTypes\s*\{/,
  `\n    signingConfigs {\n        loveRelease {\n            storeFile file('release.jks')\n            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')\n            keyAlias System.getenv('ANDROID_KEY_ALIAS')\n            keyPassword System.getenv('ANDROID_KEY_PASSWORD')\n        }\n    }\n    buildTypes {`,
);
const old = text;
text = text.replace(
  /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
  "$1signingConfig signingConfigs.loveRelease",
);
if (old === text)
  throw new Error(
    "Không tìm thấy cấu hình chữ ký release; hãy kiểm tra mẫu Expo.",
  );
fs.writeFileSync(path, text);
