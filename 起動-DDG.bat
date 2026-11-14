@echo off
cd /d %~dp0
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File open-ddg.ps1
node server.js
pause
