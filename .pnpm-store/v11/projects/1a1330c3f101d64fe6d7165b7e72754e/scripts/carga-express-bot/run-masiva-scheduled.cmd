@echo off
setlocal
cd /d "%~dp0"
node.exe .\run-masiva.mjs
exit /b %ERRORLEVEL%
