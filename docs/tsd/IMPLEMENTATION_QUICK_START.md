# Voice Input Injection - Quick Start Implementation Guide

**Quick Reference:** Fastest path to working voice→Claude Code integration

---

## 🚀 Option 1: Simple Prototype (1 hour) - tmux send-keys

**Best for:** Testing the voice transcription flow quickly

```bash
#!/bin/bash
# File: simple-voice-claude.sh

# 1. Start Claude in tmux
tmux new-session -d -s voice-claude "claude"

# 2. Function to inject voice text
send_to_claude() {
    local text="$1"
    tmux send-keys -t voice-claude "$text" Enter
}

# 3. Example: Use with Whisper
# Record audio with hotkey, then:
TRANSCRIPTION=$(whisper-cli -f /tmp/voice-input.wav --output-format txt)
send_to_claude "$TRANSCRIPTION"

# 4. View Claude's session
tmux attach -t voice-claude
```

**Pros:** Works in 5 minutes, great for testing
**Cons:** No output capture, manual tool approvals

---

## 🏗️ Option 2: Production WebSocket (1-2 days) - RECOMMENDED

### Step 1: Install Dependencies

```bash
# Install websocketd (stdin/stdout WebSocket bridge)
cd /tmp
wget https://github.com/joewalnes/websocketd/releases/download/v0.4.1/websocketd-0.4.1-linux_amd64.zip
unzip websocketd-0.4.1-linux_amd64.zip
sudo mv websocketd /usr/local/bin/
chmod +x /usr/local/bin/websocketd
```

### Step 2: Create Claude WebSocket Wrapper

```bash
#!/bin/bash
# File: claude-websocket.sh

# Start Claude in print mode via websocketd
websocketd --port=8080 --address=127.0.0.1 claude --print
```

### Step 3: Create Web UI Client

```html
<!-- File: voice-claude-ui.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Voice → Claude Code</title>
</head>
<body>
    <h1>Voice Input to Claude Code</h1>
    <button id="recordBtn">🎤 Record & Send</button>
    <div id="transcription"></div>
    <div id="response"></div>

    <script>
        const ws = new WebSocket('ws://localhost:8080');

        ws.onmessage = (event) => {
            document.getElementById('response').innerHTML +=
                '<p>' + event.data + '</p>';
        };

        document.getElementById('recordBtn').onclick = async () => {
            // Integrate with your voice recording service
            const transcription = await getVoiceTranscription();

            document.getElementById('transcription').innerText =
                'Sending: ' + transcription;

            ws.send(transcription);
        };

        async function getVoiceTranscription() {
            // TODO: Integrate with whisper.cpp or your STT service
            // For now, prompt user
            return prompt("Enter text (voice transcription placeholder):");
        }
    </script>
</body>
</html>
```

### Step 4: Start Services

```bash
# Terminal 1: Start Claude WebSocket server
./claude-websocket.sh

# Terminal 2: Serve web UI
python3 -m http.server 3000

# Open browser: http://localhost:3000/voice-claude-ui.html
```

---

## 🎙️ Option 3: Full Voice Integration (2-3 days)

### Step 1: Voice Recording Service

