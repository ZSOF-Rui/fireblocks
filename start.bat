@echo off
setlocal
title FireBlocks - Dev Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install it first: https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/2] First run - installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm install failed. Check your network and retry.
    pause
    exit /b 1
  )
)

echo [2/2] Starting dev server. Browser will open http://localhost:5173
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5173"
call npm run dev
pause