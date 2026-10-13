import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  C = "33333333-3333-4333-8333-333333333333";
async function fixture() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create schema storage;create schema extensions;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth,storage,extensions to authenticated,anon,service_role;
alter default privileges in schema public grant all on tables to authenticated,anon,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(id));alter table storage.objects enable row level security;grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
create publication supabase_realtime;
`);
  await db.exec(fs.readFileSync("supabase/migrations/001_love.sql", "utf8"));
  await db.exec(`insert into auth.users values('${A}'),('${B}'),('${C}')`);
  return db;
}
async function as(db, uid, sql, args = []) {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    await db.exec("set local role authenticated");
    const r = await db.query(sql, args);
    await db.exec("commit");
    return r.rows;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
async function pair(db) {
  const code = (await as(db, A, "select public.create_pair_code() as value"))[0]
    .value;
  assert.match(code.code, /^\d{6}$/);
  const joined = (
    await as(db, B, "select public.join_pair($1) as value", [code.code])
  )[0].value;
  assert.equal(joined.couple_id, code.couple_id);
  return code;
}
test("Backend: mã dùng một lần, tối đa hai người, người ngoài không đọc hồ sơ", async () => {
  const db = await fixture();
  try {
    const code = await pair(db);
    assert.ok(
      (await as(db, C, "select public.join_pair($1) as value", [code.code]))[0]
        .value.error,
    );
    assert.equal((await as(db, A, "select * from public.profiles")).length, 2);
    assert.equal((await as(db, C, "select * from public.profiles")).length, 1);
    assert.equal((await as(db, C, "select * from public.members")).length, 0);
    await assert.rejects(() =>
      as(db, C, "insert into public.members values($1,$2,now())", [
        code.couple_id,
        C,
      ]),
    );
  } finally {
    await db.close();
  }
});
test("Backend: 8 lần thử và hết hạn mã", async () => {
  const db = await fixture();
  try {
    const code = (
      await as(db, A, "select public.create_pair_code() as value")
    )[0].value;
    await db.exec(
      "update public.pairing_codes set expires_at=now()-interval '1 second'",
    );
    assert.ok(
      (await as(db, B, "select public.join_pair($1) as value", [code.code]))[0]
        .value.error,
    );
    for (let i = 0; i < 7; i++)
      await as(db, B, "select public.join_pair('xxxxxx')");
    assert.match(
      (await as(db, B, "select public.join_pair('123456') as value"))[0].value
        .error,
      /15 phút/,
    );
  } finally {
    await db.close();
  }
});
test("Backend: quyền riêng tư chu kỳ và thu hồi chia sẻ xóa hàng chờ", async () => {
  const db = await fixture();
  try {
    const code = await pair(db);
    await as(
      db,
      A,
      "insert into public.cycles(couple_id,owner_id,last_period,cycle_length,period_length) values($1,$2,current_date,28,5)",
      [code.couple_id, A],
    );
    assert.equal((await as(db, B, "select * from public.cycles")).length, 0);
    await as(db, A, "update public.cycles set shared=true");
    assert.equal((await as(db, B, "select * from public.cycles")).length, 1);
    assert.equal(
      (
        await as(
          db,
          B,
          "update public.cycles set last_period=current_date returning *",
        )
      ).length,
      0,
    );
    assert.equal((await as(db, C, "select * from public.cycles")).length, 0);
    await db.query(
      "insert into public.alerts(recipient_id,couple_id,category,title,body,source_key) values($1,$2,'cycle','Chăm sóc','Lịch','test')",
      [B, code.couple_id],
    );
    assert.equal(
      (await db.query("select * from public.push_jobs")).rows.length,
      1,
    );
    await as(db, A, "update public.cycles set shared=false");
    assert.equal(
      (await db.query("select * from public.push_jobs")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
test("Backend: lời nhắc cảm xúc, chống spam phút, khách chỉ được đánh dấu đã đọc", async () => {
  const db = await fixture();
  try {
    await pair(db);
    await as(db, A, "update public.profiles set mood='sad' where id=$1", [A]);
    await as(db, A, "update public.profiles set mood='tired' where id=$1", [A]);
    assert.equal((await as(db, B, "select * from public.alerts")).length, 1);
    assert.equal((await as(db, A, "select * from public.alerts")).length, 0);
    await assert.rejects(() =>
      as(db, B, "update public.alerts set body='Sửa trái phép'"),
    );
    await as(db, B, "update public.alerts set read_at=now()");
    await assert.rejects(() => as(db, A, "select public.claim_push_jobs()"));
    await as(db, B, "update public.preferences set allow_mood_alerts=false");
    assert.equal(
      (await db.query("select * from public.push_jobs")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
test("Backend: nhật ký và ảnh riêng không lộ cho người thứ ba, hủy đôi xóa dữ liệu", async () => {
  const db = await fixture();
  try {
    const code = await pair(db);
    await as(
      db,
      A,
      "insert into public.diary(couple_id,author_id,title) values($1,$2,'Ngày đầu')",
      [code.couple_id, A],
    );
    assert.equal((await as(db, B, "select * from public.diary")).length, 1);
    assert.equal((await as(db, C, "select * from public.diary")).length, 0);
    assert.equal(
      (await as(db, B, "delete from public.diary returning *")).length,
      0,
    );
    await as(
      db,
      A,
      "insert into storage.objects(bucket_id,name) values('love-assets',$1)",
      [`${code.couple_id}/${A}/image.jpg`],
    );
    assert.equal((await as(db, B, "select * from storage.objects")).length, 1);
    assert.equal((await as(db, C, "select * from storage.objects")).length, 0);
    await assert.rejects(() =>
      as(
        db,
        C,
        "insert into storage.objects(bucket_id,name) values('love-assets',$1)",
        [`${code.couple_id}/${C}/image.jpg`],
      ),
    );
    await as(db, B, "select public.unpair()");
    assert.equal((await db.query("select * from public.diary")).rows.length, 0);
    assert.equal((await as(db, A, "select * from storage.objects")).length, 0);
  } finally {
    await db.close();
  }
});

test("Backend: nhắc trước 3 ngày cho hai máy có đồng ý, không lặp khi cron chạy lại", async () => {
  const db = await fixture();
  try {
    const code = await pair(db);
    await db.query(
      "update public.couples set anniversary=now()-interval '1 day', timezone=case when extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')>=8 then 'Asia/Ho_Chi_Minh' else 'America/Los_Angeles' end where id=$1",
      [code.couple_id],
    );
    await as(db, B, "update public.preferences set allow_cycle_alerts=true");
    await db.query(
      "insert into public.cycles(couple_id,owner_id,last_period,cycle_length,period_length,shared) select id,$2,(now() at time zone timezone)::date-25,28,5,true from public.couples where id=$1",
      [code.couple_id, A],
    );
    await db.exec(
      "select public.generate_reminders();select public.generate_reminders();",
    );
    const rows = (
      await db.query("select * from public.alerts where category='cycle'")
    ).rows;
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.recipient_id).sort(), [A, B]);
    assert.equal(
      (await db.query("select * from public.claim_push_jobs()")).rows.length,
      2,
    );
    assert.equal(
      (await db.query("select * from public.claim_push_jobs()")).rows.length,
      0,
    );
    await as(db, B, "update public.preferences set allow_cycle_alerts=false");
    assert.equal(
      (await db.query("select * from public.alerts where category='cycle'"))
        .rows.length,
      1,
    );
    await as(db, A, "delete from public.cycles");
    assert.equal(
      (await db.query("select * from public.alerts where category='cycle'"))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
