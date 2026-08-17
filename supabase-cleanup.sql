-- ============================================================
--  zhehaya chat · 定时自动清理脚本（pg_cron）
--  在 Supabase 控制台 → SQL Editor 中粘贴执行一次即可，
--  之后每天 12:00 与 24:00（北京时间）自动运行，无需人工操作。
--
--  清理规则：
--    · 所有房间的聊天记录全部删除（含默认房间 zhehaya-chat）
--    · 除默认房间 zhehaya-chat 外的所有房间删除（默认房间保留）
--    · 非默认房间的推送订阅一并删除（默认房间订阅保留）
--
--  时区说明：pg_cron 使用 UTC 时间（本脚本按东八区换算）：
--    北京时间 12:00 = UTC 04:00 → '0 4 * * *'
--    北京时间 24:00 = UTC 16:00 → '0 16 * * *'
--  若使用人群不在东八区，请自行换算 cron 表达式。
-- ============================================================

-- 1. 清理函数（幂等，可安全重复执行）
create or replace function public.cleanup_rooms_and_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ① 删除全部聊天记录（含默认房间）
  delete from public.messages;

  -- ② 删除非默认房间的推送订阅（默认房间订阅保留，仍可收通知）
  delete from public.push_subs
  where room_id <> 'zhehaya-chat';

  -- ③ 删除除默认房间外的所有房间
  delete from public.rooms
  where id <> 'zhehaya-chat';
end;
$$;

-- 2. 启用 pg_cron（若项目尚未启用）
--    若执行报错，请到控制台 Database → Extensions 中搜索 pg_cron 手动开启后再执行本脚本。
create extension if not exists pg_cron;

-- 3. 注册定时任务（重复执行也幂等：先判断旧任务是否存在，存在才移除）
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-noon') then
    perform cron.unschedule('cleanup-noon');
  end if;
end $$;
select cron.schedule(
  'cleanup-noon',                                  -- 任务名（唯一）
  '0 4 * * *',                                     -- UTC 04:00 = 北京时间 12:00
  $$ select public.cleanup_rooms_and_messages() $$
);

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-midnight') then
    perform cron.unschedule('cleanup-midnight');
  end if;
end $$;
select cron.schedule(
  'cleanup-midnight',                              -- 任务名（唯一）
  '0 16 * * *',                                    -- UTC 16:00 = 北京时间 24:00
  $$ select public.cleanup_rooms_and_messages() $$
);

-- ============================================================
--  验证
-- ============================================================

-- 查看已注册的定时任务（应看到 cleanup-noon 与 cleanup-midnight 两条）：
--   select jobid, jobname, schedule, active from cron.job;

-- 手动立即执行一次，确认清理逻辑符合预期：
--   select public.cleanup_rooms_and_messages();
--   select * from public.rooms;              -- 应只剩 zhehaya-chat
--   select count(*) from public.messages;    -- 应为 0

-- 如需取消自动清理：
--   select cron.unschedule('cleanup-noon');
--   select cron.unschedule('cleanup-midnight');
