@echo off
chcp 65001 >nul
title Too Arna - restart
cd /d "%~dp0"
echo .env ozgorulgon bolso, konteynerler jangy jondoolor menen kaira ishke kirgizilet...
docker compose up -d
echo.
echo Dayar! http://localhost:3000
timeout /t 5 >nul
