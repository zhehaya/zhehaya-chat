-- ============================================================
--  zhehaya chat · Supabase 数据库初始化脚本
--  在 Supabase 控制台 → SQL Editor 中执行（可安全重复执行）
-- ============================================================

-- 1. 房间表（密码存 PBKDF2 哈希，明文永不落库；哈希由 Edge Function 生成）
create table if not exists public.rooms (
  id            text primary key,                 -- 房间号
  password_hash text not null,                    -- 密码哈希（salt$hash）
  created_at    timestamptz not null default now()
);

-- 2. 消息表（room_id 指定所属房间）
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  room_id     text not null default 'zhehaya-chat', -- 房间号（旧消息默认归属原房间）
  nickname    text not null,                        -- 匿名昵称
  content     text not null,                        -- 消息内容
  created_at  timestamptz not null default now()
);
alter table public.messages
  add column if not exists room_id text not null default 'zhehaya-chat';

-- 3. 索引（按房间拉取历史消息）
create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);

-- 4. 开启行级安全（RLS）
alter table public.rooms enable row level security;
alter table public.messages enable row level security;

-- 5. 房间表完全不向客户端开放（判断存在 / 验证密码全部由 Edge Function 完成）
revoke all on public.rooms from anon, authenticated;

-- 6. 消息策略：只能读写「JWT 中 room 声明」对应的房间
--    令牌由 Edge Function「chat-login」验证密码后按房间签发。
drop policy if exists "allow_select_messages" on public.messages;
drop policy if exists "allow_insert_messages" on public.messages;
drop policy if exists "room_select_messages" on public.messages;
drop policy if exists "room_insert_messages" on public.messages;

create policy "room_select_messages"
  on public.messages for select
  using (room_id = (auth.jwt() ->> 'room'));

create policy "room_insert_messages"
  on public.messages for insert
  with check (room_id = (auth.jwt() ->> 'room'));

-- ============================================================
--  7. 开启 Realtime（二选一）
-- ============================================================

-- 方式 A：执行下面这条 SQL（推荐，一步到位；幂等，可重复执行）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- 方式 B：在控制台操作
--   Database → Replication → supabase_realtime 发布
--   → 在 "Tables" 中找到 messages 并开启。
--   （新版控制台路径：左侧 Database → Replication → 0 tables → Add messages）

-- ============================================================
--  8.（可选）语音信令房间隔离
--  语音通话的 offer / answer / ICE 信令通过 Realtime Broadcast
--  传输，默认任何持令牌者都能向任意频道发信令。执行下面的
--  策略后，Broadcast / Presence 只能在「令牌绑定的房间」频道
--  内收发（可安全重复执行）。
--  注意：如果执行后语音异常，删除这两个策略即可回退。
-- ============================================================
alter table realtime.messages enable row level security;

drop policy if exists "room_rtc_read" on realtime.messages;
drop policy if exists "room_rtc_write" on realtime.messages;

create policy "room_rtc_read"
  on realtime.messages for select
  using (realtime.topic() = 'realtime:room-' || (auth.jwt() ->> 'room'));

create policy "room_rtc_write"
  on realtime.messages for insert
  with check (realtime.topic() = 'realtime:room-' || (auth.jwt() ->> 'room'));
