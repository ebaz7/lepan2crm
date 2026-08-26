@echo off
title Sayan Warehouse - Build Windows Desktop Client (Tauri)
CHCP 65001 > nul
cls

echo =======================================================================
echo          عملیات ساخت پکیج ستاپ دسکتاپ ویندوز سایان (Tauri + Rust)
echo =======================================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] نرم‌افزار Node.js روی سیستم شما نصب نیست یا در مسیر قرار ندارد!
    echo لطفا ابتدا Node.js را از سایت رسمی دانلود و نصب کنید: https://nodejs.org
    goto error
)

:: Check for Cargo/Rust
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] ابزار Rust/Cargo روی سیستم شما نصب نیست!
    echo کلاینت دسکتاپ سایان بر پایه فریم‌ورک فوق‌سریع Tauri و زبان Rust ساخته شده است.
    echo.
    echo لطفا مراحل زیر را برای نصب پیش‌نیازها انجام دهید:
    echo ۱. دانلود و اجرای نصاب Rustup از آدرس: https://rustup.rs
    echo ۲. نصب ابزار ساخت Visual Studio C++ build tools (در هنگام نصب VS یا Rust پیشنهاد می‌شود)
    echo ۳. بستن و باز کردن مجدد این پنجره ترمینال
    echo.
    goto error
)

echo [۱/۴] در حال بررسی پیش‌نیازهای Rust...
rustup target add x86_64-pc-windows-msvc
if %errorlevel% neq 0 (
    echo هشدار: قادر به اضافه کردن تارگت msvc نبودیم، فرض بر این است که از قبل آماده است.
)

echo.
echo [۲/۴] در حال نصب بسته‌های پیش‌نیاز Node...
call npm install
if %errorlevel% neq 0 (
    echo [خطا] در فرآیند نصب ماژول‌های npm خطایی رخ داد!
    goto error
)

echo.
echo [۳/۴] در حال ساخت نسخه نهایی فرانت‌اند (Vite Build)...
call npm run build
if %errorlevel% neq 0 (
    echo [خطا] عملیات بیلد فرانت‌اند با خطا مواجه شد!
    goto error
)

echo.
echo [۴/۴] در حال کامپایل نهایی و ساخت فایل نصب ویندوز (Tauri Setup)...
echo توجه: کامپایل نسخه اول Rust ممکن است چند دقیقه طول بکشد، صبور باشید...
call npm run desktop:build
if %errorlevel% neq 0 (
    echo [خطا] عملیات کامپایل دسکتاپ Tauri با خطا مواجه شد!
    goto error
)

echo.
echo =======================================================================
echo       عملیات با موفقیت پایان یافت! فایل ستاپ ویندوز تولید شد.
echo =======================================================================
echo فایل خروجی ستاپ (.msi و .exe) در مسیر زیر قرار دارد:
echo.
echo   .\src-tauri\target\release\bundle\msi\
echo.
echo می‌توانید فایل نصب را مستقیماً اجرا کرده و بر روی ویندوز نصب نمایید.
echo این نسخه به صورت هوشمند ابتدا به شبکه محلی و در صورت عدم دسترسی به اینترنت متصل می‌شود.
echo =======================================================================
echo.
pause
exit /b 0

:error
echo.
echo [خطا] عملیات متوقف شد. لطفا خطاها را برسی کرده و مجدد تلاش کنید.
echo.
pause
exit /b 1
