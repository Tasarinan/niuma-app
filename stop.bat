@echo off
echo ========================================
echo   Stopping Niuma
echo ========================================
echo.

echo Killing Niuma processes...
taskkill /F /IM "niuma.exe" 2>nul && echo   - Killed niuma.exe || echo   - niuma.exe not running

echo Killing Cargo/Rust processes...
taskkill /F /IM "cargo.exe" 2>nul && echo   - Killed cargo.exe || echo   - cargo.exe not running

echo Killing Node processes on port 1420...
npx kill-port 1420 2>nul && echo   - Killed port 1420 || echo   - Port 1420 not in use

echo.
echo Done! All Niuma processes should be stopped.
pause
