@echo off
setlocal
title Music Bot
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1" %*
set "MUSIC_BOT_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %MUSIC_BOT_RESULT%
