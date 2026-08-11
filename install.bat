@echo off
setlocal enabledelayedexpansion
title Instalador ^| Monitor de Impresoras
cd /d "%~dp0"
set "DIR=%~dp0"

echo.
echo  ============================================================
echo    INSTALADOR  ^|  Monitor de Impresoras
echo  ============================================================
echo.

set "ERRORES=0"
set "RESTART_REQ=0"
:: ════════════════════════════════════════════════════════════════
::  1. Verificar Node.js (minimo v18)
:: ════════════════════════════════════════════════════════════════
echo  [1/5] Verificando Node.js...
where node >nul 2>&1
if errorlevel 1 goto installNode
goto checkNodeVer

:installNode
echo        - Node.js no encontrado. Intentando instalar con winget...
where winget >nul 2>&1
if errorlevel 1 (
    echo        X  winget no esta disponible. Descargalo en: https://nodejs.org
    set /a ERRORES+=1
) else (
    winget install OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent
    if errorlevel 1 (
        echo        X  Error al instalar Node.js con winget.
        set /a ERRORES+=1
    ) else (
        echo        OK Node.js instalado con exito.
        set "RESTART_REQ=1"
    )
)
goto endNodeCheck

:checkNodeVer
for /f "tokens=*" %%V in ('node --version 2^>^&1') do set "NODE_VER=%%V"
powershell -NoProfile -Command "$maj = [int]('!NODE_VER!'.TrimStart('v').Split('.')[0]); if ($maj -ge 18) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo        X  Version !NODE_VER! demasiado antigua. Se requiere v18 o superior.
    echo           Actualiza en: https://nodejs.org
    set /a ERRORES+=1
) else (
    echo        OK !NODE_VER! ^(v18+ requerido^)
)

:endNodeCheck

:: ════════════════════════════════════════════════════════════════
::  2. Verificar Python (minimo 3.x)
:: ════════════════════════════════════════════════════════════════
:checkPython
echo  [2/5] Verificando Python...
where python >nul 2>&1
if errorlevel 1 goto installPython
goto checkPythonVer

:installPython
echo        - Python no encontrado. Intentando instalar con winget...
where winget >nul 2>&1
if errorlevel 1 (
    echo        X  winget no esta disponible. Descargalo en: https://python.org
    set /a ERRORES+=1
) else (
    winget install Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements --silent
    if errorlevel 1 (
        echo        X  Error al instalar Python con winget.
        set /a ERRORES+=1
    ) else (
        echo        OK Python instalado con exito.
        set "RESTART_REQ=1"
    )
)
goto endPythonCheck

:checkPythonVer
for /f "tokens=2" %%V in ('python --version 2^>^&1') do set "PY_VER=%%V"
powershell -NoProfile -Command "$maj = [int]('!PY_VER!'.Split('.')[0]); if ($maj -ge 3) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo        X  Python !PY_VER! demasiado antiguo. Se requiere Python 3 o superior.
    echo           Actualiza en: https://python.org
    set /a ERRORES+=1
) else (
    echo        OK Python !PY_VER! ^(3.x requerido^)
)

:endPythonCheck

:: ════════════════════════════════════════════════════════════════
::  Abortar si hay errores de requisitos previos
:: ════════════════════════════════════════════════════════════════
:checkErrors
if !ERRORES! gtr 0 (
    echo.
    echo  Instala los programas faltantes y vuelve a ejecutar install.bat
    echo.
    pause
    exit /b 1
)

if "!RESTART_REQ!"=="1" (
    echo.
    echo  ============================================================
    echo  SE HAN INSTALADO NUEVOS PROGRAMAS ^(Node.js / Python^).
    echo  Para que el sistema los reconozca, es necesario reiniciar
    echo  esta ventana.
    echo.
    echo  Por favor, cierra esta ventana y vuelve a ejecutar install.bat
    echo  ============================================================
    echo.
    pause
    exit /b 0
)

:: ════════════════════════════════════════════════════════════════
::  3. Instalar dependencias Node.js
:: ════════════════════════════════════════════════════════════════
echo  [3/5] Instalando dependencias Node.js ^(npm install^)...
call npm install >nul 2>&1
if errorlevel 1 (
    echo.
    echo        X  npm install fallo.
    pause
    exit /b 1
)
echo        OK Dependencias Node.js instaladas.

:: ════════════════════════════════════════════════════════════════
::  4. Crear entorno virtual Python e instalar dependencias
:: ════════════════════════════════════════════════════════════════
echo  [4/5] Configurando entorno Python ^(.venv^)...

if not exist ".venv\" (
    echo        Creando entorno virtual...
    python -m venv .venv
    if errorlevel 1 (
        echo        X  No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
)

echo        Instalando requests y schedule...
.venv\Scripts\pip install requests schedule --quiet --disable-pip-version-check
if errorlevel 1 (
    echo        X  pip install fallo.
    pause
    exit /b 1
)
echo        OK Entorno Python configurado.

:: ════════════════════════════════════════════════════════════════
::  Configuracion inicial: users.json
:: ════════════════════════════════════════════════════════════════
if not exist "src\core\storage\users.json" (
    echo.
    echo  Configuracion inicial...
    if exist "src\core\storage\users.json.example" (
        copy "src\core\storage\users.json.example" "src\core\storage\users.json" >nul
        echo        Creado src\core\storage\users.json desde plantilla.
    )
)

:: ════════════════════════════════════════════════════════════════
::  5. Finalizar
:: ════════════════════════════════════════════════════════════════
echo  [5/5] Preparando inicio...
echo        OK Archivos listos.


:: ════════════════════════════════════════════════════════════════
::  Listo
:: ════════════════════════════════════════════════════════════════
echo.
echo  ============================================================
echo    Instalacion completa.
echo    Usa el archivo 'start.bat' en esta carpeta para iniciar el sistema.
echo  ============================================================
echo.
pause
