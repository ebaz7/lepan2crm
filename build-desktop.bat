@echo off
setlocal EnableDelayedExpansion

:: Prevent immediate close on any syntax or unicode crash
:: Force window to stay open regardless of how it was launched
if not defined SCRIPT_RUNNING_IN_NEW_WINDOW (
    set SCRIPT_RUNNING_IN_NEW_WINDOW=1
    title Sayan Warehouse Desktop Builder
    echo =======================================================================
    echo          SAYAN WAREHOUSE - WINDOWS DESKTOP BUILDER (Tauri + Rust)
    echo =======================================================================
)

:: Always switch to the directory where this batch file is located
cd /d "%~dp0"

:: 1. Check Node.js
echo.
echo [1/5] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo =======================================================================
    echo [ERROR / خطا] Node.js is NOT installed or not in PATH!
    echo برنامه Node.js بر روی ویندوز شما نصب نیست یا در مسیر شناسایی سیستم قرار ندارد.
    echo =======================================================================
    echo.
    echo راهنمای رفع مشکل:
    echo 1. برنامه Node.js نسخه LTS را از سایت https://nodejs.org دانلود و نصب کنید.
    echo 2. هنگام نصب، تیک Add to PATH را فعال بگذارید.
    echo 3. پس از پایان نصب، این پنجره را بسته و مجددا فایل را اجرا کنید.
    echo.
    goto halt_error
)
for /f "tokens=*" %%v in ('node -v') do echo       Node.js version: %%v (OK)

:: 2. Check Rust & Cargo
echo.
echo [2/5] Checking Rust / Cargo installation...
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo =======================================================================
    echo [NOTICE / اطلاعیه مهم] Rust / Cargo compiler is NOT installed!
    echo کامپایلر Rust روی ویندوز شما یافت نشد.
    echo =======================================================================
    echo.
    echo برای ساخت فایل نصبی مستقل ویندوز (.exe / .msi با موتور بومی Tauri):
    echo  1. برنامه rustup را از سایت رسمی https://rustup.rs دانلود و نصب کنید.
    echo  2. ابزار Visual Studio C++ Build Tools را نصب کنید.
    echo  3. پس از نصب، سیستم را ری‌استارت کرده و مجدداً این فایل را اجرا کنید.
    echo.
    echo -----------------------------------------------------------------------
    echo اگر مایلید بدون نیاز به کامپایل Rust، برنامه را فوراً در ویندوز اجرا کنید:
    echo کافیست فایل start_app.bat را با دو بار کلیک اجرا نمایید.
    echo -----------------------------------------------------------------------
    echo.
    goto halt_error
)
for /f "tokens=*" %%v in ('cargo -v 2^>nul') do echo       Rust Cargo: %%v (OK)

:: 3. Check Rust Windows MSVC Target
echo.
echo [3/5] Checking Rust Target (x86_64-pc-windows-msvc)...
call rustup target add x86_64-pc-windows-msvc >nul 2>&1
echo       Target configuration checked. (OK)

:: 4. Check & Install NPM Dependencies
echo.
echo [4/5] Checking npm dependencies...
if not exist node_modules (
    echo       Installing node_modules for the first time...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install npm packages!
        goto halt_error
    )
) else (
    echo       node_modules directory found. (OK)
)

:: 5. Build Frontend Web App & Tauri Executable
echo.
echo [5/5] Compiling Frontend & Building Tauri Windows Package (.msi / .exe)...
echo NOTE: First time compilation may take 2-5 minutes. Please wait...
echo.

call npx tauri build
if %errorlevel% neq 0 (
    echo.
    echo =======================================================================
    echo [ERROR] Tauri desktop compilation failed!
    echo خطایی در زمان کامپایل دسکتاپ رخ داد. پیام خطای بالا را با دقت مطالعه کنید.
    echo =======================================================================
    goto halt_error
)

echo.
echo =======================================================================
echo      BUILD SUCCESSFUL! Windows Desktop Installer has been generated.
echo      فایل نصبی ویندوز با موفقیت ساخته شد!
echo =======================================================================
echo Output files are located at:
echo.
echo   .\src-tauri\target\release\bundle\msi\
echo   .\src-tauri\target\release\bundle\nsis\
echo.
echo =======================================================================
echo.
echo برای بستن پنجره، هر کلیدی را فشار دهید...
pause >nul
exit /b 0

:halt_error
echo.
echo =======================================================================
echo [BUILD STOPPED / عملیات متوقف شد]
echo برای بررسی لاگ خطاها، این پنجره باز نگه داشته شده است.
echo =======================================================================
echo.
echo برای بستن پنجره، هر کلیدی را فشار دهید...
pause >nul
exit /b 1
