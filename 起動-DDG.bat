@echo off
cd /d %~dp0
start /min node server.js
powershell -NoProfile -ExecutionPolicy Bypass -File open-ddg.ps1
exit
