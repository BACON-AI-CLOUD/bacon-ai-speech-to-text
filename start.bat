@echo off
setlocal enabledelayedexpansion

:: Read version from version.json
for /f "delims=" %%V in ('python -c "import json; print(json.load(open('src/version.json'))['version'])" 2^>nul') do set VERSION=%%V
if not defined VERSION set VERSION=0
set /a BACKEND_PORT=8700+%VERSION%
set /a FRONTEND_PORT=5000+%VERSION%

echo === BACON-AI Voice (v%VERSION%) ===

where python >nul 2>&1 || (echo ERROR: python not found & exit /b 1)
where node >nul 2>&1 || (echo ERROR: node not found & exit /b 1)

echo [Backend] Starting on http://localhost:%BACKEND_PORT%...
start "BACON-Voice-Backend" cmd /k "cd /d %~dp0src\backend && uv run uvicorn app.main:app --host 127.0.0.1 --port %BACKEND_PORT%"

echo [Frontend] Starting on http://localhost:%FRONTEND_PORT%...
start "BACON-Voice-Frontend" cmd /k "cd /d %~dp0src\frontend && npm run preview -- --port %FRONTEND_PORT%"

echo.
echo Backend:  http://localhost:%BACKEND_PORT%
echo Frontend: http://localhost:%FRONTEND_PORT%
echo Close the spawned windows to stop services.
endlocal
