# zhehaya chat（Supabase · 纯网页端 · 黑客终端风）

一个无需安装、无需后端的匿名实时聊天室。主页为 `index.html`，数据与实时推送全部由 Supabase 提供。

界面风格：简朴黑客终端风（黑底绿字、等宽字体、纯文本消息流），无任何花哨修饰。

## 功能

- 🔒 进入密码验证（默认 `123456`，可在代码中修改）
- 🎭 匿名随机代号（`guest_xxxx` 十六进制格式，浏览器本地保存）
- ⚡ 消息实时收发（Supabase Realtime）
- 👥 在线人数统计（Presence）
- 📱 响应式界面，手机 / 电脑均可使用
- 🛡️ 消息内容以纯文本渲染，防 XSS 注入

## 快速开始（约 5 分钟）

### 1. 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) 注册 / 登录；
2. 点击 **New project** 创建一个项目（地区就近选择即可）；
3. 创建完成后进入控制台，打开 **SQL Editor**；
4. 将仓库中的 `supabase-setup.sql` 全部粘贴进去，点击 **Run**。

### 2. 配置前端

1. 进入控制台 **Project Settings → API**；
2. 复制 **Project URL** 和 **anon public** key；
3. 打开 `index.html`，在文件顶部的「配置区」填入：

```js
const SUPABASE_URL      = "https://xxxx.supabase.co"; // 你的项目 URL
const SUPABASE_ANON_KEY = "eyJhbGciOi...";            // 你的 anon key
const ROOM_PASSWORD     = "123456";                   // 进入密码
```

### 3. 打开页面

- 直接双击 `index.html` 用浏览器打开即可；
- 或使用 VS Code 的 **Live Server** 插件（右键 → Open with Live Server）；
- 也可部署到任意静态托管：GitHub Pages / Netlify / Vercel 等，部署后所有人可通过链接访问。

## 修改进入密码

打开 `index.html`，找到顶部配置区：

```js
const ROOM_PASSWORD = "123456"; // 改成你想要的新密码
```

保存后刷新页面即生效。其他可配置项（房间名、历史消息条数）也都在同一位置。

## 安全说明 ⚠️

- 本方案的密码验证在**前端**完成，属于「轻量门禁」：普通访客看不到聊天内容，但了解前端知识的人可以绕过。
- Supabase 的 anon key 本身会暴露在网页中，因此消息表对持有 key 的人可读写。
- 如需**真正安全**的密码验证，请将验证逻辑放到服务端，例如：
  1. 使用 Supabase **Edge Functions**（Deno）：验证密码后调用 service role key 插入消息；
  2. 消息表关闭匿名 insert 权限，只允许经过验证的请求写入；
  3. 进阶方案可配合 Supabase Auth 匿名登录 + RLS 策略。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `index.html` | 主页：登录 + 聊天界面 + 全部逻辑（单文件应用） |
| `supabase-setup.sql` | 数据库初始化脚本（建表、RLS、开启 Realtime） |
| `README.md` | 本文档 |

## 常见问题

**Q：想清空所有历史消息（例如清除早期测试数据）？**
A：在 Supabase 控制台 SQL Editor 执行：
`truncate table public.messages restart identity;`

**Q：能看到历史消息，但新消息不实时刷新？**
A：Realtime 未开启。在控制台 SQL Editor 执行：
`alter publication supabase_realtime add table public.messages;`

**Q：发送消息报错 `new row violates row-level security policy`？**
A：确认 `supabase-setup.sql` 已完整执行，RLS 策略已创建。

**Q：只想保留更少历史消息？**
A：修改 `index.html` 配置区的 `HISTORY_LIMIT` 常量。
