@echo off
cd /d %~dp0
start /min node server.js
ping -n 2 127.0.0.1 >nul
start "" http://127.0.0.1:8787/
exit
