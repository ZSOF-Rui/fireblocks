#!/usr/bin/env bash
# FireBlocks 一键启动（macOS / Linux / Git Bash）
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js，请先安装: https://nodejs.org/"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[1/2] 首次运行，安装依赖..."
  npm install --no-audit --no-fund
fi

echo "[2/2] 启动开发服务器: http://localhost:5173"
( sleep 3
  if command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:5173
  elif command -v open >/dev/null 2>&1; then open http://localhost:5173
  else start http://localhost:5173 2>/dev/null || true
  fi
) >/dev/null 2>&1 &
npm run dev