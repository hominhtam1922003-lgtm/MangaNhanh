// Gom nhật ký thất bại thành một check run để đọc được ngay trên GitHub.
// Nhật ký Gradle nằm ở android-build.log; nhật ký kiểm tra (test/tsc/format)
// nằm ở /tmp/check.log do bước "Kiểm tra logic, RLS PostgreSQL và TypeScript"
// ghi lại. Cả hai đều được che bí mật trước khi đăng.
const fs = require("fs");
const sections = [];
function sanitize(text) {
  let safe = text.replace(/\x1b\[[0-9;]*m/g, "");
  for (const [key, value] of Object.entries(process.env))
    if (
      /TOKEN|PASSWORD|SECRET|KEYSTORE|SUPABASE/.test(key) &&
      typeof value === "string" &&
      value.length > 5
    )
      safe = safe.split(value).join("[ĐÃ CHE]");
  return safe;
}
function tail(text, lines, chars) {
  return text.split("\n").slice(-lines).join("\n").slice(-chars);
}
if (fs.existsSync("/tmp/check.log")) {
  const checkLog = sanitize(fs.readFileSync("/tmp/check.log", "utf8"));
  sections.push(
    "## Nhật ký kiểm tra (test / TypeScript / định dạng)\n\n```text\n" +
      tail(checkLog, 200, 60000) +
      "\n```",
  );
}
if (fs.existsSync("android-build.log")) {
  const buildLog = sanitize(fs.readFileSync("android-build.log", "utf8"));
  sections.push(
    "## Nhật ký Gradle\n\n```text\n" + tail(buildLog, 120, 50000) + "\n```",
  );
}
if (!sections.length) process.exit(0);
fs.writeFileSync(
  "/tmp/love-build-check.json",
  JSON.stringify({
    name: "Chẩn đoán build Hai Trái Tim",
    head_sha: process.env.GITHUB_SHA,
    status: "completed",
    conclusion: "failure",
    output: {
      title: "Nhật ký thất bại đã che bí mật",
      summary: "APK chưa build thành công. Xem nhật ký để sửa cấu hình.",
      text: sections.join("\n\n"),
    },
  }),
);
