-- ============================================================
--  匿名聊天室 · Supabase 数据库初始化脚本
--  在 Supabase 控制台 → SQL Editor 中执行以下全部语句
-- ============================================================

-- 1. 消息表
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  nickname    text not null,                 -- 匿名昵称
  content     text not null,                 -- 消息内容
  created_at  timestamptz not null default now()
);

-- 2. 时间索引（历史消息查询用）
create index if not exists messages_created_at_idx
  on public.messages (created_at desc);

-- 3. 开启行级安全（RLS）
alter table public.messages enable row level security;

-- 4. 策略：允许匿名用户读取 / 写入消息
--    （密码门禁在前端实现；如需更高安全性，请改用 Edge Function，
--      详见 README.md 的「安全说明」）
drop policy if exists "allow_select_messages" on public.messages;
create policy "allow_select_messages"
  on public.messages for select using (true);

drop policy if exists "allow_insert_messages" on public.messages;
create policy "allow_insert_messages"
  on public.messages for insert with check (true);

-- ============================================================
--  5. 开启 Realtime（二选一）
-- ============================================================

-- 方式 A：执行下面这条 SQL（推荐，一步到位）
alter publication supabase_realtime add table public.messages;

-- 方式 B：在控制台操作
--   Database → Replication → supabase_realtime 发布
--   → 在 "Tables" 中找到 messages 并开启。
--   （新版控制台路径：左侧 Database → Replication → 0 tables → Add messages）
