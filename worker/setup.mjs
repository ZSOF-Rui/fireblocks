// FireBlocks 云端一键部署脚本（Cloudflare Worker + KV）
// 用法: node setup.mjs   （或双击根目录 deploy-cloud.bat / 运行 deploy-cloud.sh）
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const isWin = process.platform === 'win32';

function run(cmd, { inherit = false, allowFail = false } = {}) {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, {
    cwd: here,
    shell: true,
    stdio: inherit ? 'inherit' : 'pipe',
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (!inherit && out.trim()) console.log(out.trim());
  if (r.status !== 0 && !allowFail) {
    console.error(`\n[失败] 命令退出码 ${r.status}: ${cmd}`);
    process.exit(1);
  }
  return { status: r.status ?? 1, out };
}

const wrangler = (args, opts) => run(`npx wrangler ${args}`, opts);

console.log('==============================================');
console.log(' FireBlocks 云端一键部署 (Cloudflare Workers)');
console.log('==============================================');

// 1. 安装依赖
if (!existsSync(join(here, 'node_modules'))) {
  console.log('\n[1/5] 安装 wrangler 依赖（首次约 1-2 分钟）...');
  run('npm install --no-audit --no-fund');
} else {
  console.log('\n[1/5] 依赖已就绪，跳过安装');
}

// 2. 登录 Cloudflare
console.log('\n[2/5] 检查 Cloudflare 登录状态...');
const who = wrangler('whoami', { allowFail: true });
if (who.status !== 0 || /not authenticated|no account/i.test(who.out)) {
  console.log('未登录，即将打开浏览器完成授权（免费账号即可）...');
  wrangler('login', { inherit: true });
  const again = wrangler('whoami', { allowFail: true });
  if (again.status !== 0) {
    console.error('[失败] 登录未完成，请重试。');
    process.exit(1);
  }
}

// 3. 创建 KV 命名空间并回填 id
console.log('\n[3/5] 检查 KV 存储...');
const tomlPath = join(here, 'wrangler.toml');
let toml = readFileSync(tomlPath, 'utf8');
if (toml.includes('REPLACE_WITH_YOUR_KV_ID')) {
  const created = wrangler('kv namespace create FB_KV');
  const m = created.out.match(/id\s*=\s*"([a-f0-9]+)"/i);
  if (!m) {
    console.error('[失败] 未能从输出中解析 KV id，请手动运行 npx wrangler kv namespace create FB_KV');
    process.exit(1);
  }
  toml = toml.replace('REPLACE_WITH_YOUR_KV_ID', m[1]);
  writeFileSync(tomlPath, toml, 'utf8');
  console.log(`KV 已创建并写入 wrangler.toml: ${m[1]}`);
} else {
  console.log('wrangler.toml 已包含 KV id，跳过创建');
}

// 4. 部署 Worker
console.log('\n[4/5] 部署 Worker...');
const dep = wrangler('deploy');
const urlMatch = dep.out.match(/https:\/\/[a-z0-9-]+\.workers\.dev/i);
if (!urlMatch) {
  console.error('[失败] 部署输出中未找到 workers.dev 地址。请检查上方日志后重试。');
  process.exit(1);
}
const apiBase = urlMatch[0].replace(/\/$/, '');

// 5. 写入前端配置（public 源码 + dist 分发目录）
console.log('\n[5/5] 写入前端云端地址...');
const configContent = `// FireBlocks 运行时配置 —— 由 worker/setup.mjs 自动生成\nwindow.FIREBLOCKS_CONFIG = {\n  apiBase: "${apiBase}"\n};\n`;
writeFileSync(join(root, 'public', 'config.js'), configContent, 'utf8');
console.log(`已写入 public/config.js -> ${apiBase}`);
const distConfig = join(root, 'dist', 'config.js');
if (existsSync(join(root, 'dist'))) {
  writeFileSync(distConfig, configContent, 'utf8');
  console.log('已同步写入 dist/config.js');
} else {
  console.log('提示: 尚未构建分发版，之后运行 npm run build 会自动带上该配置');
}

// 连通性自检
try {
  const res = await fetch(`${apiBase}/api/stats`, { signal: AbortSignal.timeout(10000) });
  if (res.ok) console.log(`\n连通性自检通过: ${apiBase}/api/stats -> HTTP ${res.status}`);
  else console.log(`\n[注意] 自检返回 HTTP ${res.status}，KV 首次写入可能需数秒生效，可稍后在游戏设置中“测试连接”。`);
} catch {
  console.log('\n[注意] 自检请求失败（可能是网络代理问题），可在游戏设置中“测试连接”验证。');
}

console.log('\n==============================================');
console.log(' 部署完成！');
console.log(` 云端地址: ${apiBase}`);
console.log(' 前端已自动指向该地址，排行榜/访问量/匹配池即刻生效。');
console.log(' 本地开发: npm run dev   构建分发: npm run build');
console.log('==============================================');