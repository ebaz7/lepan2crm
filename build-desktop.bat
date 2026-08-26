@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title Sayan Warehouse - Build Windows Desktop Client

:: Always switch to script directory (fixes issues when run as Administrator)
cd /d "%~dp0"

echo =======================================================================
echo          SAYAN WAREHOUSE - WINDOWS DESKTOP BUILDER (Tauri + Rust)
echo =======================================================================
echo.

:: 1. Check for Node.js
echo [1/5] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo =======================================================================
    echo [خطا] برنامه Node.js روی ویندوز شما نصب نیست یا در مسیر سیستم قرار ندارد!
    echo [ERROR] Node.js is NOT installed or not in PATH!
    echo =======================================================================
    echo.
    echo مراحل رفع مشکل:
    echo  1. برنامه Node.js نسخه LTS را از سایت https://nodejs.org دانلود و نصب کنید.
    echo  2. پس از پایان نصب، این پنجره را ببندید و مجدداً فایل را باز کنید.
    echo.
    goto error
)
echo       Node.js is installed. (OK)

:: 2. Check for Cargo / Rust
echo.
echo [2/5] Checking Rust / Cargo installation...
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo =======================================================================
    echo [اطلاعیه مهم] کامپایلر Rust/Cargo بر روی سیستم شما نصب نیست!
    echo [Notice] Rust / Cargo compiler is NOT installed on your system!
    echo =======================================================================
    echo.
    echo برای ساخت فایل نصبی مستقل ویندوز (.exe / .msi با موتور Tauri):
    echo  1. ابتدا برنامه rustup را از https://rustup.rs دانلود و نصب کنید.
    echo  2. ابزار Visual Studio C++ Build Tools را نصب نمایید.
    echo  3. پس از پایان نصب، سیستم یا ترمینال را بازنشانی کرده و مجدداً اجرا کنید.
    echo.
    echo -----------------------------------------------------------------------
    echo اگر بدون نصب Rust می‌خواهید برنامه را به صورت دسکتاپ ویندوز اجرا کنید:
    echo کافیست فایل start_app.bat یا run.bat را اجرا کنید.
    echo -----------------------------------------------------------------------
    echo.
    goto error
)
echo       Rust / Cargo is installed. (OK)

:: 3. Check / Add Target
echo.
echo [3/5] Checking Rust target architecture (x86_64-pc-windows-msvc)...
call rustup target add x86_64-pc-windows-msvc >nul 2>&1
echo       Target configuration completed.

:: 4. Install Node modules
echo.
echo [4/5] Installing npm dependencies...
if not exist node_modules (
    echo Installing node_modules for the first time...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install npm packages!
        goto error
    )
) else (
    echo node_modules already exists. (OK)
)

:: 5. Build Frontend & Tauri App
echo.
echo [5/5] Building Frontend and compiling Windows Desktop Setup (.msi / .exe)...
echo NOTE: Compiling Rust code for the first time may take a few minutes. Please wait...
echo.
call npm run desktop:build
if %errorlevel% neq 0 (
    echo.
    echo =======================================================================
    echo [ERROR] Tauri desktop compilation failed!
    echo خطایی در زمان کامپایل دسکتاپ رخ داد. پیام خطای بالا را بررسی کنید.
    echo =======================================================================
    goto error
)

echo.
echo =======================================================================
echo      BUILD SUCCESSFUL! Windows Desktop Installer has been generated.
echo      فایل نصبی ویندوز با موفقیت ساخته شد!
echo =======================================================================
echo Output files (.msi and .exe installers) are located at:
echo.
echo   .\src-tauri\target\release\bundle\msi\
echo   .\src-tauri\target\release\bundle\nsis\
echo.
echo =======================================================================
echo.
pause
exit /b 0

:error
echo.
echo =======================================================================
echo [BUILD FAILED / متوقف شد]
echo عملیات ساخت فایل نصبی انجام نشد.
echo پنجره بسته نخواهد شد تا بتوانید علت را بررسی کنید.
echo =======================================================================
echo.
pause
exit /b 1
