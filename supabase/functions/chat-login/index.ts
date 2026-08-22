// @ts-nocheck — Deno 运行时环境（Deno 全局、隐式类型由 Deno 提供）
//
// zhehaya chat · 登录 / 建房 Edge Function
// 作用：
//   1. 房间不存在 → 用输入的密码创建房间（PBKDF2 哈希存储），提示房主
//   2. 房间已存在 → 校验密码
//   3. 验证通过 → 签发绑定该房间的短时效 JWT 会话令牌
// 数据库只接受带有效令牌的请求，前端泄露的 anon key 将毫无价值。
//
// 部署步骤见 README.md。

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = "https://bwcannjfisxpspmondbd.supabase.co"; // TODO: 你的项目 URL
const TOKEN_TTL_SECONDS = 60 * 60; // 令牌有效期：1 小时
// 房间号规则：中英文 / 数字 / - / _（中文按 1 个字符计，总长 2-24）
const ROOM_ID_RE = /^[a-zA-Z0-9\u4e00-\u9fa5_-]{2,24}$/;
const PBKDF2_ITERATIONS = 100_000;

const encoder = new TextEncoder();

function b64url(input) {
  const bytes =
    typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/* ---------- 密码哈希（PBKDF2-SHA256，加盐） ---------- */
async function derive(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return b64url(salt) + "$" + b64url(bits);
}

async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = String(stored).split("$");
  if (!saltB64 || !hashB64) return false;
  const bits = await derive(password, unb64url(saltB64));
  return b64url(bits) === hashB64;
}

/* ---------- JWT 签发 ---------- */
async function signJwt(roomId) {
  const secret = Deno.env.get("CHAT_JWT_SECRET");
  if (!secret) throw new Error("CHAT_JWT_SECRET is not set");

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: "anon",
    room: roomId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  const signingInput =
    b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signingInput)
  );
  return signingInput + "." + b64url(sig);
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

// 跨域（CORS）响应头：允许 Netlify 等部署域名调用本函数
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // 浏览器预检请求：直接放行
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const body = await req.json();
    const roomId =
      typeof body?.roomId === "string" ? body.roomId.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!ROOM_ID_RE.test(roomId)) return json({ error: "invalid room id" }, 400);
    if (!password || password.length > 128)
      return json({ error: "invalid password" }, 400);

    const serviceRole = Deno.env.get("CHAT_SERVICE_ROLE");
    if (!serviceRole) return json({ error: "CHAT_SERVICE_ROLE is not set" }, 500);

    const admin = createClient(SUPABASE_URL, serviceRole, {
      auth: { persistSession: false },
    });

    let created = false;
    const { data: room, error: queryErr } = await admin
      .from("rooms")
      .select("id, password_hash")
      .eq("id", roomId)
      .maybeSingle();
    if (queryErr) return json({ error: "db error: " + queryErr.message }, 500);

    if (!room) {
      // 房间不存在 → 用输入的密码创建，成为房主
      const hash = await hashPassword(password);
      const { error: insertErr } = await admin
        .from("rooms")
        .insert({ id: roomId, password_hash: hash });
      if (insertErr) {
        if (insertErr.code === "23505") {
          // 竞态：房间刚被他人创建，按既有房间校验密码
          const { data: existing, error: reErr } = await admin
            .from("rooms")
            .select("password_hash")
            .eq("id", roomId)
            .maybeSingle();
          if (reErr || !existing)
            return json({ error: "room conflict" }, 500);
          const ok = await verifyPassword(password, existing.password_hash);
          if (!ok) return json({ error: "access denied" }, 401);
        } else {
          return json({ error: "db error: " + insertErr.message }, 500);
        }
      } else {
        created = true;
      }
    } else {
      // 房间已存在 → 校验密码
      const ok = await verifyPassword(password, room.password_hash);
      if (!ok) return json({ error: "access denied" }, 401);
    }

    const token = await signJwt(roomId);
    return json({ token, roomId, created });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
