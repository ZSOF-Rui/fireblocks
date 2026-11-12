#!/usr/bin/env bash
# FireBlocks 云端一键部署（Cloudflare Worker + KV）
set -e
cd "$(dirname "$0")/worker"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js，请先安装: https://nodejs.org/"
  exit 1
fi

echo "即将部署 Cloudflare Worker 云端（排行榜 / 访问量 / 匹配池）"
echo "首次使用会打开浏览器登录 Cloudflare（免费账号即可）"
echo
node setup.mjs