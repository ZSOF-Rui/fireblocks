@echo off
setlocal
title FireBlocks - Build Distribution
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install it first: https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] First run - installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm install failed. Check your network and retry.
    pause
    exit /b 1
  )
)

echo [2/3] Building production bundle (with TypeScript check)...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed. See log above.
  pause
  exit /b 1
)

copy /y README.md dist\README.md >nul

echo [3/3] Packing FireBlocks-dist.zip ...
if exist FireBlocks-dist.zip del FireBlocks-dist.zip
powershell -NoProfile -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'FireBlocks-dist.zip' -Force"
if errorlevel 1 (
  echo [WARN] Zip failed, but the dist\ folder is ready to deploy as-is.
) else (
  echo Done: FireBlocks-dist.zip
)
echo.
echo How to distribute:
echo   1. Unzip and double-click index.html to play offline (local mode).
echo   2. Or upload dist\ to any static host (GitHub Pages / Netlify / Vercel / Nginx).
echo   3. For cloud leaderboards: edit dist\config.js with your Worker URL, or run deploy-cloud.bat
pause