```python
# File: voice_recorder.py
import pyaudio
import wave
import subprocess
import websocket
import json

class VoiceToClaudeService:
    def __init__(self, websocket_url="ws://localhost:8080"):
        self.ws = websocket.WebSocket()
        self.ws.connect(websocket_url)

    def record_audio(self, filename="/tmp/voice-input.wav", duration=5):
        """Record audio from microphone"""
        CHUNK = 1024
        FORMAT = pyaudio.paInt16
        CHANNELS = 1
        RATE = 16000

        p = pyaudio.PyAudio()
        stream = p.open(format=FORMAT,
                        channels=CHANNELS,
                        rate=RATE,
                        input=True,
                        frames_per_buffer=CHUNK)

        print("Recording...")
        frames = []
        for i in range(0, int(RATE / CHUNK * duration)):
            data = stream.read(CHUNK)
            frames.append(data)

        print("Finished recording")
        stream.stop_stream()
        stream.close()
        p.terminate()

        wf = wave.open(filename, 'wb')
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(p.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))
        wf.close()

        return filename

    def transcribe_with_whisper(self, audio_file):
        """Transcribe using whisper.cpp"""
        result = subprocess.run(
            ['whisper-cli', '-f', audio_file, '--output-format', 'txt'],
            capture_output=True,
            text=True
        )
        return result.stdout.strip()

    def send_to_claude(self, text):
        """Send transcribed text to Claude via WebSocket"""
        self.ws.send(text)
        response = self.ws.recv()
        return response

    def voice_to_claude_loop(self):
        """Main loop: record → transcribe → send"""
        print("Press Enter to record (Ctrl+C to exit)")
        try:
            while True:
                input()  # Wait for Enter key

                # Record audio
                audio_file = self.record_audio(duration=5)

                # Transcribe
                print("Transcribing...")
                transcription = self.transcribe_with_whisper(audio_file)
                print(f"You said: {transcription}")

                # Send to Claude
                print("Sending to Claude...")
                response = self.send_to_claude(transcription)
                print(f"Claude: {response}")
                print("\n" + "="*50 + "\n")

        except KeyboardInterrupt:
            print("\nExiting...")
            self.ws.close()

if __name__ == "__main__":
    service = VoiceToClaudeService()
    service.voice_to_claude_loop()
```

### Step 2: Install Python Dependencies

```bash
pip install pyaudio websocket-client
```

### Step 3: Run Full Stack

```bash
# Terminal 1: Start Claude WebSocket
./claude-websocket.sh

# Terminal 2: Start voice service
python3 voice_recorder.py

# Use: Press Enter, speak for 5 seconds, wait for Claude's response
```

---

## 🔥 Option 4: Advanced WebSocket with Agent SDK Protocol (3-5 days)

### Step 1: Clone Reference Implementation

```bash
git clone https://github.com/The-Vibe-Company/companion.git
cd companion

# Study the NDJSON protocol implementation
cat src/protocol/*.ts
```

### Step 2: Create Custom WebSocket Server

```javascript
// File: claude-agent-bridge.js
const WebSocket = require('ws');
const { spawn } = require('child_process');

class ClaudeAgentBridge {
    constructor(port = 8080) {
        this.wss = new WebSocket.Server({
            host: '127.0.0.1',
            port: port
        });

        this.wss.on('connection', this.handleConnection.bind(this));
    }

    handleConnection(ws, req) {
        console.log('New client connected');

        // Start Claude Code (check if --sdk-url is available)
        const claude = spawn('claude', [
            '--print',
            '--no-session-persistence'
        ]);

        // Client → Claude
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('Received from client:', data);

                // Format for Claude (simple text mode)
                const claudeInput = data.text || data.content || message;
                claude.stdin.write(claudeInput + '\n');

            } catch (err) {
                console.error('Error processing message:', err);
            }
        });

        // Claude → Client
        claude.stdout.on('data', (data) => {
            const response = {
                type: 'assistant_message',
                content: data.toString(),
                timestamp: Date.now()
            };
            ws.send(JSON.stringify(response));
        });

        claude.stderr.on('data', (data) => {
            console.error('Claude stderr:', data.toString());
        });

        claude.on('close', (code) => {
            console.log('Claude process exited:', code);
            ws.close();
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            claude.kill();
        });
    }
}

// Start server
const bridge = new ClaudeAgentBridge(8080);
console.log('Claude Agent Bridge running on ws://localhost:8080');
```

### Step 3: Install Node Dependencies

```bash
npm init -y
npm install ws
```

### Step 4: Run Agent Bridge

```bash
node claude-agent-bridge.js
```

### Step 5: Test with Web Client

```javascript
// File: test-agent-bridge.html
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
    console.log('Connected to Claude Agent Bridge');

    // Send voice transcription
    ws.send(JSON.stringify({
        text: "Create a Python hello world function"
    }));
};

ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    console.log('Claude response:', response);
    document.getElementById('output').innerHTML +=
        `<pre>${response.content}</pre>`;
};
```

---

## 🧪 Testing Checklist

### Component Tests (FUTI)
- [ ] ✅ Whisper.cpp transcribes audio correctly
- [ ] ✅ WebSocket server accepts connections
- [ ] ✅ Claude Code receives stdin input
- [ ] ✅ Claude Code produces stdout output

