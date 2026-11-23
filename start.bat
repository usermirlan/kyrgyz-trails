@echo off
chcp 65001 >nul
title Too Arna
cd /d "%~dp0"

echo === Too Arna: ishke kirgizuu ===

if not exist .env (
  copy .env.example .env >nul
  echo .env tuzuldu
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop ishke kirgizilip jatat...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  :wait
  timeout /t 5 /nobreak >nul
  docker info >nul 2>&1
  if errorlevel 1 goto wait
  echo Docker dayar.
)

docker compose up --build
pause
