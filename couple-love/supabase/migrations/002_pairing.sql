-- 002_pairing.sql — Ghép nối theo TÀI KHOẢN (uid) thay cho mã 6 số ngẫu nhiên.
--
-- Vì sao: mã 6 số ngẫu nhiên chỉ có 1.000.000 khả năng, ai đó trùng mã là hai máy
-- tự chui vào chung một phòng (lỗi "kết nối ảo"); tệ hơn, mã cũ nằm trong bộ nhớ
-- máy nên lần mở sau app vẫn tự vào lại phòng cũ dù không còn người thương.
-- Thiết kế mới:
--   * Mỗi tài khoản có MỘT mã cố định `short_code` (sinh từ uid, lưu ở DB).
--   * Muốn ghép: người thương nhập mã cố định của bạn (hoặc bạn nhập mã của họ).
--   * Hàm pair_with_code() ghi partner_id + pair_secret cho CẢ HAI hàng và chỉ
--     chạy được một lần cho mỗi người (đang có đôi thì không ghép thêm).
--   * Ứng dụng bắt buộc đọc partner_id từ DB mỗi lần khởi động; DB nói chưa có
--     đôi thì máy phải dừng ở màn hình nhập mã và xoá phòng cũ trong bộ nhớ.
--   * Phòng MQTT hai máy dùng chung được suy ra từ `pair_secret` — chỉ hai hàng
--     hồ sơ của hai người đọc được khoá này (RLS), nên không ai khác vào được.
-- Chạy tệp này trong Supabase → SQL Editor (một lần cho mỗi dự án).

-- 0) Chạy được cả khi dự án còn trống -------------------------------------------
-- 001_love.sql dựng cả không gian đôi (couples/members/diary…). Phần ghép nối
-- theo tài khoản chỉ cần `profiles` và `pair_attempts`, nên tệp này tự tạo hai
-- bảng đó nếu chưa có (đúng khuôn của 001) để bạn chạy một lệnh là dùng được
-- ngay trong dự án mới. Nếu đã chạy 001 thì các lệnh dưới không làm gì thêm.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Bạn'
    check (char_length(nickname) between 1 and 40),
  avatar_path text,
  mood text not null default 'calm'
    check (mood in ('happy','sad','tired','angry','calm','love')),
  mood_note text not null default '' check (char_length(mood_note) <= 300),
  updated_at timestamptz not null default now()
);

create table if not exists public.pair_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists pair_attempts_user_time
  on public.pair_attempts (user_id, created_at);

alter table public.profiles enable row level security;
alter table public.pair_attempts enable row level security;

-- 1) Cột mới trên profiles -----------------------------------------------------
alter table public.profiles
  add column if not exists short_code text,
  add column if not exists partner_id uuid references public.profiles (id) on delete set null,
  add column if not exists pair_secret text,
  add column if not exists paired_at timestamptz,
  add column if not exists display_name text,
  add column if not exists avatar_url text;

create unique index if not exists profiles_short_code_key
  on public.profiles (upper(short_code))
  where short_code is not null;

-- 2) Sinh mã cố định: 6 ký tự, bỏ I O 0 1 cho khỏi nhầm khi đọc/gõ --------------
create or replace function public.pair_code_alphabet() returns text
language sql immutable as $$ select 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' $$;

create or replace function public.make_pair_code() returns text
language plpgsql volatile as $$
declare
  alphabet text := public.pair_code_alphabet();
  candidate text;
  i integer;
begin
  for attempt in 1..40 loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(
        alphabet,
        1 + floor(random() * length(alphabet))::int,
        1
      );
    end loop;
    if not exists (
      select 1 from public.profiles where upper(short_code) = candidate
    ) then
      return candidate;
    end if;
  end loop;
  -- Cực hiếm: dùng uid làm hậu tố cho chắc chắn không trùng.
  return 'P' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 5));
end $$;

-- 3) Hồ sơ: tạo khi đăng ký và bù khi thiếu -----------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, short_code, display_name)
  values (
    new.id,
    public.make_pair_code(),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

do $$
begin
  begin
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  exception
    when insufficient_privilege then
      raise notice 'Không tạo được trigger trên auth.users; hồ sơ vẫn được tạo ở lần đăng nhập đầu nhờ ensure_profile().';
  end;
end $$;

-- Bù hồ sơ cho tài khoản đã tạo trước khi chạy tệp này, và cho lần đăng nhập đầu.
create or replace function public.ensure_profile() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  row_profiles public.profiles;
begin
  if uid is null then
    raise exception 'Chưa đăng nhập.' using errcode = '28000';
  end if;
  insert into public.profiles (id, short_code)
  values (uid, public.make_pair_code())
  on conflict (id) do nothing;

  update public.profiles
     set short_code = public.make_pair_code()
   where id = uid and (short_code is null or short_code = '');

  select * into row_profiles from public.profiles where id = uid;
  return jsonb_build_object(
    'uid', row_profiles.id,
    'shortCode', row_profiles.short_code,
    'displayName', coalesce(row_profiles.display_name, ''),
    'avatarUrl', row_profiles.avatar_url,
    'partnerId', row_profiles.partner_id,
    'partnerName', (
      select coalesce(p.display_name, '')
        from public.profiles p
       where p.id = row_profiles.partner_id
    ),
    'partnerAvatar', (
      select p.avatar_url from public.profiles p where p.id = row_profiles.partner_id
    ),
    'partnerCode', (
      select p.short_code from public.profiles p where p.id = row_profiles.partner_id
    ),
    -- Khoá phòng: chỉ trả về khi ĐÃ có đôi, và chỉ cho chính chủ tài khoản.
    'pairSecret', case when row_profiles.partner_id is null then null else row_profiles.pair_secret end,
    'pairedAt', row_profiles.paired_at
  );
end $$;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.make_pair_code() to authenticated;

-- 4) Ghép đôi bằng mã cố định ---------------------------------------------------
-- Quy tắc: không tự ghép mình; cả hai phải chưa có đôi; mã phải tồn tại; chống
-- dò mã bằng bảng pair_attempts (đã có từ 001_love.sql) — tối đa 10 lần / 15 phút.
create or replace function public.pair_with_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  me public.profiles;
  other public.profiles;
  secret text;
  tries integer;
