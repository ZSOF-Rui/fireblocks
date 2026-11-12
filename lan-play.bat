@echo off
setlocal
title FireBlocks - LAN Play Server
cd /d "%~dp0lan"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install it first: https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing ws dependency...
  call npm install --no-audit --no-fund
)

node server.mjs
pause