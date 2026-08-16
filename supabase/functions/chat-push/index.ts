// @ts-nocheck — Deno 运行时环境（Deno 全局、隐式类型由 Deno 提供）
//
// zhehaya chat · Web Push 推送 Edge Function
// 发送方消息入库后调用本函数，向同房间其他已订阅设备推送系统通知
// （手机浏览器不支持网页 Notification API，只能靠 Web Push 出系统通知）。
//
// 部署步骤见 README.md：
//   1. Verify JWT 保持「开启」（校验房间令牌，防止跨房间推送）
//   2. 密钥：CHAT_VAPID_PRIVATE（VAPID 私钥）、CHAT_SERVICE_ROLE

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = "https://bwcannjfisxpspmondbd.supabase.co"; // TODO: 你的项目 URL
const VAPID_PUBLIC_KEY =
  "BCtkfWCNVtWYb85-K7fLACpnEnszDWeqh3OFSxE72aMuIJLwnlTJ4OEWjn56x8Rm5LgDFRmh1ayTFctLDQsbd7I"; // 与前端 index.html 保持一致
const VAPID_SUBJECT = "mailto:admin@zhehaya.local"; // 联系邮箱（任意合法格式即可）

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

// 解析房间令牌里的 room 声明（Verify JWT 开启时 Supabase 已校验签名）
function jwtRoom(req) {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part)).room || "";
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const body = await req.json();
    const roomId =
      typeof body?.roomId === "string" ? body.roomId.trim().toLowerCase() : "";
    const excludeUid =
      typeof body?.excludeUid === "string" ? body.excludeUid : "";
    const onlyUid =
      typeof body?.onlyUid === "string" ? body.onlyUid : "";
    const url = typeof body?.url === "string" ? body.url : "./";
    const nickname =
      typeof body?.nickname === "string" ? body.nickname.slice(0, 16) : "?";
    const content =
      typeof body?.content === "string" ? body.content.slice(0, 200) : "";
    const title =
      typeof body?.title === "string" ? body.title.slice(0, 50) : "zhehaya chat";

    // 令牌绑定的房间必须与推送目标一致，防止跨房间推送
    if (jwtRoom(req) !== roomId) return json({ error: "invalid room token" }, 401);

    const privateKey = Deno.env.get("CHAT_VAPID_PRIVATE");
    if (!privateKey) return json({ error: "CHAT_VAPID_PRIVATE is not set" }, 500);
    const serviceRole = Deno.env.get("CHAT_SERVICE_ROLE");
    if (!serviceRole) return json({ error: "CHAT_SERVICE_ROLE is not set" }, 500);

    const admin = createClient(SUPABASE_URL, serviceRole, {
      auth: { persistSession: false },
    });

    let q = admin
      .from("push_subs")
      .select("uid, endpoint, p256dh, auth")
      .eq("room_id", roomId);
    if (onlyUid) q = q.eq("uid", onlyUid);
    else if (excludeUid) q = q.neq("uid", excludeUid);
    const { data: subs, error } = await q;
    if (error) return json({ error: "db error: " + error.message }, 500);

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);
    const payload = JSON.stringify({
      title,
      body: nickname + ": " + content,
      url,
    });

    let sent = 0;
    const failed = [];
    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        // 收集失败原因返回给前端展示，而不是静默吞掉
        failed.push(String((e && e.message) || e));
      }
    }
    return json({ sent, total: (subs || []).length, errors: failed.slice(0, 3) });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
