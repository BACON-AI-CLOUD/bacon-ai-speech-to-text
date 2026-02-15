#!/usr/bin/env bash
# BACON-AI Voice - Global Hotkey Listener for Linux (X11)
#
# Listens for a configurable hotkey and toggles recording by
# POSTing to the backend toggle endpoint.
#
# Requirements: xbindkeys, curl
# Usage:
#   ./global-hotkey.sh              # default: F2
#   ./global-hotkey.sh F4           # use F4 instead
#   ./global-hotkey.sh F2 9000      # custom port

HOTKEY="${1:-F2}"
PORT="${2:-8765}"
BACKEND_URL="http://localhost:${PORT}/recording/toggle"
CONFIG_FILE="/tmp/bacon-voice-xbindkeys-$$"
TRIGGER_SCRIPT="/tmp/bacon-voice-toggle-$$.sh"

echo "BACON-AI Voice - Global Hotkey Listener (Linux/X11)"
echo "Hotkey: $HOTKEY | Backend: $BACKEND_URL"
echo "Press $HOTKEY anywhere to toggle recording. Ctrl+C to stop."
echo ""

# Check dependencies
if ! command -v xbindkeys &>/dev/null; then
    echo "ERROR: xbindkeys not found. Install with: sudo apt install xbindkeys"
    exit 1
fi
if ! command -v curl &>/dev/null; then
    echo "ERROR: curl not found. Install with: sudo apt install curl"
    exit 1
fi

# Create the trigger script
cat > "$TRIGGER_SCRIPT" << SCRIPT
#!/usr/bin/env bash
response=\$(curl -s -X POST "$BACKEND_URL" 2>&1)
if [ \$? -eq 0 ]; then
    clients=\$(echo "\$response" | grep -o '"clients":[0-9]*' | cut -d: -f2)
    echo "[\$(date +%H:%M:%S)] Toggle sent to \${clients:-0} client(s)"
else
    echo "[\$(date +%H:%M:%S)] Failed to reach backend"
fi
SCRIPT
chmod +x "$TRIGGER_SCRIPT"

# Create xbindkeys config
cat > "$CONFIG_FILE" << CONF
"$TRIGGER_SCRIPT"
    $HOTKEY
CONF

cleanup() {
    echo ""
    echo "Stopping xbindkeys..."
    kill "$XBIND_PID" 2>/dev/null
    rm -f "$CONFIG_FILE" "$TRIGGER_SCRIPT"
    echo "Hotkey unregistered. Goodbye!"
}
trap cleanup EXIT INT TERM

# Start xbindkeys with our config (foreground via -n, custom config via -f)
xbindkeys -n -f "$CONFIG_FILE" &
XBIND_PID=$!

# Wait for xbindkeys to exit or be interrupted
wait "$XBIND_PID"
