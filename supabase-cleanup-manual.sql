-- ============================================================
--  zhehaya chat · 手动清理脚本（想清理时随时执行）
--  在 Supabase 控制台 → SQL Editor 中粘贴执行即可，立即生效。
--
--  清理规则（与定时自动清理一致）：
--    · 所有房间的聊天记录全部删除（含默认房间 zhehaya-chat）
--    · 除默认房间 zhehaya-chat 外的所有房间删除（默认房间保留）
--    · 非默认房间的推送订阅一并删除（默认房间订阅保留）
--
--  已配置过 supabase-cleanup.sql（pg_cron）的话，也可以只执行一行：
--     select public.cleanup_rooms_and_messages();
-- ============================================================

-- ① 删除全部聊天记录（含默认房间）
delete from public.messages;

-- ② 删除非默认房间的推送订阅（默认房间订阅保留，仍可收通知）
delete from public.push_subs
where room_id <> 'zhehaya-chat';

-- ③ 删除除默认房间外的所有房间
delete from public.rooms
where id <> 'zhehaya-chat';

-- ============================================================
--  验证（可选中下面两句单独执行）
-- ============================================================

-- 剩余房间（应只剩 zhehaya-chat）：
--   select * from public.rooms;

-- 剩余消息数（应为 0）：
--   select count(*) from public.messages;
