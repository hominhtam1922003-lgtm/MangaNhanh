// Kiểm tra mọi khối `run:` trong .github/workflows bằng `bash -n` và soi xem
// mỗi heredoc (<<EOF …) có dòng kết thúc hay không.
//
// Vì sao cần: khối `run: |` là YAML văn bản khối — YAML cắt phần thụt lề chung,
// nên dòng kết thúc `EOF` trong file phải thụt lề đúng bằng phần thân. Chỉ cần
// lệch một chút là heredoc không bao giờ đóng (bash chỉ cảnh báo, không báo lỗi),
// cả đoạn script còn lại bị ăn vào ghi chú của Release và lần chạy hỏng ngay với
// 0 job. Script này bắt đúng lỗi đó trước khi đẩy lên GitHub.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), "../.github/workflows");

/** Tách các khối `run: |` / `run: >` ra thành script bash riêng. */
function extractRuns(text) {
  const lines = text.split("\n");
  const found = [];
  lines.forEach((line, index) => {
    const match = /^(\s*)(?:- )?run:\s*([|>])[+-]?\s*$/.exec(line);
    if (!match) return;
    const keyIndent = match[1].length;
    const body = [];
    for (let i = index + 1; i < lines.length; i += 1) {
      const current = lines[i];
      if (current.trim() === "") {
        body.push(current);
        continue;
      }
      const indent = current.length - current.trimStart().length;
      if (indent <= keyIndent) break;
      body.push(current);
    }
    while (body.length && body[0].trim() === "") body.shift();
    while (body.length && body[body.length - 1].trim() === "") body.pop();
    if (!body.length) return;
    const base = Math.min(
      ...body
        .filter((l) => l.trim())
        .map((l) => l.length - l.trimStart().length),
    );
    const script = body.map((l) => (l.trim() ? l.slice(base) : "")).join("\n");
    found.push({ line: index + 1, script });
  });
  return found;
}

let failures = 0;
const files = readdirSync(dir).filter((name) => name.endsWith(".yml"));

for (const name of files) {
  const file = path.join(dir, name);
  const text = readFileSync(file, "utf8");
  for (const { line, script } of extractRuns(text)) {
    try {
      execFileSync("bash", ["-n"], {
        input: script,
        stdio: ["pipe", "ignore", "pipe"],
      });
    } catch (error) {
      failures += 1;
      const detail = String(error.stderr ?? error.message)
        .trim()
        .slice(0, 200);
      console.error(
        `LỖI cú pháp bash: .github/workflows/${name}:${line} → ${detail}`,
      );
    }
    for (const match of script.matchAll(
      /<<-?["']?([A-Za-z_][A-Za-z0-9_]*)["']?/g,
    )) {
      const marker = match[1];
      const tail = script.slice(match.index + match[0].length);
      if (!new RegExp(`^${marker}\\s*$`, "m").test(tail)) {
        failures += 1;
        console.error(
          `LỖI heredoc: .github/workflows/${name}:${line} → <<${marker} thiếu dòng kết thúc`,
        );
      }
    }
  }
}

if (failures) {
  console.error(`Workflow có ${failures} lỗi.`);
  process.exit(1);
}
console.log(
  `Đã kiểm tra ${files.length} workflow: cú pháp bash và heredoc đều ổn.`,
);
