@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo Recolector BYMA con IOL API
echo =========================================

if not exist node_modules (
  echo Instalando dependencias de Node.js...
  call npm install
  if errorlevel 1 (
    echo.
    echo Error instalando dependencias.
    pause
    exit /b 1
  )
)

for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString('dd-MM-yyyy')"') do set "DATE_FOLDER=%%i"
set "OUTPUT_DIR=output\%DATE_FOLDER%"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

if not "%~1"=="" goto RUN_DIRECT

echo.
echo Carpeta de salida del dia: %OUTPUT_DIR%
echo.

node src\appRunner.js --salida="%OUTPUT_DIR%"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% NEQ 0 (
  echo El proceso finalizo con errores. Codigo: %EXIT_CODE%
) else (
  echo Proceso finalizado correctamente.
)

echo.
echo Presione una tecla para cerrar...
pause >nul
exit /b %EXIT_CODE%

:RUN_DIRECT
echo.
echo Ejecutando con argumentos directos: %*
echo Carpeta de salida del dia: %OUTPUT_DIR%
node src\appRunner.js %* --salida="%OUTPUT_DIR%"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% NEQ 0 (
  echo El proceso finalizo con errores. Codigo: %EXIT_CODE%
) else (
  echo Proceso finalizado correctamente.
)

echo.
echo Presione una tecla para cerrar...
pause >nul
exit /b %EXIT_CODE%
