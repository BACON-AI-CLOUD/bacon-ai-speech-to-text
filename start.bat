@echo off
echo === BACON-AI Voice ===

where python >nul 2>&1 || (echo ERROR: python not found & exit /b 1)
where node >nul 2>&1 || (echo ERROR: node not found & exit /b 1)

echo [Backend] Starting on http://localhost:8765...
start "BACON-Voice-Backend" cmd /k "cd /d %~dp0src\backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8765"

echo [Frontend] Starting on http://localhost:5173...
start "BACON-Voice-Frontend" cmd /k "cd /d %~dp0src\frontend && npm run preview -- --port 5173"

echo.
echo Backend:  http://localhost:8765
echo Frontend: http://localhost:5173
echo Close the spawned windows to stop services.
