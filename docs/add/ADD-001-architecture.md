# ADD-001: BACON-AI Voice - Architecture Design Document

**Version:** 1.0
**Status:** Draft
**Date:** 2026-02-11

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER (React + Vite + TS)                  │
│                                                                   │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │ Mic Input │  │ Activation   │  │ Waveform    │  │ Settings │ │
│  │ (Media   │  │ Controller   │  │ Visualizer  │  │ Panel    │ │
│  │ Recorder)│  │ (PTT/VAD/   │  │ (AnalyserNode│  │ (Model,  │ │
│  │          │  │  Toggle)     │  │  + Canvas)  │  │  Mode)   │ │
│  └────┬─────┘  └──────┬───────┘  └─────────────┘  └──────────┘ │
│       │               │                                          │
│       ▼               ▼                                          │
│  ┌─────────────────────────────────┐  ┌────────────────────────┐│
│  │   Audio Pipeline                 │  │ Transcription Display  ││
│  │   (WebSocket stream to backend) │  │ + Edit + Send          ││
│  └──────────────┬──────────────────┘  └───────────┬────────────┘│
│                 │ ws://localhost:8765/ws/audio      │             │
└─────────────────┼──────────────────────────────────┼─────────────┘
                  │                                  │
                  ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Python + FastAPI)                     │
│                                                                   │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐ │
│  │ WebSocket    │  │ Whisper Engine │  │ Model Manager        │ │
│  │ Audio Handler│─>│ (Faster-Whisper│  │ (load/switch/list)   │ │
│  │ (receive +   │  │  + GPU detect) │  │                      │ │
│  │  buffer)     │  │                │  │                      │ │
│  └──────────────┘  └───────┬────────┘  └──────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Integration Router                              │ │
│  │   ┌──────────┐  ┌──────────────┐  ┌───────────────┐       │ │
│  │   │ Claude   │  │ WebSocket    │  │ MCP Server    │       │ │
│  │   │ API      │  │ Bridge       │  │ (stdio)       │       │ │
│  │   │ Direct   │  │ (to CLI)     │  │               │       │ │
│  │   └──────────┘  └──────────────┘  └───────────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Design

### 2.1 Frontend Components

#### AudioCapture Module
- **Technology:** MediaRecorder API
- **Audio Format:** WebM/Opus (browser native) -> converted to WAV on backend
- **Sample Rate:** 16kHz (Whisper optimal)
- **Channels:** Mono
- **Chunk Size:** 250ms for streaming, full blob for batch

#### ActivationController
- **State Machine:**
```
                    ┌─────────┐
           ┌──────>│  IDLE   │<──────┐
           │       └────┬────┘       │
           │            │            │
    (release/   (trigger)    (timeout/
     silence)        │        silence)
           │            ▼            │
           │       ┌─────────┐       │
           └───────│RECORDING│───────┘
                   └────┬────┘
                        │
                   (stop trigger)
                        │
                        ▼
                   ┌──────────┐
                   │PROCESSING│
                   └────┬─────┘
                        │
                   (result received)
                        │
                        ▼
                   ┌──────────┐
                   │ DISPLAY  │──────> IDLE
                   └──────────┘
```

- **Push-to-Talk:** keydown -> RECORDING, keyup -> PROCESSING
- **Voice Activation:** audio level > threshold -> RECORDING, silence > timeout -> PROCESSING
- **Toggle:** click -> RECORDING, click -> PROCESSING

#### TranscriptionDisplay
- Shows transcribed text with confidence indicator
- Editable text area for corrections
- Send button routes to selected integration backend
- Scrollable history of past transcriptions

### 2.2 Backend Components

#### FastAPI Server (`src/backend/main.py`)
```
Endpoints:
  GET  /health                    -> Server status + GPU info
  GET  /models                    -> Available Whisper models
  POST /models/{name}/load        -> Load/switch model
  POST /transcribe                -> Upload audio file, get text
  WS   /ws/audio                  -> Stream audio, receive text
  WS   /ws/status                 -> Server status stream
```

#### WhisperEngine (reuse from bacon-ai-voice-mcp)
- Faster-Whisper with ctranslate2
- GPU auto-detection (CUDA/ROCm/CPU)
- Lazy model loading
- Configurable beam size, VAD filter
- Returns: text, confidence, language, segments

#### IntegrationRouter (`src/backend/integrations/`)
```python
class IntegrationBackend(Protocol):
    async def send(self, text: str, metadata: dict) -> dict: ...

class ClaudeAPIBackend(IntegrationBackend): ...
class WebSocketBridgeBackend(IntegrationBackend): ...
class MCPServerBackend(IntegrationBackend): ...
```

### 2.3 Data Flow

#### Recording -> Transcription Flow
```
1. User triggers recording (PTT/VAD/Toggle)
2. Browser MediaRecorder captures audio chunks
3. Chunks sent via WebSocket to backend (binary frames)
4. Backend buffers chunks into complete audio segment
5. On recording stop: audio passed to Whisper engine
6. Whisper returns transcription result
7. Result sent back via WebSocket to frontend
8. Frontend displays transcribed text
9. User reviews/edits, clicks Send
10. Text routed to selected integration backend
```

#### Audio Format Pipeline
```
Browser (WebM/Opus) -> WebSocket -> Backend (pass WebM directly to Faster-Whisper*)
* Faster-Whisper accepts WebM natively via ffmpeg backend. No manual WAV conversion needed.
  Fallback: If direct WebM fails, convert to WAV 16kHz mono via pydub/ffmpeg.
```

### 2.4 Settings Persistence

