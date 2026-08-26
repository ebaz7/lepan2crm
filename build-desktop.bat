@echo off
setlocal EnableDelayedExpansion
title Sayan Warehouse - Build Windows Desktop Client (Tauri + Rust)
cls

echo =======================================================================
echo          SAYAN WAREHOUSE - WINDOWS DESKTOP BUILDER (Tauri + Rust)
echo =======================================================================
echo.

:: 1. Check for Node.js
echo [1/5] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is NOT installed on your computer or not in PATH!
    echo.
    echo Please follow these steps:
    echo  1. Download and install Node.js from: https://nodejs.org/
    echo  2. Restart your terminal / Command Prompt after installation.
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
    echo [ERROR] Rust / Cargo compiler is NOT installed on your system!
    echo =======================================================================
    echo Tauri desktop client requires the Rust programming language.
    echo.
    echo Please install the prerequisites:
    echo  1. Download and run rustup installer from: https://rustup.rs
    echo  2. Install Visual Studio C++ Build Tools when prompted (or via Visual Studio Installer).
    echo  3. Restart this Command Prompt window after installation completes.
    echo.
    goto error
)
echo       Rust / Cargo is installed. (OK)

:: 3. Check / Add Target
echo.
echo [3/5] Checking Rust target architecture (x86_64-pc-windows-msvc)...
rustup target add x86_64-pc-windows-msvc >nul 2>&1
echo       Target configuration completed.

:: 4. Install Node modules
echo.
echo [4/5] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install npm packages!
    echo Please check your internet connection and proxy settings.
    goto error
)

:: 5. Build Frontend & Tauri App
echo.
echo [5/5] Building Frontend and compiling Windows Desktop Setup (.msi / .exe)...
echo NOTE: Compiling Rust code for the first time may take a few minutes. Please wait...
echo.
call npm run desktop:build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Tauri desktop compilation failed!
    echo Check the error logs above for details.
    goto error
)

echo.
echo =======================================================================
echo      BUILD SUCCESSFUL! Windows Desktop Installer has been generated.
echo =======================================================================
echo Output files (.msi and .exe installers) are located at:
echo.
echo   .\src-tauri\target\release\bundle\msi\
echo   .\src-tauri\target\release\bundle\nsis\
echo.
echo You can run the setup installer to install the Sayan Desktop App on Windows.
echo =======================================================================
echo.
pause
exit /b 0

:error
echo =======================================================================
echo [BUILD FAILED] The build process was aborted due to missing requirements.
echo Please resolve the issues mentioned above and run build-desktop.bat again.
echo =======================================================================
echo.
pause
exit /b 1

