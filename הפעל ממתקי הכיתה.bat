@echo off
chcp 65001 >nul
title ממתקי הכיתה

echo.
echo  =============================
echo   ממתקי הכיתה - הפעלה
echo  =============================
echo.

:: בדיקה אם Node.js מותקן
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%~dp0node.exe" (
        set "PATH=%~dp0;%PATH%"
        echo  נמצא node.exe מקומי
    ) else (
        echo  [!] Node.js לא מותקן
        echo.
        echo  הורד והתקן מכאן:
        echo  https://nodejs.org
        echo.
        echo  לחץ Enter לפתוח את האתר...
        pause >nul
        start https://nodejs.org
        exit
    )
)

cd /d "%~dp0"

:: התקנת חבילות בפעם הראשונה
if not exist "node_modules" (
    echo  מתקין חבילות בפעם הראשונה...
    echo  זה יכול לקחת דקה...
    echo.
    call npm install
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
echo   http://localhost:3000
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo   ממחשב אחר ברשת:
        echo   http://%%b:3000
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
start http://localhost:3000
node src/server.js
