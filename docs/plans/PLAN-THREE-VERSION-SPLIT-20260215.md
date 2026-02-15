# Plan: Split bacon-ai-voice into 3 Versioned Projects

**Date**: 2026-02-15
**Author**: Orchestrator Agent (Opus 4.6)
**Status**: Awaiting approval

## Context

The current `bacon-ai-voice` project has all 14 features implemented (110 tests, 0 failures) on `develop` branch. The user wants three standalone projects with increasing capability:

- **v1 (Simple)**: Current webapp as-is — browser-based STT with Whisper
- **v2 (Advanced)**: + Python daemon with wake word ("Hey BACON!"), keyboard emulation, clipboard
- **v3 (Professional)**: + AI speech refiner (Groq/Ollama/Gemini) to clean transcriptions

Requirements: Pure Python, portable to Ubuntu, no AutoHotkey. Each project gets own folder, git repo, scaffolding, docs.

---

## PRD Requirements Validation (All 17 REQs)

| REQ | Description | v1 | v2 | v3 | Files |
|-----|------------|:--:|:--:|:--:|-------|
| REQ-001 | FastAPI+Whisper backend | ✅ | ✅ | ✅ | main.py, whisper_engine.py |
| REQ-002 | React+Vite+TS UI + mic | ✅ | ✅ | ✅ | AudioCapture.tsx, App.tsx |
| REQ-003 | Push-to-talk | ✅ | ✅ | ✅ | useActivation.ts |
| REQ-004 | Voice activation (VAD) | ✅ | ✅ | ✅ | useVAD.ts |
| REQ-005 | Toggle button | ✅ | ✅ | ✅ | useActivation.ts |
| REQ-006 | Claude API direct | ✅ | ✅ | ✅ | integrations/claude_api.py |
| REQ-007 | WebSocket bridge | ✅ | ✅ | ✅ | integrations/ws_bridge.py |
| REQ-008 | MCP Server | ✅ | ✅ | ✅ | integrations/mcp_server.py |
| REQ-009 | Model selector | ✅ | ✅ | ✅ | SettingsPanel.tsx, App.tsx |
| REQ-010 | Cross-platform audio | ✅ | ✅+ | ✅+ | Browser MediaRecorder + pyaudio |
| REQ-011 | Waveform visualization | ✅ | ✅ | ✅ | WaveformVisualizer.tsx |
| REQ-012 | Transcription history | ✅ | ✅ | ✅+ | TranscriptionDisplay.tsx + TextComparison |
| REQ-013 | Audio level meter | ✅ | ✅ | ✅ | AudioCapture audioLevel prop |
| REQ-014 | Model download progress | ✅ | ✅ | ✅ | ModelProgress.tsx |
| REQ-015 | Settings persistence | ✅ | ✅+ | ✅+ | useSettings.ts + daemon/refiner sections |
| REQ-016 | Error handling UX | ✅ | ✅ | ✅ | ErrorDisplay.tsx |
| REQ-017 | Startup scripts | ✅ | ✅+ | ✅+ | start.sh/bat + daemon start |

**Result: Zero gaps. All 17 requirements covered in all 3 versions.**

---

## Pre-requisite: Commit Current Fixes

Before splitting, commit two bug fixes on `develop` in `bacon-ai-voice`:
1. **useWebSocket.ts**: StrictMode race condition fix (onclose/onerror guard `if (wsRef.current !== ws) return`)
2. **useWebSocket.ts**: Status message guard (only set serverStatus for full status messages with gpu/model)
3. **StatusBar.tsx**: Optional chaining for `serverStatus.gpu?.available`

---

## Step 1: Create bacon-ai-voice-v1 (Simple)

**Location**: `/mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice-v1/`

**Action**: Copy current project (excluding `.venv/`, `node_modules/`, `__pycache__/`, `.git/`, temp files).

```bash
rsync -a --exclude='.venv' --exclude='node_modules' --exclude='__pycache__' \
  --exclude='.git' --exclude='SESSION-*' --exclude='*.log' \
  bacon-ai-voice/ bacon-ai-voice-v1/
```

**Changes to make:**
- `CLAUDE.md`: Update project name to "bacon-ai-voice-v1 (Simple)"
- `src/frontend/package.json`: name → "bacon-ai-voice-v1"
- `src/frontend/index.html`: title → "BACON Voice v1 - Simple"
- `src/backend/pyproject.toml`: name → "bacon-ai-voice-v1-backend"
- Remove any session restart log files
- `git init && git add -A && git commit`

**Existing file inventory (all carried over):**
- Backend: `app/main.py`, `app/config.py`, `app/stt/whisper_engine.py`, `app/audio/converter.py`, `app/integrations/{base,claude_api,ws_bridge,mcp_server,router}.py`
- Frontend: 7 components, 5 hooks, 1 util, App.tsx, types/index.ts
- Tests: 52 backend + 58 frontend = 110 tests
- Scripts: start.sh, start-dev.sh, start.bat, start-dev.bat
- Docs: PRD, architecture, test strategy, phase plans

---

## Step 2: Create bacon-ai-voice-v2 (Advanced)

**Location**: `/mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice-v2/`

