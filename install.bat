@echo off
chcp 65001 >nul
title ממתקי הכיתה - התקנה אוטומטית
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║                                      ║
echo  ║     🍬  ממתקי הכיתה  🏦             ║
echo  ║     התקנה אוטומטית מלאה              ║
echo  ║                                      ║
echo  ╚══════════════════════════════════════╝
echo.
echo  שב בנוח, הכל קורה לבד...
echo.

:: קביעת תיקיית התקנה
set "INSTALL_DIR=%USERPROFILE%\Desktop\ממתקי הכיתה"

:: בדיקה אם כבר מותקן ורץ
if exist "%INSTALL_DIR%\src\server.js" (
    echo  [✓] המערכת כבר מותקנת!
    echo      עובר להפעלה...
    echo.
    cd /d "%INSTALL_DIR%"
    goto :startserver
)

:: ═══════════════════════════════════════
:: שלב 1: הורדת הפרויקט
:: ═══════════════════════════════════════
echo  ── שלב 1/3: מוריד את התוכנה מהאינטרנט ──
echo.

if exist "%TEMP%\mamtakey.zip" del /q "%TEMP%\mamtakey.zip"
if exist "%TEMP%\mamtakey-temp" rmdir /s /q "%TEMP%\mamtakey-temp"

powershell -Command "& { $ProgressPreference='SilentlyContinue'; Write-Host '  מוריד קבצים מ-GitHub...'; try { Invoke-WebRequest -Uri 'https://github.com/yeshsade/mamtakey-hakita/archive/refs/heads/main.zip' -OutFile '%TEMP%\mamtakey.zip' -UseBasicParsing } catch { Write-Host '  [!] ההורדה נכשלה. בדוק חיבור אינטרנט.'; exit 1 } }"

if not exist "%TEMP%\mamtakey.zip" (
    echo.
    echo  [!] ההורדה נכשלה. בדוק שיש חיבור לאינטרנט.
    echo.
    pause
    exit /b
)

echo  [✓] ההורדה הצליחה!
echo.

:: פריסה לשולחן העבודה
echo  פורס קבצים לשולחן העבודה...

powershell -Command "& { $ProgressPreference='SilentlyContinue'; if (Test-Path '%INSTALL_DIR%') { Remove-Item '%INSTALL_DIR%' -Recurse -Force }; Expand-Archive -Path '%TEMP%\mamtakey.zip' -DestinationPath '%TEMP%\mamtakey-temp' -Force; Move-Item '%TEMP%\mamtakey-temp\mamtakey-hakita-main' '%INSTALL_DIR%'; Remove-Item '%TEMP%\mamtakey-temp' -Recurse -Force; Remove-Item '%TEMP%\mamtakey.zip' -Force }"

if not exist "%INSTALL_DIR%\src\server.js" (
    echo  [!] הפריסה נכשלה.
    pause
    exit /b
)

echo  [✓] הקבצים בשולחן העבודה!
echo.

cd /d "%INSTALL_DIR%"

:: ═══════════════════════════════════════
:: שלב 2: בדיקת/התקנת Node.js
:: ═══════════════════════════════════════
echo  ── שלב 2/3: בודק Node.js ──
echo.

:: בדיקה אם Node.js מותקן במערכת
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo  [✓] Node.js נמצא במערכת!
    echo.
    goto :step3
)

:: בדיקה אם Node.js מקומי כבר קיים
if exist "%INSTALL_DIR%\node\node.exe" (
    echo  [✓] Node.js מקומי נמצא!
    echo.
    goto :step3
)

:: הורדת Node.js נייד
echo  Node.js לא נמצא. מוריד גרסה ניידת...
echo  (זה יכול לקחת כמה דקות)
echo.

powershell -Command "& { $ProgressPreference='SilentlyContinue'; Write-Host '  מוריד Node.js...'; try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip' -OutFile '%TEMP%\node-temp.zip' -UseBasicParsing } catch { Write-Host '  [!] הורדת Node.js נכשלה.'; exit 1 } }"

if not exist "%TEMP%\node-temp.zip" (
    echo  [!] הורדת Node.js נכשלה. בדוק אינטרנט.
    pause
    exit /b
)

powershell -Command "& { $ProgressPreference='SilentlyContinue'; Write-Host '  פורס Node.js...'; Expand-Archive -Path '%TEMP%\node-temp.zip' -DestinationPath '%INSTALL_DIR%' -Force; Rename-Item '%INSTALL_DIR%\node-v22.12.0-win-x64' '%INSTALL_DIR%\node' -ErrorAction SilentlyContinue; Remove-Item '%TEMP%\node-temp.zip' -Force }"

if not exist "%INSTALL_DIR%\node\node.exe" (
    echo  [!] התקנת Node.js נכשלה.
    pause
    exit /b
)

echo  [✓] Node.js הותקן!
echo.

:step3
:: ═══════════════════════════════════════
:: שלב 3: הגדרת PATH והפעלה
:: ═══════════════════════════════════════
echo  ── שלב 3/3: מפעיל את המערכת ──
echo.

:startserver

:: הגדרת Node.js מקומי ב-PATH
if exist "%INSTALL_DIR%\node\node.exe" (
    set "PATH=%INSTALL_DIR%\node;%PATH%"
)

:: יצירת תיקיית data אם לא קיימת
if not exist "%INSTALL_DIR%\data" mkdir "%INSTALL_DIR%\data"

echo.
echo  ╔══════════════════════════════════════╗
echo  ║                                      ║
echo  ║     ההתקנה הושלמה בהצלחה! 🎉        ║
echo  ║                                      ║
echo  ║     המערכת עולה עכשיו...             ║
echo  ║                                      ║
echo  ║     כתובת: http://localhost:3001     ║
echo  ║                                      ║
echo  ╚══════════════════════════════════════╝
echo.

:: הצגת כתובת רשת
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo   ממחשב אחר ברשת: http://%%b:3001
        echo.
    )
)

echo   בפעם הראשונה: צור חשבון מנהל במסך שייפתח
echo.
echo   לסגירה: סגור את החלון הזה
echo.

:: פתיחת הדפדפן ואז הפעלת השרת
start http://localhost:3001
node src/server.js
