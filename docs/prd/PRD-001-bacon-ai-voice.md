# PRD-001: BACON-AI Voice - STT Web Interface for Claude Code

**Version:** 1.0
**Status:** Draft
**Author:** Orchestrator Agent
**Date:** 2026-02-11
**Owner:** Colin Bacon

---

## 1. Problem Statement

### 1.1 Current State
Users interact with Claude Code exclusively via typed text input in the CLI terminal. This creates friction for:
- Long or complex prompts that are faster to speak than type
- Hands-busy scenarios (reviewing physical documents, whiteboarding)
- Accessibility needs
- Natural conversational interaction patterns

### 1.2 Desired State
A web-based speech-to-text interface that captures spoken language, transcribes it locally using Whisper, and delivers the transcribed text to Claude Code through multiple integration backends.

### 1.3 Success Criteria
- SC-1: User can speak into microphone and see transcribed text within 3 seconds (for utterances <10s)
- SC-2: Transcription accuracy >90% for clear English speech with Whisper base model
- SC-3: Three activation modes functional (push-to-talk, voice activation, toggle)
- SC-4: At least one integration backend successfully delivers text to Claude Code
- SC-5: Works on Windows, Linux, and macOS
- SC-6: Zero cloud API costs for core STT (local Whisper)

---

## 2. Scope

### 2.1 In Scope
| ID | Requirement | Priority |
|----|------------|----------|
| REQ-001 | Python+FastAPI backend with local Whisper STT engine | P0 (Must) |
| REQ-002 | React+Vite+TypeScript web UI with microphone capture | P0 (Must) |
| REQ-003 | Push-to-talk activation mode (keyboard hold) | P0 (Must) |
| REQ-004 | Voice activation mode (VAD-based auto-detect) | P1 (Should) |
| REQ-005 | Toggle button activation mode (click start/stop) | P0 (Must) |
| REQ-006 | Claude API direct integration (Anthropic SDK) | P0 (Must) |
| REQ-007 | WebSocket bridge to Claude Code CLI session | P1 (Should) |
| REQ-008 | MCP Server integration for native Claude Code use | P1 (Should) |
| REQ-009 | Configurable Whisper model selector (tiny through large-v3) | P0 (Must) |
| REQ-010 | Cross-platform audio handling (Win/Linux/macOS) | P0 (Must) |
| REQ-011 | Real-time waveform visualization | P2 (Nice) |
| REQ-012 | Transcription history display | P1 (Should) |
| REQ-013 | Audio level meter / microphone status indicator | P0 (Must) |
| REQ-014 | Model download progress indicator (first-time download 75MB-3GB) | P0 (Must) |
| REQ-015 | Settings persistence (localStorage for frontend, .env/config for backend) | P0 (Must) |
| REQ-016 | Error handling UX (backend down, mic denied, model load failure) | P0 (Must) |
| REQ-017 | Concurrent startup script (start.sh/start.bat for both frontend+backend) | P1 (Should) |

### 2.2 Out of Scope
- Speaker identification / multi-speaker diarization
- Real-time translation (transcription only)
- Multi-language transcription (English only for v1.0)
- Mobile app (web-only, responsive not required)
- Cloud-based STT fallback (local Whisper only)
- Text-to-speech response playback (separate project)
- Video capture

---

## 3. User Stories

### US-001: Basic Voice Input
**As a** Claude Code user
**I want to** speak into my microphone and have my words transcribed
**So that** I can send prompts to Claude without typing

**Acceptance Criteria:**
- Microphone permission requested on first use
- Audio captured and sent to local Whisper backend
- Transcribed text displayed in UI within 3 seconds
- User can edit transcribed text before sending

### US-002: Push-to-Talk
**As a** user in a noisy environment
**I want to** hold a key to record and release to stop
**So that** only my intended speech is captured

**Acceptance Criteria:**
- Configurable hotkey (default: Space bar in focused mode)
- Visual indicator shows recording state
- Recording stops immediately on key release
- Transcription begins automatically on release

### US-003: Voice Activation
**As a** user with hands busy
**I want to** just start speaking and have the system detect my voice
**So that** I don't need to press any button

**Acceptance Criteria:**
- VAD detects speech onset automatically
- Silence detection stops recording (configurable threshold)
- Visual feedback shows listening vs recording vs processing states
- Configurable silence timeout (default: 1.5 seconds)

### US-004: Toggle Recording
**As a** user who wants explicit control
**I want to** click once to start and once to stop recording
**So that** I have precise control over what gets recorded

**Acceptance Criteria:**
- Single button toggles recording on/off
- Clear visual state (idle/recording/processing)
- Works with both mouse click and keyboard shortcut

### US-005: Send to Claude API
**As a** user who wants a standalone voice-to-Claude interface
**I want to** send transcribed text directly to Claude API
**So that** I get AI responses without needing the CLI

**Acceptance Criteria:**
- Anthropic API key configurable in settings
- Transcribed text sent as user message
- Claude response displayed in conversation view
- Conversation history maintained in session

### US-006: WebSocket Bridge
**As a** Claude Code CLI user
**I want to** have transcribed text injected into my running CLI session
**So that** I can use voice input with my existing workflow

**Acceptance Criteria:**
- Bridge service runs alongside Claude Code
- Transcribed text appears in Claude Code prompt
- Connection status visible in web UI
- Graceful handling of disconnections

### US-007: Model Selection
**As a** user with varying hardware
**I want to** choose which Whisper model to use
**So that** I can balance accuracy vs speed for my system

**Acceptance Criteria:**
- Model selector in settings UI
- Shows model size, estimated accuracy, RAM requirements
- Hot-swap models without restarting backend
- Default model auto-selected based on available hardware

