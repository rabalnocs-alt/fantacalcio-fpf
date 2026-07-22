@echo off
title FANTABUNDES - AVVIO SISTEMA
:: Forza lo script ad usare sempre la cartella in cui si trova il file come punto di partenza!
cd /d "%~dp0"

echo =========================================
echo   AVVIO SISTEMA FANTACALCIO FPF
echo =========================================
echo.

echo Sto chiudendo eventuali vecchie sessioni rimaste appese...
taskkill /F /IM node.exe > nul 2>&1

echo [1/3] Avvio del Server Centrale (Backend)...
start "Backend Fanta" cmd /k "cd backend && node index.js"

echo [2/3] Avvio dell'Interfaccia Schermi (Frontend)...
start "Frontend Fanta" cmd /k "cd frontend && node node_modules\vite\bin\vite.js --host"

echo [3/3] Attendo l'avvio dei server...
timeout /t 8 /nobreak > nul

start http://localhost:5173/admin
start http://localhost:5173/

echo =========================================
echo   TUTTO PRONTO!
echo =========================================
echo Lascia aperte le finestre nere.
timeout /t 5 /nobreak > nul
exit
