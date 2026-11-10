@echo off
setlocal
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 goto error
call npm run build
if errorlevel 1 goto error
call npm run dev
goto end
:error
echo Web setup or build failed. Read the error above.
:end
pause
