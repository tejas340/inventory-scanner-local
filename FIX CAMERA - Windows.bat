@echo off
setlocal
cd /d "%~dp0"
echo.
echo Inventory Scanner - iPhone camera fix
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-windows-https.ps1"
endlocal
