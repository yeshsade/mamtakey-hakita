@echo off
chcp 65001 >nul
title ממתקי הכיתה
cd /d "%~dp0"

echo.
echo  =============================
echo   ממתקי הכיתה - הפעלה
echo  =============================
echo.

:: בדיקה אם Node.js קיים (מותקן או מקומי)
set "NODE_CMD=node"
set "NPM_CMD=npm"

where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%~dp0node\node.exe" (
        set "NODE_CMD=%~dp0node\node.exe"
        set "NPM_CMD=%~dp0node\npm.cmd"
        set "PATH=%~dp0node;%PATH%"
        echo  נמצא Node.js מקומי
    ) else (
        echo  Node.js לא נמצא - מוריד אוטומטית...
        echo  זה יכול לקחת כמה דקות...
        echo.

        :: הורדת Node.js portable
        powershell -Command "& { $ProgressPreference='SilentlyContinue'; Write-Host '  מוריד Node.js...'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip' -OutFile '%~dp0node-temp.zip'; Write-Host '  פורס קבצים...'; Expand-Archive -Path '%~dp0node-temp.zip' -DestinationPath '%~dp0' -Force; Rename-Item '%~dp0node-v22.12.0-win-x64' '%~dp0node'; Remove-Item '%~dp0node-temp.zip' }"

        if exist "%~dp0node\node.exe" (
            set "NODE_CMD=%~dp0node\node.exe"
            set "NPM_CMD=%~dp0node\npm.cmd"
            set "PATH=%~dp0node;%PATH%"
            echo.
            echo  Node.js הותקן בהצלחה!
            echo.
        ) else (
            echo.
            echo  [!] ההורדה נכשלה.
            echo  נסה להוריד ידנית מ: https://nodejs.org
            echo.
            pause
            exit
        )
    )
)

:: התקנת חבילות בפעם הראשונה
if not exist "node_modules" (
    echo  מתקין חבילות בפעם הראשונה...
    echo  זה יכול לקחת דקה...
    echo.
    call "%NPM_CMD%" install
    echo.
    echo  ההתקנה הושלמה!
    echo.
)

:: הצגת כתובת הרשת
echo  =============================
echo.
echo   המערכת עולה...
echo.
echo   פתח בדפדפן:
echo   http://localhost:3001
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo   ממחשב אחר ברשת:
        echo   http://%%b:3001
        echo.
    )
)

echo   כניסת מנהל: admin / 1234
echo.
echo  =============================
echo.
echo  לסגירה: סגור את החלון הזה
echo.

:: פתיחת הדפדפן והרצת השרת
start http://localhost:3001
"%NODE_CMD%" src/server.js
