@echo off
setlocal
cd /d "%~dp0"

set "PID_FILE=%TEMP%\carga-express-bot.pid"
if exist "%PID_FILE%" (
  for /f "usebackq delims=" %%P in ("%PID_FILE%") do (
    powershell.exe -NoProfile -Command "$p = Get-Process -Id %%P -ErrorAction SilentlyContinue; if ($p) { exit 0 } else { exit 1 }"
    if not errorlevel 1 (
      echo Carga Express Bot ya esta ejecutandose con PID %%P.
      exit /b 0
    )
  )
  del /q "%PID_FILE%" >nul 2>&1
)

for /f "delims=" %%P in ('powershell.exe -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList @('run.mjs','--local') -WorkingDirectory '%CD%' -PassThru).Id"') do set "BOT_PID=%%P"
if not defined BOT_PID (
  echo No se pudo iniciar Carga Express Bot.
  exit /b 1
)
>"%PID_FILE%" echo %BOT_PID%
echo Carga Express Bot iniciado con PID %BOT_PID%.
exit /b 0
