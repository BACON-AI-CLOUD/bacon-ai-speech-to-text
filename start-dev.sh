#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== BACON-AI Voice (Development) ==="

command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found"; exit 1; }

echo "[Backend] Starting with hot-reload on http://localhost:8765..."
cd "$SCRIPT_DIR/src/backend"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload &
BACKEND_PID=$!

echo "[Frontend] Starting with HMR on http://localhost:5173..."
cd "$SCRIPT_DIR/src/frontend"
npm run dev -- --port 5173 &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8765 (hot-reload)"
echo "Frontend: http://localhost:5173 (HMR)"
echo "Press Ctrl+C to stop"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "Stopped."
}
trap cleanup EXIT INT TERM
wait
