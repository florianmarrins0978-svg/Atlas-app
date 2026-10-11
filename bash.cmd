@echo off
REM Simple wrapper to run the Node bash shim so spawn('bash', ...) works on Windows
node "%~dp0\scripts\bash-shim.js" %*
