@echo off
chcp 65001 >nul
title Too Arna - frontend rebuild
cd /d "%~dp0"
echo Frontend kaira build bolup jatat (npm paketteri kaira juktolbojt)...
docker compose up -d --build frontend
echo.
echo Dayar! http://localhost:3000
timeout /t 5 >nul
