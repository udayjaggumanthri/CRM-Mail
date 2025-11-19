@echo off
REM Deployment script for Conference CRM (Windows)
REM This script updates the code, clears caches, and restarts the application

echo.
echo ========================================
echo   Conference CRM Deployment Script
echo ========================================
echo.
echo ⚠️  Tip: Enable maintenance mode or notify users before deploying.
echo.
set /p BACKUP_CONFIRM=Have you created a fresh backup of the production database? (yes/no): 
if /I not "%BACKUP_CONFIRM%"=="yes" (
    echo Deployment aborted. Please back up the database first.
    pause
    exit /b 1
)

REM Step 1: Pull latest code
echo [1/5] Pulling latest code from git...
git pull origin main
if errorlevel 1 (
    echo Trying master branch...
    git pull origin master
)
if errorlevel 1 (
    echo ERROR: Failed to pull latest code
    pause
    exit /b 1
)

REM Step 2: Install dependencies
echo.
echo [2/5] Installing dependencies...
cd server
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install server dependencies
    pause
    exit /b 1
)
cd ..\client
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install client dependencies
    pause
    exit /b 1
)
cd ..

REM Step 3: Offer to run migrations
echo.
set /p RUN_MIGRATIONS=Run pending database migrations now? (y/N): 
if /I "%RUN_MIGRATIONS%"=="y" (
    echo [3/6] Running migrations...
    cd server
    call npm run migrate
    if errorlevel 1 (
        echo ERROR: Migrations failed. Resolve issues before restarting.
        pause
        exit /b 1
    )
    cd ..
) else (
    echo Skipping migrations. Run "cd server && npm run migrate" manually if needed.
)

REM Step 4: Clear build cache
echo.
echo [4/6] Clearing build cache...
if exist client\build rmdir /s /q client\build
if exist client\node_modules\.cache rmdir /s /q client\node_modules\.cache
if exist server\node_modules\.cache rmdir /s /q server\node_modules\.cache

REM Step 5: Clear browser cache markers
echo.
echo [5/6] Clearing cache markers...
REM Touch index.html to trigger cache clear
copy /b client\public\index.html +,,
echo Cache cleared

REM Step 6: Restart instructions
echo.
echo [6/6] Deployment script complete!
echo.
echo ========================================
echo   IMPORTANT: Restart Required
echo ========================================
echo.
echo 1. STOP the current servers:
echo    - Press Ctrl+C in the backend server window
echo    - Press Ctrl+C in the frontend client window
echo    - Wait for both to stop completely
echo.
echo 2. RESTART the application:
echo    - Run: start-windows.bat
echo    - Or manually:
echo      Backend: cd server ^&^& node index.js
echo      Frontend: cd client ^&^& npm start
echo.
echo 3. CLEAR browser cache (if UI doesn't update):
echo    - Press Ctrl+Shift+Delete
echo    - Select "Cached images and files"
echo    - Click "Clear data"
echo    - Or do a hard refresh: Ctrl+Shift+R
echo.
echo ========================================
echo   Why restart is needed:
echo ========================================
echo.
echo The React dev server (npm start) needs to be
echo restarted after git pull to pick up changes.
echo The webpack dev server caches files and won't
echo automatically detect changes from git pull.
echo.
echo ========================================
echo.
pause
