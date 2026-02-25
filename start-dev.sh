#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Read version from version.json
VERSION=$(python3 -c "import json; print(json.load(open('$SCRIPT_DIR/src/version.json'))['version'])" 2>/dev/null || echo 0)
BACKEND_PORT=$((8700 + VERSION))
FRONTEND_PORT=$((5000 + VERSION))

echo "=== BACON-AI Voice v${VERSION} (Development) ==="

command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found"; exit 1; }

echo "[Backend] Starting with hot-reload on http://localhost:$BACKEND_PORT..."
cd "$SCRIPT_DIR/src/backend"
uv run uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT --reload &
BACKEND_PID=$!

echo "[Frontend] Starting with HMR on http://localhost:$FRONTEND_PORT..."
cd "$SCRIPT_DIR/src/frontend"
npm run dev -- --port $FRONTEND_PORT &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:$BACKEND_PORT (hot-reload)"
echo "Frontend: http://localhost:$FRONTEND_PORT (HMR)"
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