**Action**: Copy v1 as base, then add daemon module.

### New Backend Files to Create

```
src/backend/app/daemon/
├── __init__.py
├── daemon.py          # Main daemon: mic → VAD → wake word → record → transcribe → output
├── wake_word.py       # Wake word detection (Whisper tiny on 2s chunks, match "Hey BACON!")
├── vad.py             # Voice Activity Detection + auto-stop after N seconds silence
├── keyboard.py        # Auto-detect: xdotool (X11) / ydotool (Wayland) / SendKeys (WSL)
└── clipboard.py       # Auto-detect: xclip (X11) / wl-copy (Wayland) / clip.exe (WSL)

src/backend/app/daemon_api.py   # FastAPI routes: POST /daemon/start, /daemon/stop, GET /daemon/status, PUT /daemon/config
```

### New Frontend Files to Create

```
src/frontend/src/components/DaemonStatus.tsx     # Daemon on/off toggle, status indicator, listening state
src/frontend/src/components/DaemonStatus.css
src/frontend/src/components/OutputSettings.tsx   # Output mode: clipboard/keyboard/both, tool selection dropdown
src/frontend/src/components/OutputSettings.css
```

### Files to Modify

- **`src/frontend/src/types/index.ts`**: Add DaemonSettings type
  ```typescript
  export interface DaemonSettings {
    wakePhrase: string;        // default: "Hey BACON"
    silenceTimeout: number;    // default: 5000 (ms)
    outputMode: 'clipboard' | 'keyboard' | 'both';
    keyboardTool: 'auto' | 'xdotool' | 'ydotool' | 'wtype' | 'sendkeys';
    clipboardTool: 'auto' | 'xclip' | 'xsel' | 'wl-copy' | 'clip.exe';
    daemonEnabled: boolean;
  }
  ```
- **`src/frontend/src/types/index.ts`**: Extend AppSettings with `daemon: DaemonSettings`
- **`src/frontend/src/hooks/useSettings.ts`**: Add daemon defaults
- **`src/frontend/src/App.tsx`**: Add DaemonStatus + OutputSettings components
- **`src/backend/app/main.py`**: Mount daemon_api router
- **`src/backend/pyproject.toml`**: Add deps: `webrtcvad>=2.0.10`, `pyaudio>=0.2.14`, `numpy>=1.24`
- **`CLAUDE.md`**: Update to v2 description
- **`src/frontend/package.json`**: name → "bacon-ai-voice-v2"
- **`src/frontend/index.html`**: title → "BACON Voice v2 - Advanced"

### New Test Files to Create

```
tests/unit/backend/test_daemon.py        # Daemon lifecycle, wake word matching, auto-stop
tests/unit/backend/test_keyboard.py      # Keyboard tool auto-detection, text typing
tests/unit/backend/test_clipboard.py     # Clipboard tool auto-detection
src/frontend/src/components/__tests__/DaemonStatus.test.tsx
src/frontend/src/components/__tests__/OutputSettings.test.tsx
```

### Key Implementation Details

- **Wake word**: Continuously transcribe 2-second audio chunks with Whisper tiny. Match configurable phrase (default "Hey BACON"). Case-insensitive fuzzy match.
- **Auto-stop**: After wake word detected, record until `silenceTimeout` ms of silence (default 5000ms = 5 seconds, as user requested). Uses webrtcvad for silence detection.
- **Keyboard emulation**: Auto-detect via `$XDG_SESSION_TYPE` + `shutil.which()`:
  - X11: `subprocess.run(['xdotool', 'type', '--clearmodifiers', text])`
  - Wayland: `subprocess.run(['ydotool', 'type', text])` or `wtype`
  - WSL: `subprocess.run(['powershell.exe', '-c', f"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{text}')"])`
- **Clipboard**: Auto-detect:
  - X11: `subprocess.run(['xclip', '-selection', 'clipboard'], input=text)`
  - Wayland: `subprocess.run(['wl-copy', text])`
  - WSL: `subprocess.run(['clip.exe'], input=text)`
- **Daemon lifecycle**: Background asyncio task within FastAPI process. Managed via REST endpoints. Status includes: running/stopped, last wake detection time, last transcription.
- **Webapp as config UI**: User explicitly requested the webapp stays as config interface. DaemonStatus.tsx and OutputSettings.tsx in SettingsPanel provide full daemon configuration (wake phrase, silence timeout, output mode, tool selection).

---

## Step 3: Create bacon-ai-voice-v3 (Professional)

**Location**: `/mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice-v3/`

**Action**: Copy v2 as base, then add refiner module.

### New Backend Files to Create

```
src/backend/app/refiner/
├── __init__.py
├── refiner.py              # Pipeline: raw text → AI cleanup → cleaned text (optional, toggleable)
├── prompts.py              # System prompts for speech cleanup
└── providers/
    ├── __init__.py
    ├── base.py             # Abstract: async def refine(text: str) -> str
    ├── groq_provider.py    # Groq API (llama-3.3-70b-versatile, ~200ms)
    ├── ollama_provider.py  # Local Ollama (any model, http://localhost:11434)
    └── gemini_provider.py  # Google Gemini Flash

src/backend/app/refiner_api.py  # FastAPI routes: POST /refiner/process, GET /refiner/config, POST /refiner/test
```

