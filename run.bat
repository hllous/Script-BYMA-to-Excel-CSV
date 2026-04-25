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

:MENU
cls
echo =========================================
echo Recolector BYMA con IOL API
echo =========================================

echo.
echo Seleccione que desea consultar:
echo   1. Acciones
echo   2. Cedears
echo   3. Letras
echo   4. Bonos
echo   5. ONs
echo   6. FCI
echo   7. ETFs
echo   8. Opciones
echo   9. Custom (lista manual)
echo   0. Todos
echo   X. Cerrar
choice /C 1234567890X /N /M "Opcion: "
set "OPT=%ERRORLEVEL%"

if "%OPT%"=="11" goto EXIT_BATCH

set "INSTRUMENTOS=all"
if "%OPT%"=="1" set "INSTRUMENTOS=acciones"
if "%OPT%"=="2" set "INSTRUMENTOS=cedears"
if "%OPT%"=="3" set "INSTRUMENTOS=letras"
if "%OPT%"=="4" set "INSTRUMENTOS=bonos"
if "%OPT%"=="5" set "INSTRUMENTOS=ons"
if "%OPT%"=="6" set "INSTRUMENTOS=fci"
if "%OPT%"=="7" set "INSTRUMENTOS=etfs"
if "%OPT%"=="8" set "INSTRUMENTOS=opciones"
if "%OPT%"=="9" (
  echo.
  set /p INSTRUMENTOS=Ingrese lista separada por comas ^(ej: acciones,cedears^): 
)
if "%OPT%"=="10" set "INSTRUMENTOS=all"

echo.
echo Formato de salida:
echo   1. CSV + XLSX
echo   2. Solo CSV
echo   3. Solo XLSX
choice /C 123 /N /M "Opcion: "
set "FOPT=%ERRORLEVEL%"
set "FORMATO=both"
if "%FOPT%"=="2" set "FORMATO=csv"
if "%FOPT%"=="3" set "FORMATO=xlsx"

echo.
echo Modo de corrida:
echo   1. Rapida (menos simbolos, valida rapido)
echo   2. Completa (todo lo disponible)
echo   3. Custom (usted define)
choice /C 123 /N /M "Opcion: "
set "ROPT=%ERRORLEVEL%"

set "PAGESIZE=25"
set "MAXPAGES=1"
set "CONCURRENCY=5"

if "%ROPT%"=="2" (
  set "PAGESIZE=100"
  set "MAXPAGES=200"
  set "CONCURRENCY=5"
)

if "%ROPT%"=="3" (
  set /p PAGESIZE=PageSize ^(ej 100^): 
  set /p MAXPAGES=MaxPages ^(ej 200^): 
  set /p CONCURRENCY=Concurrency ^(ej 5^): 
)

echo.
echo =========================================
echo Recopilando datos... esto puede tardar.
echo Veras avance por instrumento y progreso.
echo =========================================
echo Carpeta de salida del dia: %OUTPUT_DIR%
echo.

node src\appRunner.js --instrumentos=%INSTRUMENTOS% --formato=%FORMATO% --pageSize=%PAGESIZE% --maxPages=%MAXPAGES% --concurrency=%CONCURRENCY% --salida="%OUTPUT_DIR%"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% NEQ 0 (
  echo El proceso finalizo con errores. Codigo: %EXIT_CODE%
) else (
  echo Proceso finalizado correctamente.
)

echo.
echo Presione una tecla para volver al menu...
pause >nul
goto MENU

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

:EXIT_BATCH
echo.
echo Cerrando Recolector BYMA...
exit /b 0