---

## 4. Technical Requirements

### 4.1 Backend (Python + FastAPI)
- **TR-001:** FastAPI server on configurable port (default: 8765)
- **TR-002:** WebSocket endpoint for streaming audio from browser
- **TR-003:** REST endpoint for audio file upload transcription
- **TR-004:** Faster-Whisper integration with GPU auto-detection (reuse from bacon-ai-voice-mcp)
- **TR-005:** Model management API (list, load, switch, download)
- **TR-006:** Health check endpoint
- **TR-007:** CORS configuration for local development

### 4.2 Frontend (React + Vite + TypeScript)
- **TR-008:** MediaRecorder API for microphone capture
- **TR-009:** WebSocket client for streaming audio to backend
- **TR-010:** Web Audio API (AnalyserNode) for waveform visualization
- **TR-011:** Keyboard event handling for push-to-talk
- **TR-012:** Browser VAD using audio level thresholds
- **TR-013:** Responsive transcription display with edit capability

### 4.3 Integration Backends
- **TR-014:** Anthropic SDK integration for Claude API direct mode
- **TR-015:** WebSocket bridge server for Claude Code injection
- **TR-016:** MCP server implementation (stdio transport)

### 4.4 Cross-Platform
- **TR-017:** Browser-based audio capture (no native dependencies on client)
- **TR-018:** Python backend runs on Windows, Linux (WSL), macOS
- **TR-019:** Whisper models stored in user-configurable directory

---

## 5. Non-Functional Requirements

| ID | Requirement | Target |
|----|------------|--------|
| NFR-001 | Transcription latency (speech end to text) | <3 seconds (base model) |
| NFR-002 | Audio capture latency | <100ms |
| NFR-003 | Backend memory usage (base model) | <500MB |
| NFR-004 | Frontend bundle size | <2MB gzipped |
| NFR-005 | Browser support | Chrome 90+, Firefox 90+, Edge 90+, Safari 15+ |
| NFR-006 | Concurrent users | Single user (local deployment) |
| NFR-007 | Data privacy | All processing local, no data leaves machine |

---

## 6. Dependencies

| Dependency | Type | Risk |
|-----------|------|------|
| Faster-Whisper | Python library | Low - mature, well-maintained |
| FastAPI | Python framework | Low - stable |
| React 18+ | Frontend framework | Low - stable |
| Vite | Build tool | Low - stable |
| Browser MediaRecorder API | Web API | Medium - Safari support varies |
| Anthropic SDK | API client | Low - for Claude API direct mode |
| sounddevice (backend only) | Audio library | Medium - cross-platform audio drivers |

---

## 7. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Browser mic permissions blocked | High | Medium | Clear permission request UX, troubleshooting guide |
| Whisper too slow on CPU | Medium | Medium | Default to tiny/base model, recommend GPU |
| WebSocket bridge to Claude Code infeasible | Medium | High | Alternative: clipboard injection, MCP server |
| Safari MediaRecorder limitations | Low | High | Document supported browsers, Chrome recommended |
| Audio format incompatibility | Medium | Low | Convert to WAV/PCM on backend, accept multiple formats |
| WSL audio passthrough issues | High | Medium | Document pulseaudio/pipewire setup for WSL |
| Large model download on first use | Medium | High | Show download progress, default to tiny/base |
| Settings lost between sessions | Low | Medium | Persist in localStorage + backend config file |

---

## 8. Requirements Traceability Matrix

| Requirement | Feature | Test Coverage |
|-------------|---------|---------------|
| REQ-001 | FEAT-001 | TUT: API endpoints, Whisper engine |
| REQ-002 | FEAT-002 | FUT: Mic capture, UI rendering |
| REQ-003 | FEAT-003 | FUT: Push-to-talk keyboard events |
| REQ-004 | FEAT-004 | FUT: VAD start/stop detection |
| REQ-005 | FEAT-005 | FUT: Toggle button state machine |
| REQ-006 | FEAT-006 | SIT: Full transcribe-to-Claude flow |
| REQ-007 | FEAT-007 | SIT: WebSocket bridge injection |
| REQ-008 | FEAT-008 | SIT: MCP tool invocation |
| REQ-009 | FEAT-009 | TUT: Model loading/switching |
| REQ-010 | FEAT-010 | SIT: Cross-platform audio tests |
| REQ-014 | FEAT-009 | FUT: Download progress display |
| REQ-015 | FEAT-002 | TUT: Settings save/load |
| REQ-016 | FEAT-002 | FUT: Error state handling |
| REQ-017 | FEAT-001+002 | SIT: Startup script launches both |

---

## 9. Implementation Phases (Proposed)

### Phase A: Foundation (FEAT-001 + FEAT-002)
- Backend: FastAPI + Whisper engine + WebSocket audio endpoint
- Frontend: React scaffold + mic capture + basic transcription display
- **Gate:** Can record audio in browser and see transcribed text

### Phase B: Activation Modes (FEAT-003 + FEAT-004 + FEAT-005)
- Push-to-talk, voice activation, toggle button
- **Gate:** All three modes work independently

### Phase C: Integration Backends (FEAT-006 + FEAT-007 + FEAT-008)
- Claude API direct, WebSocket bridge, MCP server
- **Gate:** At least one backend successfully delivers to Claude

### Phase D: Polish (FEAT-009 + FEAT-010 + FEAT-011)
- Model selector, cross-platform testing, waveform visualization
- **Gate:** Full TUT + FUT + SIT + browser testing evidence

---

*Document end. Reviewed by: TBD (awaiting human checkpoint)*
