# 🔥 炎块 FireBlocks

一个以「火焰」为主题、按现代俄罗斯方块 Guideline 细则实现的网页方块游戏。纯前端即可完整游玩，可选一键部署 Cloudflare Worker 获得真实云端排行榜、访问量统计与匹配池。

**MIT 开源** · 仓库：<https://github.com/ZSOF-Rui/fireblocks> · 在线演示（GitHub Pages）：<https://ZSOF-Rui.github.io/fireblocks/>

![tech](https://img.shields.io/badge/React-18-61dafb) ![tech](https://img.shields.io/badge/Vite-5-646cff) ![tech](https://img.shields.io/badge/TypeScript-5.6-3178c6) ![tech](https://img.shields.io/badge/Cloudflare-Worker-f38020) [![CI](https://github.com/ZSOF-Rui/fireblocks/actions/workflows/ci.yml/badge.svg)](https://github.com/ZSOF-Rui/fireblocks/actions/workflows/ci.yml) ![license](https://img.shields.io/badge/license-MIT-green)

---

## ✨ 特性一览

- **标准细则引擎**：SRS 旋转 + 完整踢墙表、7-Bag 随机器、Hold 暂存、幽灵投影、500ms 锁定延迟（15 次移动重置）、DAS/ARR 手感调节、T-Spin（含 Mini）判定、Back-to-Back、Combo、Perfect Clear、官方重力曲线（最高 20 级）。
- **原创 FEVER 狂热系统**：消行 / T 旋 / 四消 / 连击积攒热量，满 100 进入 12 秒狂热——得分 ×2、攻击 +2、画面与音乐同步升温。
- **六种模式**：无尽马拉松、40 行竞速、每日挑战（全球同种子）、在线匹配 PK（Elo 天梯）、本地双人同屏、窗口对战（房间码跨标签页实时对战）。
- **对战攻击规则**：消行攻击、T 旋攻击、B2B 加成、Combo 攻击、PC +10、FEVER +2，攻击先抵消自身待收垃圾，垃圾行同批同孔。
- **排行榜**：今日 / 本周 / 本月 / 总榜四档，按玩家本地时区切分周期；未配置云端时为本地模拟服务（界面有明确标识），配置后无缝切换真实云端。
- **访问量监测**：累计访问、今日访问、独立访客、当前在线，主页与排行榜页实时展示。
- **全程序化音画**：WebAudio 合成音效 + 112 BPM 合成器浪潮背景乐（狂热时自动增强），Canvas 粒子 / 震屏 / 拖尾 / 危险红晕，无任何外部素材请求。
- **完整体验**：触屏虚拟按键、设置中心（手感 / 画面 / 音量 / 云端）、个人档案（昵称 / 头像 / 战绩）、暂停 / 重开 / 结算 / 再来一局。

---

## 🚀 快速开始

需要 [Node.js](https://nodejs.org/) 18+（推荐 20+）。

### 一键脚本（推荐）

| 操作 | Windows | macOS / Linux / Git Bash |
| --- | --- | --- |
| 启动开发服务器（自动装依赖、开浏览器） | 双击 `start.bat` | `bash start.sh` |
| 构建分发版 + 打包 zip | 双击 `build.bat` | `bash build.sh` |
| 一键部署云端（Cloudflare Worker） | 双击 `deploy-cloud.bat` | `bash deploy-cloud.sh` |

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
| 在线匹配 | 雷达扫描匹配对手 → 三局两胜式单局 PK，Elo 天梯分（K=28）。对手由本地 AI 驱动（强度随天梯分自适应）；配置云端后，匹配池会优先返回真实玩家档案。 |
| 本地双人 | 同屏分键盘对战，互相发送垃圾行，先被顶出者败。 |
| 窗口对战 | 创建 / 加入 4 位房间码，**同一浏览器的多个标签页 / 窗口**实时对战（BroadcastChannel），支持邀请链接 `?room=ABCD`、断线检测与再来一局。 |

> 说明：窗口对战基于 BroadcastChannel，限同设备同浏览器；跨设备实时对战需要 WebSocket 中继服务，当前版本未包含。匹配 PK 的云端匹配池提供真实玩家档案，对局操作由 AI 模拟。

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

不部署也能完整游玩（本地模拟服务）。部署后获得：**真实全球排行榜（日 / 周 / 月 / 总）、真实访问量与在线统计、真实玩家匹配池**。Cloudflare 免费额度（Workers 10 万请求/天 + KV 免费档）对个人站点绰绰有余。

### 一键部署

```bash
# Windows: 双击 deploy-cloud.bat
# macOS / Linux:
bash deploy-cloud.sh
```

脚本自动完成：安装 wrangler → 浏览器登录 Cloudflare → 创建 KV 命名空间并回填 `worker/wrangler.toml` → 部署 Worker → 把 `https://xxx.workers.dev` 地址写入 `public/config.js`（若存在 `dist/` 也同步写入）→ 连通性自检。

### 手动部署

```bash
cd worker
npm install
npx wrangler login
npx wrangler kv namespace create FB_KV   # 把输出的 id 填入 wrangler.toml
npx wrangler deploy                      # 得到 https://fireblocks-cloud.<子域>.workers.dev
```

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
| 游戏内「设置」 | DAS 60–250ms、ARR 0–80ms、幽灵 / 网格 / 震屏 / 粒子档位 / 虚拟按键 / 音乐与三通道音量 |

个人数据（档案、设置、本地榜单、访问统计）均存于浏览器 localStorage，键前缀 `fb_`。

---

## 📁 项目结构

```
FireBlocks/
├─ index.html / vite.config.ts / tsconfig.json
├─ start.bat|sh  build.bat|sh  deploy-cloud.bat|sh   # 一键脚本
├─ public/
│  ├─ config.js          # 运行时云端配置（部署脚本自动写入）
│  └─ favicon.svg
├─ src/
│  ├─ game/              # 引擎：constants / rng / engine / input / bot / audio / renderer
│  ├─ net/room.ts        # BroadcastChannel 房间协议
│  ├─ services/cloud.ts  # 云/本地双通道：榜单、匹配、访问统计
│  ├─ components/        # Home / GameScreen / Leaderboard / Matchmaking / RoomLobby / Modals / Nav / …
│  ├─ store.ts           # localStorage 状态（设置/档案/提示）
│  └─ styles.css         # 火焰主题视觉系统
└─ worker/
   ├─ src/index.ts       # Cloudflare Worker API（KV 榜单/统计/匹配池）
   ├─ wrangler.toml      # KV 绑定（setup 自动回填 id）
   └─ setup.mjs          # 一键部署脚本
```

---

## ❓ FAQ

**Q：不部署云端，排行榜是假的吗？**
A：是本地模拟服务，界面会明确标注「本地模拟」。游戏本体（引擎、对战、双人、房间）完全真实可玩；部署 Worker 后榜单与统计即为真实云端数据。

**Q：窗口对战能跨电脑吗？**
A：不能。它基于 BroadcastChannel，用于同设备多窗口实时对战（含邀请链接）。跨设备需要 WebSocket 中继，属后续扩展方向。

**Q：每日挑战为什么只计今日榜？**
A：每日挑战按日期种子当天有效，成绩只进入「今日」桶，次日自动换新序列。

**Q：双击 index.html 打开白屏？**
A：请确认打开的是 `dist/` 构建产物（单文件内联构建，支持 file:// 协议）；源码目录的 index.html 需要开发服务器。个别浏览器对 file:// 下的 localStorage 有限制，建议用任意静态服务器托管。

**Q：如何清空本地数据？**
A：浏览器开发者工具 → Application → Local Storage，删除 `fb_` 前缀的键即可。

---

## 🛠️ 技术栈

React 18 · TypeScript 5.6 · Vite 5 · Canvas 2D（精灵缓存 + 粒子系统）· WebAudio（全程序化合成）· BroadcastChannel · Cloudflare Workers + KV · 自托管字体 Orbitron / Rajdhani

---

## 📄 开源协议

MIT License · 见 [LICENSE](LICENSE)。欢迎 Issue / PR：引擎细则、手感参数、云端扩展（如跨设备 WebSocket 中继）都是好方向。

祝武运昌隆，烧穿排行榜。🔥