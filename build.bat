@echo off
echo ========================================
echo   Building Niuma for Distribution
echo ========================================
echo.

cd /d "%~dp0"

echo This will create an installer you can share.
echo Build typically takes 2-5 minutes...
echo.

npm run tauri build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Build Complete!
    echo ========================================
    echo.
    echo Your installers are ready at:
    echo   src-tauri\target\release\bundle\msi\
    echo   src-tauri\target\release\bundle\nsis\
    echo.
    echo Opening the bundle folder...
    explorer "src-tauri\target\release\bundle"
) else (
    echo.
    echo Build failed! Check the errors above.
)

pause