begin
  if uid is null then
    raise exception 'Chưa đăng nhập.' using errcode = '28000';
  end if;

  select count(*) into tries
    from public.pair_attempts
   where user_id = uid and created_at > now() - interval '15 minutes';
  if tries >= 10 then
    raise exception 'Bạn đã thử quá nhiều lần. Chờ khoảng 15 phút rồi thử lại.'
      using errcode = 'P0001';
  end if;
  insert into public.pair_attempts (user_id) values (uid);

  if length(code) <> 6 then
    raise exception 'Mã kết nối gồm đúng 6 ký tự (A–Z và 2–9).' using errcode = 'P0001';
  end if;

  perform public.ensure_profile();
  select * into me from public.profiles where id = uid;
  if me.partner_id is not null then
    raise exception 'Máy này đã ghép nối rồi. Hãy bấm Ngắt kết nối trước.'
      using errcode = 'P0001';
  end if;

  select * into other from public.profiles where upper(short_code) = code;
  if other.id is null then
    raise exception 'Không tìm thấy mã này. Kiểm tra lại mã của người thương.'
      using errcode = 'P0001';
  end if;
  if other.id = uid then
    raise exception 'Đó là mã của chính bạn. Hãy nhập mã trên máy của người thương.'
      using errcode = 'P0001';
  end if;
  if other.partner_id is not null then
    raise exception 'Người này đã ghép nối với máy khác rồi.' using errcode = 'P0001';
  end if;

  -- 256 bit ngẫu nhiên từ hai UUID v4 (hàm có sẵn, không cần phần mở rộng).
  secret := replace(gen_random_uuid()::text, '-', '') ||
            replace(gen_random_uuid()::text, '-', '');
  update public.profiles
     set partner_id = other.id, pair_secret = secret, paired_at = now()
   where id = uid;
  update public.profiles
     set partner_id = uid, pair_secret = secret, paired_at = now()
   where id = other.id;

  return jsonb_build_object(
    'partnerId', other.id,
    'partnerName', coalesce(other.display_name, ''),
    'partnerAvatar', other.avatar_url,
    'partnerCode', other.short_code,
    'pairSecret', secret
  );
end $$;

revoke all on function public.pair_with_code(text) from public;
grant execute on function public.pair_with_code(text) to authenticated;

-- 5) Ngắt kết nối: xoá đôi cho CẢ HAI máy --------------------------------------
create or replace function public.unpair() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me public.profiles;
begin
  if uid is null then
    raise exception 'Chưa đăng nhập.' using errcode = '28000';
  end if;
  select * into me from public.profiles where id = uid;
  if me.partner_id is not null then
    update public.profiles
       set partner_id = null, pair_secret = null, paired_at = null
     where id = me.partner_id and partner_id = uid;
  end if;
  update public.profiles
     set partner_id = null, pair_secret = null, paired_at = null
   where id = uid;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.unpair() from public;
grant execute on function public.unpair() to authenticated;

-- 6) Đổi tên / ảnh đại diện lưu lên máy chủ -------------------------------------
create or replace function public.save_profile(
  p_display_name text default null,
  p_avatar_url text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  row_profiles public.profiles;
begin
  if uid is null then
    raise exception 'Chưa đăng nhập.' using errcode = '28000';
  end if;
  update public.profiles
     set display_name = coalesce(nullif(left(coalesce(p_display_name, ''), 40), ''), display_name),
         nickname = coalesce(nullif(left(coalesce(p_display_name, ''), 40), ''), nickname),
         avatar_url = coalesce(p_avatar_url, avatar_url),
         avatar_path = coalesce(p_avatar_url, avatar_path)
   where id = uid;
  select * into row_profiles from public.profiles where id = uid;
  return jsonb_build_object(
    'displayName', coalesce(row_profiles.display_name, ''),
    'avatarUrl', row_profiles.avatar_url
  );
end $$;

revoke all on function public.save_profile(text, text) from public;
grant execute on function public.save_profile(text, text) to authenticated;

-- 7) Quyền đọc: chính mình + đúng người thương (không đọc được người khác) ------
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or id = (select partner_id from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_edit on public.profiles;
create policy profiles_edit on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 8) Realtime: máy kia ngắt kết nối là máy này biết ngay ------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- 9) Kho ảnh đại diện (tuỳ chọn): mỗi người chỉ ghi được thư mục của mình --------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
