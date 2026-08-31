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

:: יצירת תיקיות אם חסרות
if not exist "src" mkdir "src"
if not exist "src\routes" mkdir "src\routes"
if not exist "views" mkdir "views"
if not exist "views\partials" mkdir "views\partials"
if not exist "public" mkdir "public"
if not exist "public\css" mkdir "public\css"
if not exist "public\js" mkdir "public\js"

:: הורדת כל הקבצים מהאינטרנט
echo  מוריד קבצים מהאינטרנט...
echo.

powershell -Command "& { $ProgressPreference='SilentlyContinue'; $base='https://raw.githubusercontent.com/yeshsade/mamtakey-hakita/main'; $files=@('package.json','src/server.js','src/database.js','src/routes/api.js','src/routes/admin.js','src/routes/auth.js','src/routes/bank.js','src/routes/store.js'); foreach($f in $files){ $local=$f.Replace('/','\\'); Invoke-WebRequest -Uri \"$base/$f\" -OutFile $local; Write-Host \"  $f - הורד\" } }"

echo.

powershell -Command "& { $ProgressPreference='SilentlyContinue'; $base='https://raw.githubusercontent.com/yeshsade/mamtakey-hakita/main'; $files=@('views/home.ejs','views/login.ejs','views/bank.ejs','views/store.ejs','views/admin.ejs','views/print-cards.ejs','views/distribution-sheet.ejs','views/partials/header.ejs','views/partials/footer.ejs'); foreach($f in $files){ $local=$f.Replace('/','\\'); Invoke-WebRequest -Uri \"$base/$f\" -OutFile $local; Write-Host \"  $f - הורד\" } }"

echo.

powershell -Command "& { $ProgressPreference='SilentlyContinue'; $base='https://raw.githubusercontent.com/yeshsade/mamtakey-hakita/main'; $files=@('public/css/common.css','public/css/home.css','public/css/bank.css','public/css/store.css','public/css/admin.css','public/js/common.js','public/js/bank.js','public/js/store.js'); foreach($f in $files){ $local=$f.Replace('/','\\'); Invoke-WebRequest -Uri \"$base/$f\" -OutFile $local; Write-Host \"  $f - הורד\" } }"

echo.
echo  כל הקבצים הורדו!
echo.

:: הגדרת Node.js
set "NPM_CMD=npm"
if exist "%~dp0node\node.exe" (
    set "PATH=%~dp0node;%PATH%"
    set "NPM_CMD=%~dp0node\npm.cmd"
)

:: התקנת חבילות
echo  מתקין חבילות...
echo.
call "%NPM_CMD%" install

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
