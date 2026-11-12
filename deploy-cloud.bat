@echo off
setlocal
title FireBlocks - One-Click Cloud Deploy
cd /d "%~dp0worker"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install it first: https://nodejs.org/
  pause
  exit /b 1
)

echo Deploying the Cloudflare Worker backend (leaderboards / visits / match pool).
echo On first use a browser window opens for Cloudflare login (free account works).
echo.
node setup.mjs
pause