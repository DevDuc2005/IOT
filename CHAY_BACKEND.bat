@echo off
setlocal
cd /d "%~dp0backend"
if not exist ".env" copy ".env.example" ".env"
echo Stop any previous backend before continuing.
call npm install
if errorlevel 1 goto error
node src/backup-db.js
if errorlevel 1 goto error
call npx prisma generate
if errorlevel 1 goto error
call npx prisma db push
if errorlevel 1 goto error
call npm run dev
goto end
:error
echo Setup failed. Read the error above. Existing .env was not overwritten.
:end
pause
