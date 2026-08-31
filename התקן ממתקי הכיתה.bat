@echo off
chcp 65001 >nul
title ממתקי הכיתה - התקנה והפעלה

echo.
echo  ==========================================
echo   ממתקי הכיתה - התקנה אוטומטית והפעלה
echo  ==========================================
echo.

:: קביעת תיקייה על שולחן העבודה
set "INSTALL_DIR=%USERPROFILE%\Desktop\ממתקי הכיתה"

:: בדיקה אם כבר מותקן
if exist "%INSTALL_DIR%\src\server.js" (
    echo  המערכת כבר מותקנת!
    echo  מפעיל...
    echo.
    cd /d "%INSTALL_DIR%"
    goto :run
)

echo  שלב 1 מתוך 3: מוריד את הפרויקט מהאינטרנט...
echo.

:: הורדת הפרויקט מ-GitHub
powershell -Command "& { $ProgressPreference='SilentlyContinue'; Write-Host '  מוריד קבצים...'; Invoke-WebRequest -Uri 'https://github.com/yeshsade/mamtakey-hakita/archive/refs/heads/main.zip' -OutFile '%TEMP%\mamtakey.zip' }"

if not exist "%TEMP%\mamtakey.zip" (
    echo  [!] ההורדה נכשלה. בדוק חיבור לאינטרנט.
    pause
    exit
)

:: פריסה לשולחן העבודה
powershell -Command "& { $ProgressPreference='SilentlyContinue'; Write-Host '  פורס קבצים...'; if (Test-Path '%INSTALL_DIR%') { Remove-Item '%INSTALL_DIR%' -Recurse -Force }; Expand-Archive -Path '%TEMP%\mamtakey.zip' -DestinationPath '%TEMP%\mamtakey-temp' -Force; Move-Item '%TEMP%\mamtakey-temp\mamtakey-hakita-main' '%INSTALL_DIR%'; Remove-Item '%TEMP%\mamtakey-temp' -Recurse -Force; Remove-Item '%TEMP%\mamtakey.zip' }"

if not exist "%INSTALL_DIR%\src\server.js" (
    echo  [!] הפריסה נכשלה.
    pause
    exit
)

echo  הפרויקט הותקן בשולחן העבודה!
echo.

cd /d "%INSTALL_DIR%"

:: בדיקה והתקנת Node.js
echo  שלב 2 מתוך 3: בודק Node.js...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%INSTALL_DIR%\node\node.exe" (
        echo  נמצא Node.js מקומי
    ) else (
        echo  מוריד Node.js (זה לוקח כמה דקות)...
        echo.
        powershell -Command "& { $ProgressPreference='SilentlyContinue'; Write-Host '  מוריד Node.js...'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip' -OutFile '%TEMP%\node-temp.zip'; Write-Host '  פורס Node.js...'; Expand-Archive -Path '%TEMP%\node-temp.zip' -DestinationPath '%INSTALL_DIR%' -Force; Rename-Item '%INSTALL_DIR%\node-v22.12.0-win-x64' '%INSTALL_DIR%\node'; Remove-Item '%TEMP%\node-temp.zip' }"

        if not exist "%INSTALL_DIR%\node\node.exe" (
            echo  [!] הורדת Node.js נכשלה.
            pause
            exit
        )
        echo  Node.js הותקן!
        echo.
    )
)

:run

:: הגדרת Node.js
if exist "%INSTALL_DIR%\node\node.exe" (
    set "PATH=%INSTALL_DIR%\node;%PATH%"
)

:: התקנת חבילות
if not exist "node_modules" (
    echo  שלב 3 מתוך 3: מתקין חבילות...
    echo.
    call npm install
    echo.
    echo  ההתקנה הושלמה!
    echo.
)

:: הצגת מידע
echo  ==========================================
echo.
echo   המערכת עולה!
echo.
echo   כתובת: http://localhost:3001
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
echo  ==========================================
echo.
echo  לסגירה: סגור את החלון הזה
echo.

start http://localhost:3001
node src/server.js
