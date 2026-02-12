@echo off
echo === BACON-AI Voice (Development) ===

where python >nul 2>&1 || (echo ERROR: python not found & exit /b 1)
where node >nul 2>&1 || (echo ERROR: node not found & exit /b 1)

echo [Backend] Starting with hot-reload on http://localhost:8765...
start "BACON-Voice-Backend-Dev" cmd /k "cd /d %~dp0src\backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload"

echo [Frontend] Starting with HMR on http://localhost:5173...
start "BACON-Voice-Frontend-Dev" cmd /k "cd /d %~dp0src\frontend && npm run dev -- --port 5173"

echo.
echo Backend:  http://localhost:8765 (hot-reload)
echo Frontend: http://localhost:5173 (HMR)
echo Close the spawned windows to stop services.
