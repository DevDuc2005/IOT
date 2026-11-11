@echo off
title IOT DASHBOARD - CHAY NHANH
setlocal

echo =======================================================
echo    DANG KHOI DONG HE THONG IOT DASHBOARD (SIEU TOC)
echo =======================================================

:: 1. Khoi dong Backend (Port 4000) o cua so rieng
echo [1/3] Khoi dong Backend API (Port 4000)...
start "IoT Backend (Port 4000)" cmd /k "cd /d %~dp0backend && npm run dev"

:: 2. Khoi dong Frontend (Port 5173) o cua so rieng
echo [2/3] Khoi dong Frontend Web (Port 5173)...
start "IoT Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

:: 3. Doi 2 giay de server khoi dong va tu dong mo trinh duyet
timeout /t 2 /nobreak >nul
echo [3/3] Dang mo trinh duyet Dashboard...
start http://localhost:5173/

echo =======================================================
echo    DA KHOI DONG XONG!
echo    - Backend:  http://localhost:4000
echo    - Frontend: http://localhost:5173
echo =======================================================
exit
