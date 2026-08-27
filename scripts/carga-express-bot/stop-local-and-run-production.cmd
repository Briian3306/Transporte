@echo off
setlocal
cd /d "%~dp0"

set "PID_FILE=%TEMP%\carga-express-bot.pid"
if exist "%PID_FILE%" (
  for /f "usebackq delims=" %%P in ("%PID_FILE%") do (
    powershell.exe -NoProfile -Command "Stop-Process -Id %%P -Force -ErrorAction SilentlyContinue"
    echo Carga Express Bot local detenido (PID %%P).
  )
  del /q "%PID_FILE%" >nul 2>&1
) else (
  echo No se encontro un PID local guardado; se continua con la ejecucion de produccion.
)

node.exe run.mjs
exit /b %ERRORLEVEL%
