@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Construction de GP Party...
call npm run build
if errorlevel 1 (
  echo La construction a echoue.
  pause
  exit /b 1
)
echo Demarrage du serveur...
call npm start
pause
