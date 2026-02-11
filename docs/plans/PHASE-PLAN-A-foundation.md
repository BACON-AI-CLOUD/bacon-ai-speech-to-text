# Phase A: Foundation - Implementation Plan

**Phase:** 9 (TDD Build)
**Features:** FEAT-001 (Core STT Backend) + FEAT-002 (React Web UI)
**Branch:** feature/FEAT-001-stt-backend, feature/FEAT-002-react-ui
**Status:** planned
**Priority:** P0 - Must have before any other phase

---

## Objective
Build the minimum viable pipeline: speak into browser -> audio streamed to backend -> Whisper transcribes -> text displayed in UI.

---

## FEAT-001: Core STT Backend

### Sub-tasks
1. **Scaffold FastAPI project** with pyproject.toml, dependencies
2. **Copy and adapt whisper_engine.py** from bacon-ai-voice-mcp
3. **Audio converter module** - WebM/Opus to WAV 16kHz mono (using ffmpeg or pydub)
4. **WebSocket endpoint** `/ws/audio` - receive binary audio frames, buffer, transcribe on stop
5. **REST endpoint** `POST /transcribe` - file upload transcription
6. **REST endpoint** `GET /health` - server status + GPU info
7. **REST endpoint** `GET /models` - list available Whisper models
8. **REST endpoint** `POST /models/{name}/load` - load/switch model
9. **CORS middleware** for localhost origins
10. **Unit tests** for all endpoints (TUT-B001 through TUT-B010)

### Dependencies
- Python 3.10+
- faster-whisper
- fastapi + uvicorn
- websockets
- pydub or ffmpeg for audio conversion
- pytest + httpx for testing

### Acceptance Criteria
- `GET /health` returns 200 with GPU info
- `POST /transcribe` with WAV file returns transcribed text
- WebSocket audio stream accepted and transcribed
- Unit tests pass with >80% coverage

---

## FEAT-002: React Web UI

### Sub-tasks
1. **Scaffold Vite + React + TypeScript project**
2. **useAudioCapture hook** - MediaRecorder API, mic permissions, audio chunks
3. **useWebSocket hook** - connect to backend, send binary audio, receive JSON results
4. **AudioCapture component** - mic permission button, recording state
5. **TranscriptionDisplay component** - show text, edit, send button
6. **StatusBar component** - connection status, model info
7. **Basic layout** - clean single-page app
8. **Unit tests** for hooks and components (TUT-F001 through TUT-F008)

### Dependencies
- Node 18+
- React 18
- Vite
- TypeScript
- vitest + @testing-library/react

### Acceptance Criteria
- App loads in browser, requests mic permission
- Click record -> audio captured -> sent via WebSocket
- Transcribed text displayed
- Component tests pass

---

## Integration Gate (Phase A Complete)

**Evidence required to pass:**
- [ ] Backend tests pass (TUT-B001-B010)
- [ ] Frontend tests pass (TUT-F001-F008)
- [ ] End-to-end: speak into mic, see transcribed text in browser
- [ ] Screenshot of working UI with transcription result
- [ ] API response logs showing Whisper output

---

## Estimated Complexity per Sub-Agent

| Agent | Scope | Est. Files | Risk |
|-------|-------|-----------|------|
| Backend Agent | FEAT-001 complete | ~10 files | Low (reusing proven engine) |
| Frontend Agent | FEAT-002 complete | ~12 files | Medium (MediaRecorder browser compat) |

---

## Build Order

```
1. Backend Agent: Scaffold FastAPI + Whisper engine (can run independently)
2. Frontend Agent: Scaffold Vite + React (can run independently)
   ↑ These two can run IN PARALLEL ↑
3. Integration: Connect frontend WebSocket to backend
4. Testing: TUT -> FUT for both
5. Gate: E2E demo with evidence
```
