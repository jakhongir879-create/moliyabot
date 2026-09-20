@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ngrok (Mini App uchun)
echo.
echo  ngrok ishga tushmoqda. Bu oynani YOPMANG.
echo  Manzil bot dasturiga avtomatik ulanadi.
echo.
ngrok http 3000
echo.
pause