### New Frontend Files to Create

```
src/frontend/src/components/RefinerSettings.tsx  # Provider dropdown, API key inputs, on/off toggle, test button
src/frontend/src/components/RefinerSettings.css
src/frontend/src/components/TextComparison.tsx   # Side-by-side: raw transcription vs refined text
src/frontend/src/components/TextComparison.css
```

### Files to Modify

- **`src/frontend/src/types/index.ts`**: Add RefinerSettings type
  ```typescript
  export interface RefinerSettings {
    enabled: boolean;
    provider: 'groq' | 'ollama' | 'gemini';
    model: string;           // e.g. "llama-3.3-70b-versatile" for Groq
    apiKey: string;          // for Groq/Gemini (empty for Ollama)
    ollamaUrl: string;       // default: "http://localhost:11434"
    customPrompt: string;    // override default cleanup prompt
  }
  ```
- **`src/frontend/src/types/index.ts`**: Extend AppSettings with `refiner: RefinerSettings`
- **`src/frontend/src/hooks/useSettings.ts`**: Add refiner defaults
- **`src/frontend/src/App.tsx`**: Add RefinerSettings + TextComparison components, wire refiner into transcription flow
- **`src/backend/app/main.py`**: Mount refiner_api router
- **`src/backend/app/daemon/daemon.py`**: Insert refiner step between transcription and output (when enabled)
- **`src/backend/pyproject.toml`**: Add dep: `httpx>=0.27`
- **`CLAUDE.md`**: Update to v3 description
- **`src/frontend/package.json`**: name → "bacon-ai-voice-v3"
- **`src/frontend/index.html`**: title → "BACON Voice v3 - Professional"

### New Test Files to Create

```
tests/unit/backend/test_refiner.py           # Refiner pipeline, provider switching, prompt handling
tests/unit/backend/test_refiner_providers.py  # Each provider's API call mocking
src/frontend/src/components/__tests__/RefinerSettings.test.tsx
src/frontend/src/components/__tests__/TextComparison.test.tsx
```

### Key Implementation Details

- **Refiner pipeline**: Optional step between transcription and output. User toggles on/off in settings.
- **Default cleanup prompt** (in `prompts.py`):
  ```
  Clean up this speech transcription. Remove filler words (um, uh, ah, hmm),
  false starts, repetitions, and nonsense gibberish. Preserve the speaker's
  intent and meaning exactly. Output only the cleaned text, nothing else.
  ```
- **Provider abstraction**: All providers implement `async def refine(text: str) -> str`
- **Groq**: httpx POST to `https://api.groq.com/openai/v1/chat/completions` — fastest cloud option (~200ms)
- **Ollama**: httpx POST to `http://localhost:11434/api/generate` — local, no API key needed
- **Gemini**: httpx POST to Gemini API — fast cloud alternative
- **Latency target**: < 500ms for refiner step
- **TextComparison**: Shows raw transcription alongside refined version so user can verify quality
- **API key security**: Stored in localStorage (frontend), never sent to backend logs. Groq/Gemini keys required, Ollama runs locally.

---

## Step 4: Documentation & Scaffolding per Version

Each project gets:
- **`CLAUDE.md`**: Updated project name, version, feature list
- **`README.md`**: Version-specific setup instructions + usage guide
- **`docs/prd/`**: Version-specific PRD extension (v2: daemon features, v3: refiner features)
- **`pyproject.toml`**: Correct name + version + dependencies
- **`package.json`**: Correct name
- **New `git init`**: Fresh git history per project

---

## Step 5: Cleanup

For each project copy:
- Remove `SESSION-RESTART-LOG-*.md` files
- Remove `SESSION-RESUME-LOG*.txt` files
- Remove `.venv/` (recreate with `uv venv && uv pip install -e ".[dev]"`)
- Remove `node_modules/` (recreate with `npm install`)
- Remove `__pycache__/` directories
- Remove `src/backend/uv.lock` if present

---

## Implementation Order

1. Commit current bug fixes on `bacon-ai-voice` develop branch
2. Create v1 (rsync + clean up + git init) — ~10 min
3. Create v2 (copy v1 + add 7 backend files + 4 frontend files + 5 test files + modify 8 existing files) — ~45 min
4. Create v3 (copy v2 + add 8 backend files + 4 frontend files + 4 test files + modify 7 existing files) — ~30 min
5. Verify all three projects independently

---

## Verification Plan

For each version:
1. **Backend**: `cd src/backend && uv venv && uv pip install -e ".[dev]" && uv run pytest -v`
2. **Frontend**: `cd src/frontend && npm install && npm test`
3. **Startup**: `./start-dev.sh` — app starts, renders in browser at localhost:5173
4. **Version-specific**:
   - v1: Record audio → see transcription (existing functionality)
   - v2: Start daemon → say "Hey BACON" → auto-stop after silence → text appears at cursor + clipboard
   - v3: Enable refiner → record → see raw vs refined text side-by-side → refined text to clipboard
