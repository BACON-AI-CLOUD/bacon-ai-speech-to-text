#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== BACON-AI Voice ==="

# Pre-flight checks
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found"; exit 1; }

# Check ports
if lsof -i :8765 >/dev/null 2>&1; then echo "WARNING: Port 8765 already in use"; fi
if lsof -i :5173 >/dev/null 2>&1; then echo "WARNING: Port 5173 already in use"; fi

# Start backend
echo "[Backend] Starting on http://localhost:8765..."
cd "$SCRIPT_DIR/src/backend"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8765 &
BACKEND_PID=$!

# Start frontend
echo "[Frontend] Starting on http://localhost:5173..."
cd "$SCRIPT_DIR/src/frontend"
npm run preview -- --port 5173 &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8765"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both services"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "Stopped."
}
trap cleanup EXIT INT TERM
wait
