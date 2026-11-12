# 🔥 炎块 FireBlocks

一个以「火焰」为主题、按现代俄罗斯方块 Guideline 细则实现的网页方块游戏。纯前端即可完整游玩，可选一键部署 Cloudflare Worker 获得真实云端排行榜、访问量统计、匹配池与跨网络在线房间。

**MIT 开源** · 仓库：<https://github.com/ZSOF-Rui/fireblocks> · 在线演示（GitHub Pages）：<https://ZSOF-Rui.github.io/fireblocks/>

![tech](https://img.shields.io/badge/React-18-61dafb) ![tech](https://img.shields.io/badge/Vite-5-646cff) ![tech](https://img.shields.io/badge/TypeScript-5.6-3178c6) ![tech](https://img.shields.io/badge/Cloudflare-Worker-f38020) [![CI](https://github.com/ZSOF-Rui/fireblocks/actions/workflows/ci.yml/badge.svg)](https://github.com/ZSOF-Rui/fireblocks/actions/workflows/ci.yml) ![license](https://img.shields.io/badge/license-MIT-green)

---

## ✨ 特性一览

- **标准细则引擎**：SRS 旋转 + 完整踢墙表、7-Bag 随机器、Hold 暂存、幽灵投影、500ms 锁定延迟（15 次移动重置）、DAS/ARR 手感调节、T-Spin（含 Mini）判定、Back-to-Back、Combo、Perfect Clear、官方重力曲线（最高 20 级）。
- **原创 FEVER 狂热系统**：消行 / T 旋 / 四消 / 连击积攒热量，满 100 进入 12 秒狂热——得分 ×2、攻击 +2、画面与音乐同步升温。
- **六种模式**：无尽马拉松、40 行竞速、每日挑战（全球同种子）、在线匹配 PK（云端真人实时匹配 + Elo 天梯）、本地双人同屏、自定义房间（自设房间号，复制链接或输码加入；支持跨网络在线、局域网跨设备、同机多窗口三种真实联机方式）。
- **对战攻击规则**：消行攻击、T 旋攻击、B2B 加成、Combo 攻击、PC +10、FEVER +2，攻击先抵消自身待收垃圾，垃圾行同批同孔。
- **排行榜**：今日 / 本周 / 本月 / 总榜四档，按玩家本地时区切分周期；未配置云端时为本地模拟服务（界面有明确标识），配置后无缝切换真实云端。
- **访问量监测**：累计访问、今日访问、独立访客、当前在线，主页与排行榜页实时展示。
- **全程序化音画**：WebAudio 合成音效 + 112 BPM 合成器浪潮背景乐（狂热时自动增强），Canvas 粒子 / 震屏 / 拖尾 / 危险红晕，无任何外部素材请求。
- **难度与速度自定义**：起始等级 1–15、重力速度 50%–200%，仅作用于单人模式（马拉松 / 竞速 / 每日）；对战模式统一标准速度保证公平。
- **四套主题**：烈焰 / 寒冰 / 霓虹 / 翡翠，UI 配色、Logo 渐变、方块精灵与粒子全联动，对局中可即时切换并自动保存。
- **完整体验**：触屏虚拟按键、设置中心（手感 / 难度与速度 / 主题 / 画面 / 音量 / 云端）、个人档案（昵称 / 头像 / 战绩）、暂停 / 重开 / 结算 / 再来一局。

---

## 🚀 快速开始

需要 [Node.js](https://nodejs.org/) 18+（推荐 20+）。

### 一键脚本（推荐）

| 操作 | Windows | macOS / Linux / Git Bash |
| --- | --- | --- |
| 启动开发服务器（自动装依赖、开浏览器） | 双击 `start.bat` | `bash start.sh` |
| 构建分发版 + 打包 zip | 双击 `build.bat` | `bash build.sh` |
| 一键部署云端（Cloudflare Worker） | 双击 `deploy-cloud.bat` | `bash deploy-cloud.sh` |
| 启动局域网联机服务（静态托管 + WS 中继） | 双击 `lan-play.bat` | `node lan/server.mjs` |

### 手动命令

```bash
npm install     # 安装依赖
npm run dev     # 开发服务器 http://localhost:5173
npm run build   # 类型检查 + 生产构建 → dist/
npm run preview # 本地预览生产构建
```

### 分发版

`build.bat` / `build.sh` 会生成 **`FireBlocks-dist.zip`**（内含 `dist/` 全部文件 + 本 README）。构建使用 `vite-plugin-singlefile` 将 JS / CSS / 字体全部内联进单个 `index.html`，因此双击即可离线运行（普通多文件 ES module 构建在 `file://` 下会被浏览器 CORS 拦截）：

1. **离线游玩**：解压后直接打开 `index.html`，全部游戏功能可用（排行榜为本地模拟）。
2. **静态托管**：把 `dist/` 上传到 GitHub Pages / Netlify / Vercel / Nginx 等任意静态服务器。
3. **启用云端**：编辑 `dist/config.js` 填入 Worker 地址（见下文），无需重新构建。

### 开源与自动构建（GitHub Actions）

仓库完全开源（MIT）。`.github/workflows/` 提供两条流水线：

- **CI**（push / PR 触发）：`npm ci` + 类型检查 + 生产构建 + Worker 类型检查，上传 `dist` 产物；main 分支自动部署 **GitHub Pages** 在线演示。
- **Release**（`v*` tag 触发）：构建并打包 `FireBlocks-dist.zip`，自动创建 GitHub Release 附带下载。

不想配本地环境时，可直接在 Actions 页下载构建产物，或从 Releases 下载分发 zip。

---

## 🎮 操作说明

### 单人模式

| 动作 | 按键 |
| --- | --- |
| 左 / 右移动 | `←` / `→` |
| 软降 | `↓` |
| 硬降 | `空格` |
| 顺时针旋转 | `↑` 或 `X` |
| 逆时针旋转 | `Z` 或 `Ctrl` |
| 暂存 Hold | `C` 或 `Shift` |
| 暂停 | `Esc` 或 `P` |
| 重开（单人） | `R` |

### 本地双人（同一键盘）

| 动作 | 玩家 1（左） | 玩家 2（右） |
| --- | --- | --- |
| 左 / 右 | `A` / `D` | `←` / `→` |
| 软降 | `S` | `↓` |
| 硬降 | `空格` | `Enter` |
| 顺 / 逆旋转 | `W` / `Q` | `↑` / `.` 或 `/` |
| 暂存 | `E` 或左 `Shift` | 右 `Shift` |

### 触屏

设置中「虚拟按键」默认自动（触屏设备开启），也可强制开 / 关。桌面端可在 URL 后加 `?touch=1` 强制显示。

---

## 🕹️ 游戏模式

| 模式 | 说明 |
| --- | --- |
| 无尽马拉松 | 经典无尽模式，每 10 行升一级，重力按官方曲线加快，冲击最高分。 |
| 40 行竞速 | 消除 40 行即获胜，比拼用时，成绩计入竞速榜（越快越靠前）。 |
| 每日挑战 | 以当天日期为种子，所有玩家拿到完全相同的方块序列，每日刷新，只计今日榜。 |
| 在线匹配 | 云端真人实时匹配：进入全局队列后按积分就近配对，双方拿到同一随机种子与房间号，自动进入真实对战（互发垃圾行、同步棋盘），Elo 天梯分（K=28）。排队人少时可直接与 AI 练手。 |
| 本地双人 | 同屏分键盘对战，互相发送垃圾行，先被顶出者败。 |
| 自定义房间 | 创建时可自设 3–8 位房间号（留空自动生成），等待页给出邀请链接与房号；对方打开链接或输入房号加入，加入页也可直接粘贴邀请链接自动解析。**在线**走 Cloudflare Durable Object 的 wss 中继，双方无需同一网络，公共网页版默认使用；**局域网**走 WebSocket 中继，同一 Wi-Fi 下跨设备真实联机；**同机窗口**走 BroadcastChannel（零服务器）。支持邀请链接 `?room=CODE`（在线带 `&via=online`，局域网带 `&lan=地址`）、断线判胜与再来一局。 |

> 说明：自定义房间的「同机窗口」基于 BroadcastChannel，限同设备同浏览器；「在线」由已部署的 Worker 中继（`/room`，Durable Object），跨网络可用；「局域网」由 `lan/server.mjs` 提供 WebSocket 中继（默认端口 8788），见下文。HTTPS 页面无法连接 `ws://` 局域网地址（混合内容拦截），此时请使用「在线」房间。匹配 PK 在配置云端后为真人实时对战（`/queue` Durable Object 配对，随后进入 `/room` 中继）；云端不可达时自动退化为本地 AI 对手。

---

## ⚔️ 真人实时匹配（跨网络 PvP）

点「在线匹配」进入全局队列：Worker 的 `Queue` Durable Object 按 Elo 积分就近配对，成功后把**房间号、先后手与同一个随机种子**下发双方，两端随即通过 `/room` 中继进入真实对战。

- 方块序列由服务端种子统一，避免双方进入时间不同导致序列不一致。
- 对局结束按 Elo（K=28）结算天梯分并写入 vs 榜单。
- 排队 10 秒仍无人时可一键切换 AI 练手；云端不可达时自动使用 AI。

---

## 🌍 在线房间（跨网络真实对战）

双方**不需要处在同一网络**：打开同一个网址，输入同一房间号即可真实对战（互发垃圾行、同步棋盘、断线判胜、再来一局）。

- 公共网页版（HTTPS）在已配置 Worker 时**默认选中「在线」**；创建后把邀请链接（`?room=CODE&via=online`）或房间号发给对方，对方打开即自动加入。
- 房间服务由 Worker 的 **Durable Object** 提供：每个房间号一个实例，只做双向消息中继，不落盘、不存储对局内容；房间号 3–8 位字母数字，重复创建 / 房间已满会明确提示。
- 使用前需先部署 Worker（见下文「云端部署」）；本地开发想连云端中继时，在浏览器控制台执行 `localStorage.setItem('fb_api_base','https://你的worker地址')` 即可切换。
- 访客先到、主机后到也没关系：客户端会重试握手；双方都加入后开始倒计时。

---

## 🌐 局域网联机（跨设备真实对战）

同一 Wi-Fi / 局域网下的手机、平板、电脑可以真实实时对战（垃圾行互攻、断线判胜、再来一局），无需任何云服务。

### 主机（提供服务的一方）

1. 先构建分发版：双击 `build.bat`（或 `npm run build`），生成 `dist/`。
2. 双击 **`lan-play.bat`**（或 `node lan/server.mjs`）。脚本自动安装 `ws` 依赖并启动服务：
   - 静态托管 `dist/`（单文件构建，手机浏览器直接打开即玩）；
   - WebSocket 房间中继，监听 `0.0.0.0:8788`（可用环境变量 `PORT` 改端口）。
3. 控制台会打印若干 **局域网地址**，形如 `http://192.168.x.x:8788`。

### 加入对战

- **主机**：浏览器打开 `http://localhost:8788` → 「自定义房间」→ 选「局域网」→（可选）自设 3–8 位房间号 → 创建房间。
- **其他设备**：浏览器打开主机的局域网地址 → 「自定义房间」→ 选「局域网」→ 填入同一房间号加入；或直接把邀请链接粘贴进「加入房间」输入框，会自动解析房号与局域网地址。
- **邀请链接**：创建房间后等待页会显示可复制的邀请链接 `http://<主机地址>/?room=CODE&lan=ws://<主机地址>:8788`，其他设备点开即自动加入。
- 也可手动填写局域网服务地址（默认按当前页面主机名推断 `ws://<hostname>:8788`）。

### 说明

- 中继只转发对局消息（`join/welcome/state/attack/over/rematch/ping/bye`），不存储任何数据；房间号仅支持字母与数字、长度 3–8；房间满员 / 主机不在线 / 房间号占用都会给出明确提示。
- 一方断开时另一方立即收到 `bye` 并判定胜利，可「再战一局」重新握手。
- 若 Windows 防火墙拦截，请允许 Node.js 通过专用 / 专用网络；确保所有设备在同一网段。
- 同机多窗口对战选「同机窗口」（BroadcastChannel）即可，无需启动本服务。

---

## 📏 规则与计分（Guideline）

- **场地**：10 × 40（上方 20 行隐藏），方块在隐藏区生成。
- **旋转**：SRS，J/L/S/T/Z 与 I 各有独立踢墙表；T-Spin 按三角判定，最后一踢为 4 号位时 Mini 升级 Full。
- **基础分**（× 当前等级）：单消 100 / 双消 300 / 三消 500 / 四消 800；T 旋 0/1/2/3 行 = 400/800/1200/1600；Mini T 旋 = 100/200/400。
- **Back-to-Back**：连续四消或 T 旋消行，得分 ×1.5 且攻击 +1。
- **Combo**：连续消行每段 +50 × combo × 等级，并追加攻击。
- **Perfect Clear**：全清 +10 攻击与大额奖励分。
- **软降 / 硬降**：每格 1 / 2 分。
- **FEVER**：热量满 100 触发 12 秒狂热，得分 ×2、攻击 +2。

### 对战攻击表

| 动作 | 攻击行 |
| --- | --- |
| 单消 / 双消 / 三消 / 四消 | 0 / 1 / 2 / 4 |
| T 旋 1 / 2 / 3 行 | 2 / 4 / 6 |
| B2B 加成 | +1 |
| Combo | 0,0,1,1,2,2,3,3,4,4,4,5… |
| Perfect Clear | +10 |
| FEVER 期间 | +2 |

攻击优先抵消自己待收的垃圾；剩余部分发送给对手。垃圾行在对手下一次「未消行落地」时插入，同一批垃圾孔位相同。

---

## ☁️ 云端部署（Cloudflare Worker，可选）

不部署也能完整游玩（本地模拟服务）。部署后获得：**真实全球排行榜（日 / 周 / 月 / 总）、真实访问量与在线统计、真人匹配队列、跨网络在线房间**。Cloudflare 免费额度（Workers 10 万请求/天 + KV 免费档 + SQLite Durable Objects 免费档）对个人站点绰绰有余。

### 一键部署

```bash
# Windows: 双击 deploy-cloud.bat
# macOS / Linux:
bash deploy-cloud.sh
```

脚本自动完成：安装 wrangler → 浏览器登录 Cloudflare → 创建 KV 命名空间并回填 `worker/wrangler.toml` → 部署 Worker（同时自动创建在线房间与匹配队列所需的 Durable Object）→ 把 `https://xxx.workers.dev` 地址写入 `public/config.js`（若存在 `dist/` 也同步写入）→ 连通性自检。

### 手动部署

```bash
cd worker
npm install
npx wrangler login
npx wrangler kv namespace create FB_KV   # 把输出的 id 填入 wrangler.toml
npx wrangler deploy                      # 得到 https://fireblocks-cloud.<子域>.workers.dev
```

`wrangler.toml` 已包含 `ROOM` Durable Object 绑定与 `new_sqlite_classes` 迁移，`wrangler deploy` 会自动创建，无需额外操作；`/room` 即 wss 房间中继入口。

然后编辑前端 `public/config.js`（或分发版 `dist/config.js`）：

```js
window.FIREBLOCKS_CONFIG = { apiBase: "https://fireblocks-cloud.<你的子域>.workers.dev" };
```

### 启动连通性检测

页面启动时自动对已配置的 Worker 地址做连通性检测（`GET /api/stats`，6 秒超时）：

- **连通**：进入云端模式，设置页显示 🟢 云端模式；
- **不通**：弹出「云端 Worker 不可达」提示，可选 **改用本地自定义榜单**（清空云端地址、仅本机记录）、**重试连接**、或 **云端设置**（修改地址后重新保存）；
- **未配置地址**：直接使用本地自定义榜单，不弹窗。

运行中云端若临时不可达，也会自动回退本地数据并 toast 提示，不会中断对局。

### API 一览

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/stats` | GET | 累计 / 今日访问、独立访客、当前在线 |
| `/api/visit` | POST | 记录一次访问（clientId 去重、在线心跳 90s） |
| `/api/leaderboard?mode=&period=&key=` | GET | 榜单（mode: marathon/sprint/daily/vs；period: day/week/month/all） |
| `/api/leaderboard` | POST | 提交成绩，自动写入日 / 周 / 月 / 总四个桶，保留个人最佳 |
| `/api/match?rating=&client=` | GET | 匹配池取相近分真实玩家，无则返回 AI 档案 |

周期桶 TTL：日 2 天 / 周 8 天 / 月 32 天，自动过期清理；榜单每桶保留前 100。周期键由客户端按本地时区计算后随请求发送，避免 UTC 切日错位。

### 云端地址优先级

游戏内设置（localStorage `fb_api_base`）> `public/config.js` > 构建期 `.env` 的 `VITE_API_BASE`。
云端不可达时自动降级本地模拟并提示一次，游戏永不因网络问题卡死。设置面板提供「测试连接」。

---

## ⚙️ 配置参考

| 位置 | 作用 |
| --- | --- |
| `public/config.js` | 运行时云端地址，分发后可直接改，无需重新构建 |
| `.env`（复制 `.env.example`） | 构建期注入 `VITE_API_BASE` |
| 游戏内「设置 → 云端服务」 | 覆盖以上两者，可测试连接 / 一键保存 |
| 游戏内「设置」 | DAS 60–250ms、ARR 0–80ms、起始等级 1–15、重力速度 50–200%、主题（烈焰 / 寒冰 / 霓虹 / 翡翠）、幽灵 / 网格 / 震屏 / 粒子档位 / 虚拟按键 / 音乐与三通道音量 |

个人数据（档案、设置、本地榜单、访问统计）均存于浏览器 localStorage，键前缀 `fb_`。

---

## 📁 项目结构

```
FireBlocks/
├─ index.html / vite.config.ts / tsconfig.json
├─ start.bat|sh  build.bat|sh  deploy-cloud.bat|sh  lan-play.bat   # 一键脚本
├─ public/
│  ├─ config.js          # 运行时云端配置（部署脚本自动写入）
│  └─ favicon.svg
├─ src/
│  ├─ game/              # 引擎：constants / rng / engine / input / bot / audio / renderer
│  ├─ net/room.ts        # BroadcastChannel 房间协议（同机窗口）
│  ├─ net/wsroom.ts      # WebSocket 房间客户端（在线 / 局域网）
│  ├─ services/cloud.ts  # 云/本地双通道：榜单、匹配、访问统计
│  ├─ components/        # Home / GameScreen / Leaderboard / Matchmaking / RoomLobby / Modals / Nav / …
│  ├─ store.ts           # localStorage 状态（设置/档案/提示）
│  └─ styles.css         # 四套主题视觉系统（CSS 变量 + data-theme）
├─ lan/
│  ├─ server.mjs         # 局域网服务：静态托管 dist/ + WebSocket 房间中继
│  └─ package.json       # ws 依赖
└─ worker/
   ├─ src/index.ts       # Cloudflare Worker API（KV 榜单/统计 + Room 房间中继 + Queue 匹配队列）
   ├─ wrangler.toml      # KV 绑定 + ROOM/QUEUE Durable Object（setup 自动回填 KV id）
   └─ setup.mjs          # 一键部署脚本
```

---

## ❓ FAQ

**Q：不部署云端，排行榜是假的吗？**
A：是本地模拟服务，界面会明确标注「本地模拟」。游戏本体（引擎、对战、双人、房间）完全真实可玩；部署 Worker 后榜单与统计即为真实云端数据。

**Q：自定义房间能跨电脑 / 手机吗？**
A：能，而且有两种方式。「在线」：双方打开同一个已部署 Worker 的网址（无需同一网络），输入同一房间号或打开邀请链接即可，消息经 wss 中继；公共网页版默认使用。「局域网」：主机双击 `lan-play.bat` 启动中继服务，同一 Wi-Fi 下的其他设备打开 `http://主机IP:8788` 加入（HTTPS 页面无法连接 `ws://`，所以不要从公网 HTTPS 页面上选局域网）。「同机窗口」则限同设备多标签页（BroadcastChannel，零服务器）。

**Q：难度 / 速度调整会影响对战公平吗？**
A：不会。起始等级与重力速度仅作用于单人模式（马拉松 / 竞速 / 每日）；所有对战模式（匹配 PK / 双人 / 窗口 / 局域网）统一使用标准速度，保证公平。

**Q：每日挑战为什么只计今日榜？**
A：每日挑战按日期种子当天有效，成绩只进入「今日」桶，次日自动换新序列。

**Q：双击 index.html 打开白屏？**
A：请确认打开的是 `dist/` 构建产物（单文件内联构建，支持 file:// 协议）；源码目录的 index.html 需要开发服务器。个别浏览器对 file:// 下的 localStorage 有限制，建议用任意静态服务器托管。

**Q：如何清空本地数据？**
A：浏览器开发者工具 → Application → Local Storage，删除 `fb_` 前缀的键即可。

---

## 🛠️ 技术栈

React 18 · TypeScript 5.6 · Vite 5 · Canvas 2D（精灵缓存 + 粒子系统）· WebAudio（全程序化合成）· BroadcastChannel（同机窗口）· WebSocket + Node `ws` 中继（局域网跨设备）· Cloudflare Workers + KV + Durable Objects（在线房间 + 真人匹配队列） · 自托管字体 Orbitron / Rajdhani

---

## 📄 开源协议

MIT License · 见 [LICENSE](LICENSE)。欢迎 Issue / PR：引擎细则、手感参数、主题配色、云端与联机扩展都是好方向。

祝武运昌隆，烧穿排行榜。🔥