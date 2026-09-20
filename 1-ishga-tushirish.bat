@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Moliya Bot
echo.
echo  Moliya Bot ishga tushmoqda... (to'xtatish: Ctrl + C)
echo.
call npm start
echo.
pause
