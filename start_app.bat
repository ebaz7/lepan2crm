@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title سیستم مدیریت انبار و حسابداری سایان (نسخه ویندوز)

:: Always change directory to where the batch file is located
cd /d "%~dp0"

echo =======================================================================
echo              سیستم مدیریت انبار و هوشمند سایان (سخه دسکتاپ)
echo                   SAYAN WAREHOUSE & BUSINESS SYSTEM
echo =======================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] برنامه Node.js روی ویندوز شما نصب نیست!
    echo لطفا ابتدا Node.js را از سایت https://nodejs.org دانلود و نصب نمایید.
    echo.
    pause
    exit /b 1
)

:: 2. Check and install dependencies if missing
if not exist node_modules (
    echo [1/3] در حال نصب پیش‌نیازهای اولیه برنامه (لطفا شکیبا باشید)...
    call npm install
    if %errorlevel% neq 0 (
        echo [خطا] در نصب پکیج‌ها مشکلی پیش آمد. اینترنت خود را بررسی کنید.
        pause
        exit /b 1
    )
)

:: 3. Check and build frontend if dist is missing
if not exist dist (
    echo [2/3] در حال آماده‌سازی فایل‌های برنامه (Build)...
    call npm run build
)

:: 4. Start Server
echo.
echo [3/3] در حال راه‌اندازی سرور محلی...
echo -----------------------------------------------------------------------
echo برنامه در آدرس: http://localhost:3000 در دسترس است.
echo برای باز شدن در حالت دسکتاپ چند ثانیه صبر کنید...
echo -----------------------------------------------------------------------
echo.

:: Launch App in Chrome/Edge App Mode in background after 2 seconds
start "" powershell -Command "Start-Sleep -Seconds 3; if (Test-Path 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') { Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' '--app=http://localhost:3000' } elseif (Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe') { Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' '--app=http://localhost:3000' } else { Start-Process 'http://localhost:3000' }"

:: Run the Node.js Server in the foreground
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [خطا] سرور متوقف شد!
    pause
)
