create extension if not exists pgcrypto with schema extensions;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null default 'Bạn' check(char_length(nickname) between 1 and 40), avatar_path text,
 mood text not null default 'calm' check(mood in ('happy','sad','tired','angry','calm','love')),
 mood_note text not null default '' check(char_length(mood_note)<=300), updated_at timestamptz not null default now()
);
create table public.couples (id uuid primary key default gen_random_uuid(), anniversary timestamptz not null default now(), timezone text not null default 'Asia/Ho_Chi_Minh', created_at timestamptz not null default now());
create table public.members (couple_id uuid not null references public.couples on delete cascade, user_id uuid not null unique references public.profiles on delete cascade, joined_at timestamptz not null default now(), primary key(couple_id,user_id));
create table public.preferences (user_id uuid primary key references public.profiles on delete cascade, allow_cycle_alerts boolean not null default false, allow_mood_alerts boolean not null default true);
create table public.pairing_codes (code_hash text primary key, couple_id uuid not null references public.couples on delete cascade, expires_at timestamptz not null, used_at timestamptz);
create table public.pair_attempts (user_id uuid not null references public.profiles on delete cascade, created_at timestamptz not null default now());
create index pair_attempts_user_time on public.pair_attempts(user_id,created_at);
create table public.cycles (couple_id uuid primary key references public.couples on delete cascade, owner_id uuid not null references public.profiles on delete cascade, last_period date not null, cycle_length integer not null check(cycle_length between 14 and 60), period_length integer not null check(period_length between 1 and 10 and period_length<cycle_length), shared boolean not null default false, reminders boolean not null default true, updated_at timestamptz not null default now());
create table public.diary (id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples on delete cascade, author_id uuid not null references public.profiles on delete cascade, title text not null check(char_length(title) between 1 and 100), body text not null default '' check(char_length(body)<=6000), image_path text, created_at timestamptz not null default now());
create table public.push_tokens (token text primary key check(char_length(token)<300), user_id uuid not null references public.profiles on delete cascade, updated_at timestamptz not null default now());
create table public.alerts (id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles on delete cascade, couple_id uuid not null references public.couples on delete cascade, category text not null check(category in ('cycle','mood','anniversary')), title text not null, body text not null, source_key text not null, read_at timestamptz, created_at timestamptz not null default now(), unique(recipient_id,source_key));
create table public.push_jobs (id uuid primary key default gen_random_uuid(), alert_id uuid not null unique references public.alerts on delete cascade, status text not null default 'pending', attempts integer not null default 0, next_try timestamptz not null default now(), leased_at timestamptz);
alter table public.profiles enable row level security; alter table public.couples enable row level security; alter table public.members enable row level security; alter table public.preferences enable row level security; alter table public.pairing_codes enable row level security; alter table public.pair_attempts enable row level security; alter table public.cycles enable row level security; alter table public.diary enable row level security; alter table public.push_tokens enable row level security; alter table public.alerts enable row level security; alter table public.push_jobs enable row level security;
create function public.my_couple() returns uuid language sql stable security definer set search_path=public,pg_temp as $$select couple_id from public.members where user_id=auth.uid() limit 1$$;
create function public.is_partner(target uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.members a join public.members b on a.couple_id=b.couple_id where a.user_id=auth.uid() and b.user_id=target)$$;
create function public.bootstrap_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin insert into public.profiles(id) values(new.id); insert into public.preferences(user_id) values(new.id); return new; end$$;
create trigger auth_profile after insert on auth.users for each row execute function public.bootstrap_profile();
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_partner(id));
create policy profiles_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy couples_read on public.couples for select to authenticated using(id=public.my_couple());
create policy members_read on public.members for select to authenticated using(couple_id=public.my_couple());
create policy prefs_read on public.preferences for select to authenticated using(user_id=auth.uid());
create policy prefs_edit on public.preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy cycle_read on public.cycles for select to authenticated using(couple_id=public.my_couple() and (owner_id=auth.uid() or shared));
create policy cycle_insert on public.cycles for insert to authenticated with check(couple_id=public.my_couple() and owner_id=auth.uid() and last_period<=(now() at time zone 'Asia/Ho_Chi_Minh')::date);
create policy cycle_update on public.cycles for update to authenticated using(owner_id=auth.uid() and couple_id=public.my_couple()) with check(owner_id=auth.uid() and couple_id=public.my_couple() and last_period<=(now() at time zone 'Asia/Ho_Chi_Minh')::date);
create policy cycle_delete on public.cycles for delete to authenticated using(owner_id=auth.uid());
create policy diary_read on public.diary for select to authenticated using(couple_id=public.my_couple());
create policy diary_create on public.diary for insert to authenticated with check(couple_id=public.my_couple() and author_id=auth.uid());
create policy diary_update on public.diary for update to authenticated using(author_id=auth.uid() and couple_id=public.my_couple()) with check(author_id=auth.uid() and couple_id=public.my_couple());
create policy diary_delete on public.diary for delete to authenticated using(author_id=auth.uid() and couple_id=public.my_couple());
create policy tokens_read on public.push_tokens for select to authenticated using(user_id=auth.uid());
create policy tokens_create on public.push_tokens for insert to authenticated with check(user_id=auth.uid());
create policy tokens_update on public.push_tokens for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy tokens_delete on public.push_tokens for delete to authenticated using(user_id=auth.uid());
create policy alerts_read on public.alerts for select to authenticated using(recipient_id=auth.uid() and couple_id=public.my_couple());
create policy alerts_ack on public.alerts for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
-- Chỉ cấp quyền cập nhật các cột cho phép; khách không thể viết lại lời nhắc.
revoke all on public.alerts from authenticated; grant select on public.alerts to authenticated; grant update(read_at) on public.alerts to authenticated;
revoke all on public.profiles from authenticated; grant select on public.profiles to authenticated; grant update(nickname,avatar_path,mood,mood_note) on public.profiles to authenticated;
create function public.create_pair_code() returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare cid uuid; code text; hashed text; begin
 if auth.uid() is null then return jsonb_build_object('error','Bạn chưa đăng nhập.'); end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 cid:=public.my_couple();
 if cid is null then insert into public.couples default values returning id into cid; insert into public.members values(cid,auth.uid(),now()); end if;
 perform 1 from public.couples where id=cid for update;
 if (select count(*) from public.members where couple_id=cid)>=2 then return jsonb_build_object('error','Hai bạn đã ghép đôi.'); end if;
 delete from public.pairing_codes where couple_id=cid or expires_at<now();
 loop
 code:=lpad(((('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint)%1000000)::text,6,'0'); hashed:=encode(digest(code,'sha256'),'hex');
 insert into public.pairing_codes values(hashed,cid,now()+interval '10 minutes',null) on conflict do nothing;
 exit when found;
 end loop;
 return jsonb_build_object('code',code,'expires_at',now()+interval '10 minutes','couple_id',cid);
end$$;
create function public.join_pair(code text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare cid uuid; begin
 if auth.uid() is null then return jsonb_build_object('error','Bạn chưa đăng nhập.'); end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if public.my_couple() is not null then return jsonb_build_object('error','Bạn đã ở trong một cặp đôi.'); end if;
 delete from public.pair_attempts where created_at<now()-interval '1 day';
 if (select count(*) from public.pair_attempts where user_id=auth.uid() and created_at>now()-interval '15 minutes')>=8 then return jsonb_build_object('error','Đã thử quá nhiều mã. Chờ 15 phút rồi thử lại.'); end if;
 insert into public.pair_attempts(user_id) values(auth.uid());
 select couple_id into cid from public.pairing_codes where code_hash=encode(digest(code,'sha256'),'hex') and expires_at>now() and used_at is null;
 if cid is null then return jsonb_build_object('error','Mã không đúng hoặc đã hết hạn.'); end if;
 perform 1 from public.couples where id=cid for update;
 perform 1 from public.pairing_codes where couple_id=cid and code_hash=encode(digest(code,'sha256'),'hex') and expires_at>now() and used_at is null for update;
 if not found then return jsonb_build_object('error','Mã không đúng hoặc đã hết hạn.'); end if;
 if (select count(*) from public.members where couple_id=cid)>=2 then return jsonb_build_object('error','Cặp đôi đã đủ hai người.'); end if;
 insert into public.members(couple_id,user_id) values(cid,auth.uid());
 update public.pairing_codes set used_at=now() where couple_id=cid;
 return jsonb_build_object('couple_id',cid);
end$$;
create function public.set_anniversary(start_at timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin if public.my_couple() is null or start_at>now() or start_at<'1900-01-01'::timestamptz then raise exception 'Ngày kỷ niệm không hợp lệ.'; end if; update public.couples set anniversary=start_at where id=public.my_couple(); end$$;
create function public.unpair() returns void language plpgsql security definer set search_path=public,pg_temp as $$declare cid uuid:=public.my_couple(); begin if cid is null then return; end if; delete from public.couples where id=cid; end$$;
create function public.stamp_update() returns trigger language plpgsql set search_path=public,pg_temp as $$begin new.updated_at=now(); return new; end$$;
create trigger profile_time before update on public.profiles for each row execute function public.stamp_update();
create trigger cycle_time before update on public.cycles for each row execute function public.stamp_update();
create function public.queue_alert() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin insert into public.push_jobs(alert_id) values(new.id) on conflict do nothing; return new; end$$;
create trigger alert_push after insert on public.alerts for each row execute function public.queue_alert();
create function public.mood_alert() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$declare cid uuid; recipient uuid; begin
 if old.mood=new.mood and old.mood_note=new.mood_note then return new; end if;
 cid:=(select couple_id from public.members where user_id=new.id);
 for recipient in select m.user_id from public.members m join public.preferences p on p.user_id=m.user_id where m.couple_id=cid and m.user_id<>new.id and p.allow_mood_alerts loop
 insert into public.alerts(recipient_id,couple_id,category,title,body,source_key) values(recipient,cid,'mood','Người thương vừa chia sẻ cảm xúc','Mở mục Cảm xúc để lắng nghe và hỏi xem người thương cần gì.','mood:'||new.id||':'||date_trunc('minute',new.updated_at)) on conflict do nothing;
 end loop; return new; end$$;
create trigger mood_push after update on public.profiles for each row execute function public.mood_alert();
create function public.revoke_cycle_alerts() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin if TG_OP='DELETE' then delete from public.alerts where couple_id=old.couple_id and category='cycle'; return old; end if; if not new.reminders then delete from public.alerts where couple_id=new.couple_id and category='cycle'; elsif not new.shared then delete from public.alerts where couple_id=new.couple_id and category='cycle' and recipient_id<>new.owner_id; end if; return new; end$$;
create trigger cycle_privacy after insert or update or delete on public.cycles for each row execute function public.revoke_cycle_alerts();
create function public.generate_reminders() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item record; today date; age integer; n integer; predicted date; recipient uuid; kind text; event_day date; caption text; begin
 for item in select c.*,r.timezone from public.cycles c join public.couples r on r.id=c.couple_id where c.reminders loop
 today:=(now() at time zone item.timezone)::date; age:=today-item.last_period;
 if age<0 or age>least(90,item.cycle_length*3) or extract(hour from now() at time zone item.timezone)<8 then continue; end if;
 for n in greatest(1,age/item.cycle_length-1)..(age/item.cycle_length+2) loop
 predicted:=item.last_period+n*item.cycle_length;
 foreach kind in array array['period_soon','period','ovulation'] loop
 event_day:=case kind when 'period_soon' then predicted-3 when 'period' then predicted else predicted-14 end;
 if event_day<>today then continue; end if;
 caption:=case kind when 'period_soon' then 'Theo lịch ước tính, kỳ kinh có thể đến trong 3 ngày. Hỏi người thương cần gì, chuẩn bị nước ấm và thời gian nghỉ.' when 'period' then 'Hôm nay là mốc đầu kỳ theo lịch ước tính. Lắng nghe, quan tâm và hỏi trước khi chuẩn bị đồ dùng. Không tự dùng thuốc.' else 'Hôm nay là mốc rụng trứng ước tính, có sai số. Không dùng dự báo để tránh thai; hỏi người thương cảm thấy thế nào.' end;
 for recipient in select m.user_id from public.members m left join public.preferences p on p.user_id=m.user_id where m.couple_id=item.couple_id and (m.user_id=item.owner_id or (item.shared and p.allow_cycle_alerts)) loop
 insert into public.alerts(recipient_id,couple_id,category,title,body,source_key) values(recipient,item.couple_id,'cycle','Một lời nhắc chăm sóc',caption,'cycle:'||item.couple_id||':'||kind||':'||predicted) on conflict do nothing;
 end loop;
 end loop; end loop; end loop;
 for item in select * from public.couples loop
 today:=(now() at time zone item.timezone)::date;
 if extract(hour from now() at time zone item.timezone)<8 then continue; end if;
 if to_char(item.anniversary at time zone item.timezone,'MM-DD')=to_char(today,'MM-DD') then
 for recipient in select user_id from public.members where couple_id=item.id loop
 insert into public.alerts(recipient_id,couple_id,category,title,body,source_key) values(recipient,item.id,'anniversary','Một ngày của hai chúng mình','Hôm nay là ngày kỷ niệm. Dành chút thời gian cùng nhau và lưu một khoảnh khắc nhé.','anniversary:'||item.id||':'||today) on conflict do nothing;
 end loop; end if; end loop;
end$$;
revoke execute on function public.generate_reminders() from public,anon,authenticated;
grant execute on function public.generate_reminders() to service_role;
create function public.claim_push_jobs() returns setof public.push_jobs language sql security definer set search_path=public,pg_temp as $$
 update public.push_jobs set status='sending',leased_at=now(),attempts=attempts+1 where id in(select id from public.push_jobs where (status='pending' or (status='sending' and leased_at<now()-interval '10 minutes')) and next_try<=now() and attempts<6 order by next_try limit 50 for update skip locked) returning *
$$;
revoke execute on function public.claim_push_jobs() from public,anon,authenticated; grant execute on function public.claim_push_jobs() to service_role;
revoke execute on function public.bootstrap_profile(),public.queue_alert(),public.mood_alert(),public.revoke_cycle_alerts() from public,anon,authenticated;
revoke execute on function public.create_pair_code(),public.join_pair(text),public.set_anniversary(timestamptz),public.unpair() from public,anon;
grant execute on function public.create_pair_code(),public.join_pair(text),public.set_anniversary(timestamptz),public.unpair() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('love-assets','love-assets',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy assets_read on storage.objects for select to authenticated using(bucket_id='love-assets' and ((storage.foldername(name))[1]=auth.uid()::text or (storage.foldername(name))[1]=public.my_couple()::text or public.is_partner(case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then (storage.foldername(name))[1]::uuid else null end)));
create policy assets_insert on storage.objects for insert to authenticated with check(bucket_id='love-assets' and ((storage.foldername(name))[1]=auth.uid()::text or ((storage.foldername(name))[1]=public.my_couple()::text and (storage.foldername(name))[2]=auth.uid()::text)));
create policy assets_delete on storage.objects for delete to authenticated using(bucket_id='love-assets' and ((storage.foldername(name))[1]=auth.uid()::text or (storage.foldername(name))[2]=auth.uid()::text));
do $$declare t text; begin foreach t in array array['profiles','couples','members','cycles','diary','alerts','preferences'] loop execute format('alter table public.%I replica identity full',t); if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if; end loop; end$$;

create function public.preference_privacy() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not new.allow_cycle_alerts then delete from public.alerts where recipient_id=new.user_id and category='cycle' and not exists(select 1 from public.cycles where couple_id=alerts.couple_id and owner_id=new.user_id); end if;
 if not new.allow_mood_alerts then delete from public.alerts where recipient_id=new.user_id and category='mood'; end if;
 return new; end$$;
create trigger preference_alert_privacy after update on public.preferences for each row execute function public.preference_privacy();
revoke execute on function public.preference_privacy() from public,anon,authenticated;
revoke create on schema public from public,anon,authenticated;
