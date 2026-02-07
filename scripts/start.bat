@echo off
setlocal

set "ROOT_DIR=%~dp0.."
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"
set "PY_ENV=%ROOT_DIR%\backend\.venv"

if not exist "%PY_ENV%\Scripts\python.exe" (
  echo Python venv missing: %PY_ENV%
  echo Run scripts\install_windows.ps1 first.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is not available in PATH.
  echo Install Node.js and retry.
  exit /b 1
)

if not defined ACE_STEP_PORT set "ACE_STEP_PORT=8788"
if not defined ACE_STEP_UI_PORT set "ACE_STEP_UI_PORT=5175"
if not defined ACE_STEP_HOST set "ACE_STEP_HOST=0.0.0.0"

echo Starting backend on %ACE_STEP_HOST%:%ACE_STEP_PORT%
start "ACE Backend" cmd /k "cd /d "%ROOT_DIR%" && call "%PY_ENV%\Scripts\activate.bat" && uvicorn app.main:app --app-dir backend --host %ACE_STEP_HOST% --port %ACE_STEP_PORT%"

echo Starting frontend on %ACE_STEP_HOST%:%ACE_STEP_UI_PORT%
start "ACE Frontend" cmd /k "cd /d "%ROOT_DIR%\frontend" && npm run dev -- --host %ACE_STEP_HOST% --port %ACE_STEP_UI_PORT%"

echo.
echo Backend:  http://localhost:%ACE_STEP_PORT%/health
echo Frontend: http://localhost:%ACE_STEP_UI_PORT%

exit /b 0
