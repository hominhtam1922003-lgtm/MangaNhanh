const fs = require("fs");
if (!fs.existsSync("android-build.log")) process.exit(0);
let text = fs
  .readFileSync("android-build.log", "utf8")
  .replace(/\x1b\[[0-9;]*m/g, "");
for (const [key, value] of Object.entries(process.env))
  if (/TOKEN|PASSWORD|SECRET|KEYSTORE|SUPABASE/.test(key) && value.length > 5)
    text = text.split(value).join("[ĐÃ CHE]");
text = text.split("\n").slice(-120).join("\n").slice(-50000);
fs.writeFileSync(
  "/tmp/love-build-check.json",
  JSON.stringify({
    name: "Chẩn đoán build Hai Trái Tim",
    head_sha: process.env.GITHUB_SHA,
    status: "completed",
    conclusion: "failure",
    output: {
      title: "Nhật ký Gradle đã che bí mật",
      summary: "APK chưa build thành công. Xem lỗi để sửa cấu hình.",
      text: "```text\n" + text + "\n```",
    },
  }),
);
