@echo off
title Monitor de Impresoras ^| Iniciando...
cd /d "%~dp0"

if exist ".node\node.exe" (
    set "NODE_CMD=.node\node.exe launcher.js"
) else (
    set "NODE_CMD=node launcher.js"
)

start "Monitor | Servicios" cmd /k "%NODE_CMD%"

echo Esperando servidor web...
set /a INTENTOS=0
:poll
set /a INTENTOS+=1
if %INTENTOS% gtr 30 (
    echo Tiempo de espera agotado. Verifica la ventana de servicios.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try{Invoke-WebRequest 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 goto poll

echo Servidor listo. Abriendo dashboard...
start "" "http://127.0.0.1:3000"