### Integration Tests (SIT)
- [ ] ✅ Voice recording → transcription works
- [ ] ✅ Transcription → WebSocket → Claude works
- [ ] ✅ Claude response returns to web UI
- [ ] ✅ Multiple voice inputs in sequence work

### User Acceptance Tests (UAT)
- [ ] ✅ User speaks: "Create a Python function"
- [ ] ✅ Claude generates correct code
- [ ] ✅ User speaks: "Fix the bug on line 5"
- [ ] ✅ Claude understands context and fixes code

---

## 📊 Performance Expectations

| Metric | Target | Acceptable | Notes |
|--------|--------|------------|-------|
| Voice → Text Latency | <2s | <5s | Whisper.cpp local |
| WebSocket Latency | <100ms | <500ms | Localhost only |
| Claude Response Time | <3s | <10s | Depends on query |
| **Total User Experience** | **<5s** | **<15s** | Record → Response |

---

## 🚨 Common Issues & Solutions

### Issue 1: WebSocket Connection Refused
```bash
# Check if port is available
netstat -tuln | grep 8080

# Kill existing process
lsof -ti:8080 | xargs kill -9

# Restart WebSocket server
./claude-websocket.sh
```

### Issue 2: Whisper Not Found
```bash
# Install whisper.cpp
cd /tmp
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
make
sudo cp build/bin/whisper-cli /usr/local/bin/

# Download model
./models/download-ggml-model.sh base.en
```

### Issue 3: Claude Not Responding
```bash
# Check Claude version
ls -la ~/.local/bin/claude

# Test Claude directly
echo "test" | claude --print

# Check for errors
claude --print --debug 2>&1 | tee debug.log
```

### Issue 4: CORS Errors in Web UI
```javascript
// Add CORS headers to WebSocket server
const wss = new WebSocket.Server({
    port: 8080,
    perMessageDeflate: false,
    clientTracking: true,
    verifyClient: (info) => {
        // Only accept localhost
        return info.origin.includes('localhost');
    }
});
```

---

## 📚 Reference Commands

```bash
# Start Claude WebSocket (Simple)
websocketd --port=8080 claude --print

# Start Claude WebSocket (Advanced)
node claude-agent-bridge.js

# Record audio with whisper.cpp
whisper-cli -f audio.wav --output-format txt

# Test WebSocket with websocat
echo "test message" | websocat ws://localhost:8080

# Test WebSocket with curl (upgrade)
curl --include \
     --no-buffer \
     --header "Connection: Upgrade" \
     --header "Upgrade: websocket" \
     --header "Sec-WebSocket-Version: 13" \
     --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     http://localhost:8080/

# Monitor WebSocket traffic
websocat -v ws://localhost:8080

# Check Claude is running
ps aux | grep claude

# Kill all Claude processes
pkill -f claude

# View tmux session (if using tmux approach)
tmux attach -t voice-claude
```

---

## 🎯 Next Steps After Quick Start

1. **Enhance Voice Input:**
   - Add voice activity detection (VAD)
   - Implement push-to-talk hotkey
   - Add continuous listening mode

2. **Improve WebSocket Server:**
   - Add authentication
   - Implement session management
   - Add reconnection logic
   - Handle multiple concurrent clients

3. **Build Better UI:**
   - Show real-time transcription
   - Display Claude's thinking process
   - Add tool approval buttons
   - Implement chat history

4. **Production Hardening:**
   - Error handling & logging
   - Performance monitoring
   - Security audit
   - Load testing

---

## 📞 Support Resources

- **Main Analysis:** See `VOICE_INPUT_INJECTION_FEASIBILITY.md`
- **Claude Code Docs:** https://code.claude.com/docs
- **websocketd Docs:** http://websocketd.com
- **Whisper.cpp:** https://github.com/ggml-org/whisper.cpp
- **Community Examples:** https://github.com/The-Vibe-Company/companion

---

**Quick Start Status:** ✅ READY TO USE
**Recommended First Step:** Option 1 (tmux) for 1-hour prototype
**Recommended Production:** Option 4 (Agent SDK WebSocket)

**Last Updated:** 2026-02-11
