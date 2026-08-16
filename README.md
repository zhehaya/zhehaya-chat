# zhehaya chat（Supabase · 纯网页端 · 黑客终端风）

一个无需安装、无需后端的匿名实时聊天室。主页为 `index.html`，数据与实时推送全部由 Supabase 提供。

界面风格：简朴黑客终端风（黑底绿字、等宽字体、纯文本消息流），无任何花哨修饰。

## 功能

- 🏠 **多房间空间**：输入房间号进入；房间不存在时**自动用输入的密码创建**，成为房主
- 🔒 密码按房间各自设置（新房间 = 创建时的密码；已有房间 = 创建者设置的密码）
- 🎭 匿名昵称**进入时自定义**（最长 16 字符，留空则随机生成 `guest_xxxx`，浏览器本地保存）
- ⚡ 消息按房间隔离、实时收发（Supabase Realtime）
- 👥 每房间独立在线人数统计（Presence）
- 🎙 **实时开麦**：房间内语音通话（WebRTC 点对点，信令经 Supabase Realtime Broadcast）
- � **GIF 表情**：固定图库点选即发，动图文件随页面一起托管
- 🔔 **后台新消息提醒**：电脑走系统通知 + 标题闪烁 + 提示音；手机走 Web Push 系统通知
- �🌗 **明暗双主题**：默认浅色米白风，右上角一键切回经典黑绿终端风
- 📱 响应式界面，手机 / 电脑均可使用
- 🛡️ 数据库级防护：匿名请求一律拒绝，只有持有效令牌者才能读写
- 🛡️ 消息内容以纯文本渲染，防 XSS 注入

## 快速开始（约 10 分钟）

### 1. 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) 注册 / 登录；
2. 点击 **New project** 创建一个项目（地区就近选择即可）。

### 2. 初始化数据库

1. 打开 **SQL Editor**；
2. 将仓库中的 `supabase-setup.sql` 全部粘贴进去，点击 **Run**。

### 3. 部署登录函数（Edge Function）

1. 进入 **Edge Functions → Create a new function**；
2. 函数名填写 `chat-login`，点击 Create；
3. 打开仓库中 `supabase/functions/chat-login/index.ts`，把内容**全部替换**进编辑器，点击 **Deploy**；
4. 配置密钥：**Project Settings → Edge Functions → Secrets**（或函数详情页的 Secrets）→ 新增两个：
   - Name：`CHAT_JWT_SECRET`
     Value：在 **Project Settings → API → JWT Settings** 中复制 **JWT Secret** 的值
   - Name：`CHAT_SERVICE_ROLE`
     Value：在 **Project Settings → API** 中复制 **service_role** key 的值
   - （注意名称不能以 `SUPABASE_` 开头，那是系统保留前缀）
5. 关闭 JWT 校验：函数详情页 → **Settings（或 Advanced）→ Verify JWT** 设为关闭（登录验证由函数内部密码完成）；
6. 返回函数页，再次点击 **Deploy** 使配置生效。

### 4. 配置前端

1. 进入控制台 **Project Settings → API**；
2. 复制 **Project URL** 和 **anon public** key；
3. 打开 `index.html`，在文件顶部的「配置区」填入：

```js
const SUPABASE_URL      = "https://xxxx.supabase.co"; // 你的项目 URL
const SUPABASE_ANON_KEY = "sb_publishable_...";       // 你的 anon public key
```

### 5. 打开页面

- 直接双击 `index.html` 用浏览器打开即可；
- 或使用 VS Code 的 **Live Server** 插件（右键 → Open with Live Server）；
- 也可部署到任意静态托管：GitHub Pages / Netlify / Vercel 等，部署后所有人可通过链接访问。

## 使用方式

- 登录页依次填写：**房间号**（2-24 位字母/数字/`-`/`_`，留空进默认房间 `zhehaya-chat`）、**昵称**（可留空随机）、**密码**
- 房间不存在 → 自动用你输入的密码**创建房间**，进入后提示你是房主
- 房间已存在 → 输入创建者设置的密码即可进入
- 聊天页 **[MIC: OFF]** 按钮切换开麦 / 闭麦：开麦后房间内所有人可实时语音通话（首次点击会请求麦克风权限）
- 聊天页右上角 **[LEAVE]** 可退出当前房间，回到登录页换房间
- 历史数据：旧版聊天记录都在 `zhehaya-chat` 房间，首次进入用当时的密码即可创建并接管该房间

## 安全说明 🔐

**为什么 anon key 暴露在前端是安全的：**

- Supabase 的 anon key（`sb_publishable_...`）**本身就是设计为公开的**，它必须出现在网页代码中，所有 Supabase 应用都是如此；
- anon key 不是万能钥匙，真正的权限由数据库的 **RLS 策略** 控制；
- 本项目的 `messages` 表**不向匿名请求开放任何权限**，即使有人拿到 URL 和 anon key 也无法读取或写入消息；
- 密码在服务端 Edge Function 中验证，通过后才签发 1 小时短时效 JWT 令牌，前端所有请求（含实时订阅）都必须携带该令牌；
- 真正需要保密的 `service_role` key **从未出现在前端**，请勿将其写入任何网页代码。

