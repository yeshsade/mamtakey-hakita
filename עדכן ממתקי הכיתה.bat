@echo off
chcp 65001 >nul
title ממתקי הכיתה - עדכון
cd /d "%~dp0"

echo.
echo  =============================
echo   ממתקי הכיתה - עדכון
echo  =============================
echo.

:: מחיקת קבצים ישנים
echo  מוחק קבצים ישנים...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "package-lock.json" del /q "package-lock.json"
echo  נמחקו!
echo.

:: הורדת קבצים מעודכנים
echo  מוריד קבצים מעודכנים מהאינטרנט...
echo.

powershell -Command "& { $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yeshsade/mamtakey-hakita/main/package.json' -OutFile 'package.json'; Write-Host '  package.json - הורד'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yeshsade/mamtakey-hakita/main/src/database.js' -OutFile 'src\database.js'; Write-Host '  database.js - הורד'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yeshsade/mamtakey-hakita/main/src/server.js' -OutFile 'src\server.js'; Write-Host '  server.js - הורד' }"

echo.
echo  כל הקבצים הורדו!
echo.

:: הגדרת Node.js
if exist "%~dp0node\node.exe" (
    set "PATH=%~dp0node;%PATH%"
)

:: התקנת חבילות
echo  מתקין חבילות (זה אמור לקחת כמה שניות בלבד)...
echo.
call npm install
echo.

if exist "node_modules\sql.js" (
    echo  =============================
    echo.
    echo   העדכון הצליח!
    echo.
    echo   עכשיו הפעל את "הפעל ממתקי הכיתה"
    echo.
    echo  =============================
) else (
    echo  [!] משהו לא עבד. נסה שוב.
)

echo.
pause
