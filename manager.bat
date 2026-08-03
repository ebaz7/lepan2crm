@echo off
setlocal EnableDelayedExpansion
color 0B
title Payment System Deployment Manager

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo =======================================================
    echo ERROR: ADMINISTRATOR PRIVILEGES REQUIRED
    echo =======================================================
    echo Please right-click on this script and select
    echo "Run as administrator".
    echo =======================================================
    pause
    exit /b
)

:MENU
cls
echo ========================================================
echo         Payment System - Deployment Manager
echo ========================================================
echo 1. Install (Clone from GitHub, Setup, Install Service)
echo 2. Update (Backup DB/Env, Pull changes, Restart Service)
echo 3. Uninstall (Backup DB/Env, Remove Service)
echo 4. Exit
echo ========================================================
set /p choice="Select an option (1-4): "

if "%choice%"=="1" goto INSTALL
if "%choice%"=="2" goto UPDATE
if "%choice%"=="3" goto UNINSTALL
if "%choice%"=="4" goto EOF

goto MENU

:INSTALL
cls
echo ========================================================
echo                      INSTALLATION
echo ========================================================
echo WARNING: This will install into the CURRENT directory.
call :BACKUP

echo.
set /p repo="Enter GitHub repository URL (e.g. https://github.com/user/repo.git): "
if "!repo!"=="" goto MENU
set /p branch="Enter branch name (default: main): "
if "!branch!"=="" set branch=main

echo.
echo [1/4] Cloning repository...
git init
git remote add origin !repo!
git fetch origin
git reset --hard origin/!branch!
git branch -M !branch!
git branch --set-upstream-to=origin/!branch! !branch!
if errorlevel 1 (
    echo [ERROR] Git clone/fetch failed. Make sure git is installed and repo URL is correct.
    pause
    goto MENU
)

echo.
echo [2/4] Installing Node.js dependencies...
call npm install

echo.
echo [3/4] Patching dependencies (if required)...
if exist patch-dependencies.js node patch-dependencies.js

echo.
echo [4/4] Setting up the Windows Service...
if exist install-service.js (
    node install-service.js
) else (
    echo [ERROR] install-service.js not found.
)

echo ========================================================
echo Installation finished!
echo ========================================================
pause
goto MENU

:UPDATE
cls
echo ========================================================
echo                        UPDATE
echo ========================================================
call :BACKUP

echo.
set /p repo="Enter GitHub repository URL (e.g. https://github.com/user/repo.git): "
if "!repo!"=="" goto MENU
set /p branch="Enter branch name (default: main): "
if "!branch!"=="" set branch=main

echo.
echo [1/4] Pulling latest changes from GitHub...
if not exist .git (
    git init
)
git remote remove origin 2>nul
git remote add origin !repo!
git fetch origin
git reset --hard origin/!branch!
git branch -M !branch!
git branch --set-upstream-to=origin/!branch! !branch!
if errorlevel 1 (
    echo [WARNING] git fetch/reset failed. Check if repository is reachable.
)

echo.
echo [2/4] Installing/Updating dependencies...
call npm install

echo.
echo [3/4] Patching dependencies (if required)...
if exist patch-dependencies.js node patch-dependencies.js

echo.
echo [4/4] Restarting Windows Service...
net stop PaymentSystem
net start PaymentSystem

echo ========================================================
echo Update finished!
echo ========================================================
pause
goto MENU

:UNINSTALL
cls
echo ========================================================
echo                      UNINSTALL
echo ========================================================
call :BACKUP

echo.
echo Removing Windows Service...
if exist uninstall-service.js (
    node uninstall-service.js
) else (
    echo [ERROR] uninstall-service.js not found.
)

echo ========================================================
echo Uninstallation finished!
echo ========================================================
pause
goto MENU

:BACKUP
echo.
echo Creating backup of critical files (database.json, .env)...
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set timestamp=!datetime:~0,4!!datetime:~4,2!!datetime:~6,2!_!datetime:~8,2!!datetime:~10,2!!datetime:~12,2!
set backup_dir=backup_!timestamp!
mkdir "!backup_dir!"
if exist database.json copy database.json "!backup_dir!\" >nul
if exist .env copy .env "!backup_dir!\" >nul
echo Backup saved in !backup_dir! folder.
exit /b