**如果令牌泄露：**
- 令牌仅 1 小时有效，过期自动失效；
- 可随时修改 Edge Function 中的密码并重新部署，旧令牌仍会在 1 小时内自然失效（紧急情况可在 SQL Editor 执行
  `alter table public.messages disable row level security;` 前先评估影响，或更换 JWT Secret 使全部旧令牌立即作废）。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `index.html` | 主页：登录 + 文字聊天 + 语音通话 + 全部前端逻辑（单文件应用） |
| `supabase/functions/chat-login/index.ts` | 服务端登录函数：验证密码、签发会话令牌 |
| `supabase-setup.sql` | 数据库初始化脚本（建表、RLS 令牌校验、开启 Realtime） |
| `README.md` | 本文档 |

## 手机推送（Web Push）配置

手机浏览器不支持网页 Notification API，只能通过 **Web Push** 出系统通知。

### 1. 初始化数据库

重新执行 `supabase-setup.sql`（新增 `push_subs` 订阅表）。

### 2. 部署推送函数

1. **Edge Functions → Create a new function**，函数名填 `chat-push`；
2. 用仓库中 `supabase/functions/chat-push/index.ts` 的内容**全部替换**，点击 **Deploy**；
3. 配置密钥（Project Settings → Edge Functions → Secrets）新增两个：
   - `CHAT_VAPID_PRIVATE` = `WEvfp2aMhlaBFonDl-tv20ZKfWrF90rCGZjht1VfWiE`（仓库生成，私钥只放这里，不要写进前端）
   - `CHAT_SERVICE_ROLE` = service_role key（与 chat-login 相同）
4. 函数 **Verify JWT 保持开启**（校验房间令牌，防止跨房间推送）；
5. 再次点击 **Deploy** 使配置生效。

### 3. HTTPS 部署

Service Worker / Push 要求安全上下文：本地测试用 `http://localhost`（Live Server 即可），正式使用部署到 Netlify / Vercel 等 HTTPS 静态托管。`file://` 直接打开无法注册推送。

### 4. 手机使用

手机浏览器打开网站 → 进房后按提示**允许通知**（首次订阅会弹授权）→ 切到后台或锁屏，新消息会以系统通知弹出；点击通知回到聊天页。

兼容性说明：
- **安卓**：用 Chrome / Edge / 三星浏览器等（支持 Web Push）；微信内置浏览器、部分国产浏览器不支持推送；浏览器完全关闭后 Service Worker 仍可收到推送
- **iOS**：Safari 16.4+ 需把网页「添加到主屏幕」后从桌面图标打开（PWA 模式）才能收推送；iOS 13 之前不支持
- 页面必须部署在 **HTTPS**（或 localhost），`file://` 无法注册推送

## 常见问题

**Q：登录报错或一直显示连接异常？**
A：按顺序检查：
1. 是否执行了最新的 `supabase-setup.sql`（新增了 `rooms` 表和 `messages.room_id` 列）；
2. Edge Function `chat-login` 是否已重新部署，且设置了 `CHAT_JWT_SECRET` 与 `CHAT_SERVICE_ROLE` 两个密钥；
3. 函数代码里的 `SUPABASE_URL` 常量是否为你的项目地址；
4. `index.html` 中的 URL / anon key 是否正确。

**Q：想把某个房间连同消息一起删除？**
A：在 Supabase 控制台 SQL Editor 执行（替换为实际房间号）：
```sql
delete from public.messages where room_id = '房间号';
delete from public.rooms where id = '房间号';
```

**Q：想清空所有历史消息（例如清除早期测试数据）？**
A：在 Supabase 控制台 SQL Editor 执行：
`truncate table public.messages restart identity;`

**Q：能看到历史消息，但新消息不实时刷新？**
A：Realtime 未开启。在控制台 SQL Editor 执行：
`alter publication supabase_realtime add table public.messages;`

**Q：发送消息报错 `new row violates row-level security policy`？**
A：说明请求未携带有效令牌。刷新页面重新登录（令牌 1 小时后过期属正常现象）。

**Q：只想保留更少历史消息？**
A：修改 `index.html` 配置区的 `HISTORY_LIMIT` 常量。

**Q：开麦失败或听不到声音？**
A：按顺序检查：
1. 页面必须运行在 **HTTPS**（或 localhost）环境，直接双击 `index.html`（`file://`）可能被浏览器禁止使用麦克风，建议用 Live Server；
2. 浏览器是否已授权麦克风权限；
3. 语音为 P2P 直连，仅使用公共 STUN，对称 NAT / 严格公司防火墙下可能连不通——需要高可用请自建 TURN（coturn）或改用 SFU（如 LiveKit）；
4. 聊天人数较多（约 6 人以上）时网状连接会吃力，属预期限制。

**Q：想限制语音信令只在本房间收发？**
A：重新执行 `supabase-setup.sql`（第 8 节为 Realtime Broadcast 增加房间级 RLS 策略）。
