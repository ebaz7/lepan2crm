@echo off
setlocal EnableDelayedExpansion

:: Always change directory to where the batch file is located
cd /d "%~dp0"
title Sayan Warehouse - Start App

echo =======================================================================
echo              سیستم مدیریت انبار و هوشمند سایان (نسخه دسکتاپ)
echo                   SAYAN WAREHOUSE & BUSINESS SYSTEM
echo =======================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR / خطا] برنامه Node.js روی ویندوز شما نصب نیست یا در مسیر سیستم قرار ندارد!
    echo لطفا ابتدا Node.js را از سایت https://nodejs.org دانلود و نصب نمایید.
    echo.
    echo برای خروج هر کلیدی را فشار دهید...
    pause
    exit /b 1
)

:: 2. Check and install dependencies if missing
if not exist node_modules (
    echo [1/3] در حال نصب پیش‌نیازهای اولیه برنامه (لطفا شکیبا باشید)...
    call npm install
    if %errorlevel% neq 0 (
        echo [خطا] در نصب پکیج‌ها مشکلی پیش آمد. اینترنت خود را بررسی کنید.
        echo برای خروج هر کلیدی را فشار دهید...
        pause
        exit /b 1
    )
)

:: 3. Check and build frontend if dist is missing
if not exist dist (
    echo [2/3] در حال آماده‌سازی فایل‌های برنامه (Build)...
    call npm run build
    if %errorlevel% neq 0 (
        echo [خطا] در ساخت اولیه برنامه مشکلی پیش آمد.
        echo برای خروج هر کلیدی را فشار دهید...
        pause
        exit /b 1
    )
)

:: 4. Check if port 3000 is already in use by Windows Service (PaymentSystem) or manager.bat
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo [اطلاع / Notice] پورت 3000 در حال حاضر فعال است!
    echo احتمالا برنامه از قبل به عنوان سرویس ویندوز (توسط manager.bat) در پس‌زمینه در حال اجراست.
    echo در حال باز کردن برنامه در مرورگر...
    echo.
    start http://localhost:3000
    echo =======================================================================
    echo اگر برنامه باز شد، می‌توانید از آن استفاده کنید.
    echo در صورتی که می‌خواهید سرویس قبلی را متوقف کنید، در CMD ادمین دستور زیر را بزنید:
    echo    net stop PaymentSystem
    echo =======================================================================
    echo.
    echo برای ادامه یا اجرای مجدد سرور، هر کلیدی را فشار دهید...
    pause
)

:: 5. Start Server
echo.
echo [3/3] در حال راه‌اندازی سرور محلی...
echo -----------------------------------------------------------------------
echo برنامه در آدرس: http://localhost:3000 در دسترس است.
echo برای باز شدن خودکار در حالت پنجره دسکتاپ چند ثانیه صبر کنید...
echo -----------------------------------------------------------------------
echo.

:: Launch App in Chrome/Edge App Mode in background after 2 seconds
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 3; if (Test-Path 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') { Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' '--app=http://localhost:3000' } elseif (Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe') { Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' '--app=http://localhost:3000' } else { Start-Process 'http://localhost:3000' }"

:: Run the Node.js Server in the foreground
node server.js

echo.
echo =======================================================================
echo [پایان اجرای سرور] پنجره تا زمانی که کلیدی را فشار ندهید باز می‌ماند.
echo اگر خطایی در بالا مشاهده می‌کنید، متن آن را بررسی نمایید.
echo =======================================================================
pause

