@echo off
title FANTABUNDES - CHIUSURA DI EMERGENZA
echo =========================================
echo   CHIUSURA FORZATA SISTEMA FANTACALCIO
echo =========================================
echo.
echo Questo comando spegnera' istantaneamente il server e le schermate.
echo.
pause

echo.
echo Chiusura di tutti i processi "node.exe" in corso...
taskkill /F /IM node.exe

echo.
echo Processi terminati con successo!
echo Puoi riavviare il sistema usando "AVVIA_SISTEMA.bat".
echo.
pause
exit
