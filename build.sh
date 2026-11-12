#!/usr/bin/env bash
# FireBlocks 一键构建分发版（macOS / Linux / Git Bash）
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js，请先安装: https://nodejs.org/"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[1/3] 首次运行，安装依赖..."
  npm install --no-audit --no-fund
fi

echo "[2/3] 构建生产版本（含 TypeScript 类型检查）..."
npm run build
cp README.md dist/README.md

echo "[3/3] 打包 FireBlocks-dist.zip ..."
rm -f FireBlocks-dist.zip
if command -v zip >/dev/null 2>&1; then
  (cd dist && zip -qr ../FireBlocks-dist.zip .)
elif command -v powershell >/dev/null 2>&1; then
  powershell -NoProfile -Command "Compress-Archive -Path 'dist/*' -DestinationPath 'FireBlocks-dist.zip' -Force"
else
  echo "[提示] 未找到 zip/powershell，跳过打包；dist/ 目录已可直接部署"
fi

echo
echo "完成。分发方式:"
echo "  1. 解压 zip，打开 index.html 即可离线游玩（本地模式）"
echo "  2. 或将 dist/ 上传到任意静态托管（GitHub Pages / Netlify / Vercel / Nginx）"
echo "  3. 需要云端排行榜时，编辑 dist/config.js 填入 Worker 地址，或运行 deploy-cloud.sh"