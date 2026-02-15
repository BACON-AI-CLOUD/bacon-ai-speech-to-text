#!/usr/bin/env bash
# BACON-AI Voice - Global Hotkey Listener (Linux/X11)
# Requires: xbindkeys, curl
# Usage: ./global-hotkey.sh [key] [url]
#   key: X11 key name (default: F2)
#   url: Backend URL (default: http://localhost:8765)

KEY="${1:-F2}"
URL="${2:-http://localhost:8765}"
CONFIG_FILE="/tmp/bacon-voice-xbindkeys.cfg"

# Check dependencies
for cmd in xbindkeys curl xdotool; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Missing dependency: $cmd"
    echo "Install with: sudo apt install $cmd"
    exit 1
  fi
done

# Create xbindkeys config
cat > "$CONFIG_FILE" << EOF
# BACON-AI Voice global hotkey
"curl -s -X POST ${URL}/recording/toggle > /dev/null 2>&1 && echo '[$(date +%H:%M:%S)] Toggle sent' || echo '[$(date +%H:%M:%S)] Toggle FAILED'"
  ${KEY}
EOF

echo "BACON-AI Voice: Global hotkey [$KEY] registered"
echo "Press $KEY from any window to toggle recording"
echo "Press Ctrl+C to stop"
echo ""

# Kill any existing xbindkeys instance using our config
pkill -f "xbindkeys.*$CONFIG_FILE" 2>/dev/null

# Run xbindkeys in foreground so Ctrl+C works
trap 'pkill -f "xbindkeys.*$CONFIG_FILE" 2>/dev/null; rm -f "$CONFIG_FILE"; echo "Hotkey unregistered. Goodbye!"; exit 0' INT TERM

xbindkeys -f "$CONFIG_FILE" -n