#### Frontend Settings (localStorage)
```json
{
  "activationMode": "push-to-talk",
  "hotkey": "Space",
  "vadThreshold": 0.02,
  "silenceTimeout": 1500,
  "selectedModel": "base",
  "integrationBackend": "claude-api",
  "theme": "dark"
}
```

#### Backend Settings (.env + config.json)
```
# .env (secrets only)
ANTHROPIC_API_KEY=sk-ant-...

# config.json (non-secret settings)
{
  "whisper_model": "base",
  "whisper_device": "auto",
  "server_port": 8765,
  "model_cache_dir": "~/.cache/whisper",
  "language": "en"
}
```

### 2.5 Error Handling States

| Error | Frontend UX | Backend Response |
|-------|------------|-----------------|
| Backend unreachable | Red status bar "Backend offline - start with ./start.sh" | N/A |
| Mic permission denied | Modal: "Microphone access required" + browser settings link | N/A |
| Model not downloaded | Progress bar during download + estimated time | `{"type": "downloading", "progress": 45, "model": "base"}` |
| Model load failure | Toast: "Failed to load model X, trying fallback" | `{"type": "error", "message": "...", "fallback": "tiny"}` |
| Transcription failure | Toast: "Transcription failed, please try again" | `{"type": "error", "message": "..."}` |
| WebSocket disconnect | Auto-reconnect with exponential backoff + status indicator | N/A |

---

## 3. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| STT Engine | Faster-Whisper | 4-6x faster than original, GPU support, proven in bacon-ai-voice-mcp |
| Audio Transport | WebSocket | Real-time bidirectional, binary frame support |
| Frontend Framework | React 18 + TypeScript | Type safety, hooks for audio state management |
| Build Tool | Vite | Fast HMR, native TS support |
| Backend Framework | FastAPI | Async native, WebSocket support, auto-docs |
| Audio Capture | MediaRecorder API | Browser-native, no plugins, cross-platform |
| Visualization | Web Audio API AnalyserNode | Real-time frequency data, no external deps |
| Browser VAD | @ricky0123/vad-web | WASM-based, high accuracy, React hooks available |
| Settings Storage | localStorage (frontend) + config.json (backend) | Simple, no database needed |

---

## 4. API Contracts

### WebSocket Audio Protocol

#### Client -> Server (Binary)
```
Frame: Raw audio bytes (WebM/Opus encoded)
Control messages (JSON text frames):
  { "type": "start", "mode": "push-to-talk" | "vad" | "toggle" }
  { "type": "stop" }
  { "type": "cancel" }
```

#### Server -> Client (JSON text frames)
```
{ "type": "status", "state": "recording" | "processing" | "ready" }
{ "type": "result", "text": "...", "confidence": 0.95, "language": "en", "duration": 3.2, "segments": [...] }
{ "type": "error", "message": "..." }
{ "type": "partial", "text": "..." }  // Future: streaming partial results
```

### REST API

#### POST /transcribe
```
Request: multipart/form-data { audio: File, language?: string }
Response: { text, confidence, language, duration, segments }
```

#### GET /models
```
Response: {
  models: [
    { name: "tiny", size_mb: 75, loaded: false, accuracy_est: "~85%" },
    { name: "base", size_mb: 150, loaded: true, accuracy_est: "~90%" },
    ...
  ],
  current: "base",
  gpu: { available: true, name: "NVIDIA RTX 3060", vram_gb: 12 }
}
```

---

## 5. Security Considerations

- All communication is localhost only (127.0.0.1)
- No audio data leaves the machine
- API keys (for Claude API mode) stored in .env, never in frontend
- CORS restricted to localhost origins
- WebSocket connections validated on connect

---

## 6. Directory Structure

```
src/
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioCapture.tsx
│   │   │   ├── ActivationController.tsx
│   │   │   ├── WaveformVisualizer.tsx
│   │   │   ├── TranscriptionDisplay.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── hooks/
│   │   │   ├── useAudioCapture.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useActivation.ts
│   │   │   └── useWhisperModels.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
└── backend/                     # Python + FastAPI
    ├── app/
    │   ├── __init__.py
    │   ├── main.py              # FastAPI app + WebSocket handlers
    │   ├── config.py            # Settings, GPU detection
    │   ├── stt/
    │   │   ├── __init__.py
    │   │   └── whisper_engine.py # Reused from bacon-ai-voice-mcp
    │   ├── integrations/
    │   │   ├── __init__.py
    │   │   ├── base.py          # Protocol/ABC
    │   │   ├── claude_api.py    # Anthropic SDK
    │   │   ├── ws_bridge.py     # WebSocket bridge
    │   │   └── mcp_server.py    # MCP integration
    │   └── audio/
    │       ├── __init__.py
    │       └── converter.py     # WebM -> WAV conversion
    ├── pyproject.toml
    └── requirements.txt
```

---

## 7. Startup Scripts

### Linux/macOS/WSL (`start.sh`)
```bash
#!/bin/bash
# Start both backend and frontend concurrently
echo "Starting BACON-AI Voice..."

# Start backend
cd src/backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8765 &
BACKEND_PID=$!

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend: http://localhost:8765"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
```

### Windows (`start.bat`)
```bat
@echo off
echo Starting BACON-AI Voice...
start "Backend" cmd /k "cd src\backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8765"
start "Frontend" cmd /k "cd src\frontend && npm run dev"
echo Backend: http://localhost:8765
echo Frontend: http://localhost:5173
```

---

*Document end. Awaiting human review at CP-3 checkpoint.*
