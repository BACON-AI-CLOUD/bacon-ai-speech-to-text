# TEST-STRATEGY-001: BACON-AI Voice Test Strategy

**Version:** 1.0
**Status:** Draft
**Date:** 2026-02-11

---

## 1. Test Pyramid

```
        /‾‾‾‾‾‾‾‾‾\
       /    UAT     \        Human validation (Colin)
      /──────────────\
     /   SIT (E2E)    \      Full flow: mic -> text -> Claude
    /───────────────────\
   /      FUT            \    Individual features in browser
  /─────────────────────────\
 /         TUT               \  Unit tests: engine, API, components
/─────────────────────────────\
```

---

## 2. Test Levels

### 2.1 TUT - Technical Unit Tests

#### Backend Tests (`tests/unit/backend/`)
| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-B001 | WhisperEngine | Model loading (tiny, base) | Pass/fail + load time |
| TUT-B002 | WhisperEngine | Transcribe WAV file | Text output + confidence |
| TUT-B003 | WhisperEngine | Model switching | Before/after model state |
| TUT-B004 | WhisperEngine | GPU detection | Detected device type |
| TUT-B005 | AudioConverter | WebM to WAV conversion | Output file valid |
| TUT-B006 | FastAPI /health | Returns status 200 | Response body |
| TUT-B007 | FastAPI /models | Lists available models | Response body |
| TUT-B008 | FastAPI /transcribe | File upload transcription | Text output |
| TUT-B009 | IntegrationRouter | Route to correct backend | Mock backend called |
| TUT-B010 | ClaudeAPIBackend | Send message, receive response | Mock API response |
| TUT-B011 | ModelDownloader | Download model with progress callback | Progress events logged |
| TUT-B012 | ConfigManager | Load/save config.json | Config file contents |

#### Frontend Tests (`tests/unit/frontend/`)
| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-F001 | useAudioCapture | Hook initializes MediaRecorder | State transitions |
| TUT-F002 | useWebSocket | Connect/disconnect lifecycle | Connection state |
| TUT-F003 | useActivation | PTT mode keydown/keyup | State machine transitions |
| TUT-F004 | useActivation | Toggle mode click/click | State machine transitions |
| TUT-F005 | useActivation | VAD mode threshold detection | State transitions |
| TUT-F006 | TranscriptionDisplay | Renders text correctly | DOM snapshot |
| TUT-F007 | ModelSelector | Lists models from API | Rendered options |
| TUT-F008 | SettingsPanel | Saves/loads settings | localStorage values |
| TUT-F009 | ErrorBoundary | Renders error states correctly | DOM snapshot |
| TUT-F010 | useSettings | Persists/loads from localStorage | Storage values verified |

### 2.2 FUT - Functional Unit Tests

| Test ID | Feature | What | Evidence |
|---------|---------|------|----------|
| FUT-001 | Mic Capture | User grants mic permission, audio captured | Screenshot: permission dialog + recording indicator |
| FUT-002 | PTT Mode | Hold space -> recording indicator, release -> processing | Screenshot: state transitions |
| FUT-003 | Toggle Mode | Click start -> recording, click stop -> transcription | Screenshot: button states |
| FUT-004 | VAD Mode | Speak -> auto-detect, silence -> auto-stop | Screenshot: state transitions |
| FUT-005 | Transcription | Recorded audio transcribed and displayed | Screenshot: text output |
| FUT-006 | Edit Text | User edits transcribed text before sending | Screenshot: edited text |
| FUT-007 | Model Switch | Change model in settings, verify switch | Screenshot: model selection |
| FUT-008 | Waveform | Audio visualizer shows activity during recording | Screenshot: waveform |
| FUT-009 | Model Download | Download progress shows during first model load | Screenshot: progress bar |
| FUT-010 | Error States | Backend down shows reconnect message | Screenshot: error UI |
| FUT-011 | Mic Denied | Permission denied shows guidance | Screenshot: permission error |
| FUT-012 | Settings Persist | Change settings, reload, settings preserved | Before/after screenshots |

### 2.3 SIT - System Integration Tests

| Test ID | Flow | What | Evidence |
|---------|------|------|----------|
| SIT-001 | Full STT Flow | Mic -> WebSocket -> Whisper -> Display | E2E screenshot + API logs |
| SIT-002 | Claude API | Transcribe -> Send to Claude API -> Display response | API request/response logs |
| SIT-003 | WebSocket Bridge | Transcribe -> Bridge -> Claude Code receives | Bridge logs + CLI screenshot |
| SIT-004 | MCP Server | Transcribe -> MCP tool call -> Claude Code uses | MCP tool logs |
| SIT-005 | Model Switch Live | Switch model mid-session, transcribe again | Before/after transcription |
| SIT-006 | Error Recovery | Backend down -> reconnect -> resume | Error UI + recovery screenshot |

### 2.4 Browser Testing (CP-9 Mandatory)

| Test ID | Browser | What | Tool |
|---------|---------|------|------|
| BT-001 | Chrome | Full flow: mic -> transcribe -> display | claude --chrome / antigravity |
| BT-002 | Firefox | Mic permission + recording | playwright |
| BT-003 | Edge | Full flow | playwright |
| BT-004 | Safari | MediaRecorder compatibility check | manual |

### 2.5 RGT - Regression Tests

Run after every feature addition:
- All TUT tests pass
- All FUT tests pass
- SIT-001 (core flow) passes
- No visual regressions in UI

### 2.6 UAT - User Acceptance Tests

| Test ID | Scenario | Pass Criteria | Sign-off |
|---------|----------|---------------|----------|
| UAT-001 | Colin speaks a prompt, sees transcription | Text matches spoken words (>90% accuracy) | Colin |
| UAT-002 | Colin uses PTT to dictate a Claude prompt | Natural workflow, <5s total latency | Colin |
| UAT-003 | Colin sends transcribed text to Claude API | Gets valid Claude response | Colin |
| UAT-004 | Colin switches Whisper models | Model change reflected, no crash | Colin |

---

## 3. Test Infrastructure

### Tools
| Tool | Purpose |
|------|---------|
| pytest | Backend unit + integration tests |
| pytest-asyncio | Async FastAPI test client |
| httpx | Async HTTP test client for FastAPI |
| vitest | Frontend unit tests |
| @testing-library/react | React component tests |
| playwright | Browser E2E tests (CP-9) |
| claude --chrome / antigravity | Primary browser testing |

### Test Audio Files
Pre-recorded WAV files for deterministic testing:
- `tests/fixtures/hello-world-en.wav` - Clear English "Hello world"
- `tests/fixtures/long-sentence-en.wav` - 10-second English paragraph
- `tests/fixtures/silence.wav` - Pure silence (VAD test)
- `tests/fixtures/noisy-speech.wav` - Speech with background noise

### Coverage Targets
| Component | Target |
|-----------|--------|
| Backend Python | >80% line coverage |
| Frontend TypeScript | >70% line coverage |
| Integration flows | All SIT tests pass |

---

## 4. Test Execution Order

```
1. TUT-B* (backend units)     -> Must pass before FUT
2. TUT-F* (frontend units)    -> Must pass before FUT
3. FUT-* (functional)         -> Must pass before SIT
4. SIT-* (integration)        -> Must pass before BT
5. BT-* (browser)             -> Must pass before UAT
6. RGT (regression)           -> Must pass before UAT
7. UAT-* (acceptance)         -> Human sign-off
```

---

*Document end. Awaiting human review.*
