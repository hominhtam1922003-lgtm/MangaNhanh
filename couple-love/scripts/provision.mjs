import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
const required = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
];
for (const key of required)
  if (!process.env[key])
    throw new Error(
      `Thiếu biến môi trường ${key}. Không gửi giá trị bí mật vào chat.`,
    );
const secret =
  process.env.CRON_SECRET || crypto.randomBytes(32).toString("hex");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
});
await client.connect();
try {
  const check = await client.query(
    "select to_regclass('public.couples') as existing",
  );
  if (!check.rows[0].existing)
    await client.query(
      fs.readFileSync("supabase/migrations/001_love.sql", "utf8"),
    );
  await client.query(
    "create extension if not exists pg_cron with schema pg_catalog; create extension if not exists pg_net with schema extensions;",
  );
  await client.query(
    "select vault.create_secret($1,'love_cron_secret') where not exists(select 1 from vault.decrypted_secrets where name='love_cron_secret')",
    [secret],
  );
  await client.query(
    "select vault.update_secret(id,$1) from vault.decrypted_secrets where name='love_cron_secret'",
    [secret],
  );
  const endpoint =
    process.env.SUPABASE_URL.replace(/\/$/, "") +
    "/functions/v1/dispatch-notifications";
  await client.query(
    "select vault.create_secret($1,'love_dispatch_url') where not exists(select 1 from vault.decrypted_secrets where name='love_dispatch_url')",
    [endpoint],
  );
  await client.query(
    "select vault.update_secret(id,$1) from vault.decrypted_secrets where name='love_dispatch_url'",
    [endpoint],
  );
  await client.query(
    `select cron.unschedule(jobid) from cron.job where jobname='love-dual-reminders'`,
  );
  await client.query(
    `select cron.schedule('love-dual-reminders','*/5 * * * *', $$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name='love_dispatch_url' limit 1),headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='love_cron_secret' limit 1)),body := '{}'::jsonb,timeout_milliseconds := 10000);$$)`,
  );
} finally {
  await client.end();
}
for (const args of [
  [
    "supabase",
    "secrets",
    "set",
    `CRON_SECRET=${secret}`,
    "--project-ref",
    process.env.SUPABASE_PROJECT_REF,
  ],
  [
    "supabase",
    "functions",
    "deploy",
    "dispatch-notifications",
    "--project-ref",
    process.env.SUPABASE_PROJECT_REF,
    "--no-verify-jwt",
  ],
]) {
  const result = spawnSync("npx", args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("Đã triển khai dữ liệu, bảo mật và lịch thông báo kép.");
