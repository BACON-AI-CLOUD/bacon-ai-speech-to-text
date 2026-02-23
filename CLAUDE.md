# bacon-ai-voice - Project Directive

> **Auto-loaded by Claude Code on every session start and after every context compaction.**
> This file is the single source of truth for project context recovery.

## PROJECT IDENTITY

| Field | Value |
|-------|-------|
| Project | bacon-ai-voice |
| Description | STT web interface for Claude Code - speech-to-text with local Whisper, AI text refinement, discuss mode, and multi-backend integration |
| Repository | BACON-AI-CLOUD/bacon-ai-speech-to-text |
| Tech Stack | React+Vite+TypeScript frontend, Python+FastAPI backend, OpenAI Whisper (local), WebSocket |
| Created | 2026-02-11 |
| Owner | Colin Bacon |

## CURRENT STATUS (KEEP UPDATED)

| Field | Value |
|-------|-------|
| **Current Phase** | v1.4 File Transcription + Suffix Injections |
| **Phase Status** | in-progress |
| **Active Features** | FEAT-310 (File Transcription), FEAT-311 (Suffix Injections) |
| **Active Branch** | feature/v1.4-file-transcription |
| **Last Action** | v1.4 implementation complete - all agents done |
| **Next Step** | UAT - test file transcription and suffix injections in browser |
| **Blockers** | None |
| **Last Updated** | 2026-02-23 by orchestrator |

## YOUR ROLE: ORCHESTRATOR

You are the **BACON-AI Project Orchestrator**. You plan, delegate, coordinate, verify, and report. You do NOT write production code directly - delegate to coding sub-agents.

### 3 Laws of AI Agent Control

1. **Don't Trust, Verify** - Every agent claim requires independent evidence
2. **Proximity Beats Priority** - Rules at the action moment > rules at session start
3. **Impossible Beats Improbable** - Technical controls > behavioral controls

### Mandatory Behavior

1. **Anti-Sycophancy**: Never claim success without evidence. Report failures honestly.
2. **Anti-Hallucination**: Never fabricate test results, tool names, or file contents. Read before referencing.
3. **Deterministic**: Same inputs = same outputs. Mark unknowns as `TBD`, never fabricate.
4. **Evidence-Based**: Every test claim needs logs/screenshots. "Agent said it works" is not evidence.
5. **Phase Discipline**: Follow the BACON-AI 12-phase framework. No skipping phases.

### Human Checkpoints (MUST PAUSE)

- After completing documentation (Plan Review)
- Before coding begins (Pre-Implementation)
- Before merging to main (Pre-Release)
- Before any irreversible action (Data migrations, schema changes)
- After any incident (Post-Incident Review)

## COMPLEXITY CLASSIFICATION

**Score: CRITICAL (17+)**
- Files affected: 10+ files (5 points, 1x weight)
- UI changes: Yes (4 points, 2x weight)
- Crosses module boundaries: Yes (4 points, 2x weight)
- New external dependencies: Yes - Whisper, WebSocket, React (4 points, 2x weight)
- **Total: 17+ = CRITICAL tier**
- **All 20 CPs active**

## ARCHITECTURE OVERVIEW

### Components
1. **Frontend (React+Vite+TS)**: Web UI with microphone access, waveform display, activation controls, left history sidebar, refiner settings
2. **Backend (Python+FastAPI)**: Whisper STT engine, audio processing, WebSocket server, AI text refinement pipeline, discuss mode with TTS
3. **Refiner Providers** (6 total): Groq, Ollama, Gemini, OpenAI, Anthropic, Claude CLI
4. **Integration Layer**: Three output backends:
   - **Claude API Direct**: Send transcribed text to Claude API, display response
   - **WebSocket Bridge**: Inject text into running Claude Code session
   - **MCP Server**: Native Claude Code MCP tool integration

### API Key Storage
- **Location:** `~/.config/bacon-ai-voice/.env` (python-dotenv)
- **Migration:** Auto-migrates from refiner.json on first startup
- **Env vars:** GROQ_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
- **Frontend never sees keys**: Only sends keys to backend, backend stores in .env

### Activation Modes (all 3 implemented)
1. **Push-to-talk**: Hold key to record, release to transcribe
2. **Voice activation**: Always listening with silence/VAD detection
3. **Toggle button**: Click to start, click to stop

### Whisper Model Configuration
User-selectable: tiny, base, small, medium, large-v3

## CONTROL POINTS (20 CPs) - ALL ACTIVE

- **CP-1**: Docs before code (PRD/ADR/test strategy must exist)
- **CP-4**: Feature branches only (never commit to main/develop)
- **CP-5**: Semantic commits (feat:/fix:/docs:/test:/refactor:)
- **CP-6**: No hallucination keywords
- **CP-7**: Run tests before pushing, capture evidence
- **CP-9**: Browser testing MANDATORY (this is a UI project)
- **CP-14**: Never merge to main without human approval
- **CP-17**: Sub-agent context propagation with project state

## GIT STRATEGY

- **main** -> production (protected)
- **develop** -> integration
- **feature/FEAT-{ID}-{title}** -> one per feature per agent
- Semantic commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

## QUALITY GATES

| Test | Scope | Evidence Required |
|------|-------|-------------------|
| TUT | Unit tests (Whisper engine, API endpoints, React components) | Pass/fail log + coverage % |
| FUT | Functional test (recording, transcription, display) | Screenshots + interaction log |
| SIT1 | Integration with mocked Claude API | Full flow screenshots + API logs |
| SIT2 | Integration with real Claude API + WebSocket | Complete evidence pack |
| RGT | Regression (unchanged features) | Before/after comparison |
| UAT | User acceptance (Colin validates) | Human sign-off document |

## FEATURE TRACKING

### v1.0 Features (ALL COMPLETE - merged to main 2026-02-15)

| Feature ID | Title | Phase | Branch | Status | Evidence |
|-----------|-------|-------|--------|--------|----------|
| FEAT-001 | Core STT Backend (FastAPI + Whisper) | Phase A | feature/FEAT-001-stt-backend | completed | 32 backend tests |
| FEAT-002 | React Web UI (mic capture, waveform, controls) | Phase A | feature/FEAT-002-react-ui | completed | 22 frontend tests |
| FEAT-003 | Push-to-talk activation mode | Phase B | feature/FEAT-003-005-activation-modes | completed | 21 frontend tests |
| FEAT-004 | Voice activation mode (VAD) | Phase B | feature/FEAT-003-005-activation-modes | completed | Included in Phase B tests |
| FEAT-005 | Toggle button activation mode | Phase B | feature/FEAT-003-005-activation-modes | completed | Included in Phase B tests |
| FEAT-006 | Claude API direct integration | Phase C | feature/FEAT-006-008-integrations | completed | 20 backend tests |
| FEAT-007 | WebSocket bridge to Claude Code | Phase C | feature/FEAT-006-008-integrations | completed | Included in Phase C tests |
| FEAT-008 | MCP Server integration | Phase C | feature/FEAT-006-008-integrations | completed | Included in Phase C tests |
| FEAT-009 | Whisper model selector (configurable) | Phase D | feature/FEAT-009-014-polish | completed | 15 frontend tests |
| FEAT-010 | Cross-platform audio handling | Phase D | feature/FEAT-009-014-polish | completed | Included in Phase D tests |
| FEAT-011 | Model download with progress UI | Phase D | feature/FEAT-009-014-polish | completed | Included in Phase D tests |
| FEAT-012 | Settings persistence (localStorage + config.json) | Phase D | feature/FEAT-009-014-polish | completed | Included in Phase D tests |
| FEAT-013 | Error handling UX (all error states) | Phase D | feature/FEAT-009-014-polish | completed | Included in Phase D tests |
| FEAT-014 | Startup scripts (start.sh / start.bat) | Phase D | feature/FEAT-009-014-polish | completed | Included in Phase D tests |

### Post-v1.0 Bug Fixes (merged to main 2026-02-16)

| ID | Title | Status | Details |
|----|-------|--------|---------|
| FIX-001 | CORS blocking /windows endpoint | completed | allow_origins=["*"] |
| FIX-002 | Silence timeout not auto-stopping in toggle mode | completed | Standalone silence monitor in App.tsx |
| FIX-003 | WebSocket StrictMode race condition | completed | wsRef.current !== ws guard |
| FIX-004 | StatusBar crash on undefined state | completed | Null safety checks |

### Post-v1.0 Enhancements (on develop)

| ID | Title | Status | Details |
|----|-------|--------|---------|
| FEAT-015 | Auto-focus typing to target window | completed | Types transcription to specified window title |
| FEAT-016 | Global hotkey (system-wide recording toggle) | completed | Implemented on feature/multi-version-ports |

### v1.1 Features (ALL COMPLETE - on feature/multi-version-ports)

| Feature ID | Title | Priority | Status | PRD Ref |
|-----------|-------|----------|--------|---------|
| FEAT-101 | Refiner pipeline (raw text -> AI cleanup -> clean text) | P0 | completed | REQ-101 |
| FEAT-102 | Groq provider (cloud, ~200ms) | P0 | completed | REQ-102 |
| FEAT-103 | Ollama provider (local, free) | P0 | completed | REQ-103 |
| FEAT-104 | Gemini provider (cloud) | P1 | completed | REQ-104 |
| FEAT-105 | Refiner on/off toggle UI | P0 | completed | REQ-105 |
| FEAT-106 | Provider selection + API key management | P0 | completed | REQ-106, REQ-107 |
| FEAT-107 | Raw vs refined text comparison | P0 | completed | REQ-108 |
| FEAT-108 | Customizable cleanup prompt + templates | P1 | completed | REQ-109 |
| FEAT-109 | Test refiner button | P1 | completed | REQ-110 |
| FEAT-110 | Auto-refine after transcription | P0 | completed | REQ-111 |
| FEAT-111 | Refined text for keyboard typing | P0 | completed | REQ-112 |
| FEAT-112 | REST endpoints (process, config, test, providers, models) | P0 | completed | REQ-113-115 |
| FEAT-113 | Graceful fallback on provider error with warnings | P0 | completed | REQ-116 |
| FEAT-114 | API key security (.env file, auto-migration) | P0 | completed | REQ-117 |

### v1.2 Features (ALL COMPLETE - on feature/multi-version-ports)

| Feature ID | Title | Priority | Status | Notes |
|-----------|-------|----------|--------|-------|
| FEAT-201 | OpenAI provider (55 live models, chat filtering) | P1 | completed | Live API model listing |
| FEAT-202 | Anthropic provider (Claude API) | P1 | completed | httpx-based |
| FEAT-203 | Claude CLI provider (`claude --print` subprocess) | P2 | completed | Clean env, /tmp cwd, 60s timeout |
| FEAT-204 | Chat with Elisabeth discuss mode | P1 | completed | TTS via edge-tts, conversation history |
| FEAT-205 | HistorySidebar component (left sidebar layout) | P1 | completed | Claude Desktop-style layout |
| FEAT-206 | Prompt template system (save/delete/reset) | P1 | completed | 8 built-in + custom user templates |
| FEAT-207 | Custom model management per provider | P1 | completed | Add/remove custom models in UI |
| FEAT-208 | .env file for API key storage | P0 | completed | Auto-migration from config.json |
| FEAT-209 | Deep-merge config fix (prevent key loss) | P0 | completed | Per-provider dict.update() |
| FEAT-210 | Provider warning messages in UI | P1 | completed | Rate limits, auth failures, timeouts |
| FEAT-211 | Test connection per provider | P1 | completed | GET /providers/{name}/test-connection |

### v1.3 Features (PLANNED - PRD-003, feature/v1.2-tts-edge)

| Feature ID | Title | Priority | Status | PRD Ref |
|-----------|-------|----------|--------|---------|
| FEAT-301 | Right sidebar: quick provider/model/template switching | P0 | planned | REQ-301 |
| FEAT-302 | Right sidebar: output controls tab | P0 | planned | REQ-302 |
| FEAT-303 | Audio beeps for all activation modes | P1 | planned | REQ-303 |
| FEAT-304 | Chat tab (chatbot UI + voice/text input) | P0 | planned | REQ-304-306 |
| FEAT-305 | Dictation mode (pause/resume, canvas sessions) | P0 | planned | REQ-307-310 |
| FEAT-306 | MCP server for text refinement | P1 | planned | REQ-311-312 |
| FEAT-307 | Wake word trigger ("Hey Colin") | P2 | planned | REQ-313-314 |
| FEAT-308 | Mini-button collapse | P1 | planned | REQ-315-316 |
| FEAT-309 | History persistence + project grouping | P0 | planned | REQ-317-320 |

### v1.4 Features (IN PROGRESS - feature/v1.4-file-transcription)

| Feature ID | Title | Priority | Status | PRD Ref |
|-----------|-------|----------|--------|---------|
| FEAT-310 | File Transcription panel (upload + path + formats + refine + download) | P0 | in-progress | REQ-401 to REQ-408 |
| FEAT-311 | Suffix Injection Prompts (configurable append-to-prompt checkboxes) | P0 | in-progress | REQ-409 to REQ-413 |

## TEST COUNTS (Verified 2026-02-23)

| Area | Count | Details |
|------|-------|---------|
| Backend | 103 | config:15, health:3, models:5, transcribe:3, websocket:6, integrations:20, refiner:6, refiner_api:12, refiner_providers:33 |
| Frontend | 83 | useSettings:6, useWebSocket:9, TranscriptionDisplay:9, useActivation:21, SettingsPanel:7, ErrorDisplay:4, ModelProgress:3, RefinerSettings:10, TextComparison:6, QuickControlsSidebar:8 |
| **Total** | **186** | **0 failures** |

## LESSONS LEARNED (PROJECT-SPECIFIC)

| # | Issue | Resolution | Prevention |
|---|-------|------------|------------|
| 1 | pyproject.toml missing wheel packages config | Added `[tool.hatch.build.targets.wheel] packages = ["app"]` | Always verify build config on new Python projects |
| 2 | Sub-agents shared CWD causing wrong-branch confusion | Explicit branch switch in agent prompts | Always specify branch in sub-agent context |
| 3 | Git unrelated histories merge (55+ add/add conflicts) | Force push after extracting needed files from remote | Use force push for initial repo setup, not merge |
| 4 | thebacons account denied push to BACON-AI-CLOUD | Use BACON-AI-CLOUD PAT from ~/.env | Always check which GitHub account has push access |
| 5 | PRD vs ADD conflicts (API key storage, default provider) | Resolved during gap analysis, docs updated | Run gap analysis between PRD and ADD before coding |
| 6 | Shallow dict.update() wiped API keys on config save | Deep-merge: per-provider dict.update() in loop | Always deep-merge nested config dicts |
| 7 | API keys in config.json exposed on disk | Moved to .env file with auto-migration | Use .env for secrets, config files for non-secrets |
| 8 | OpenAI 429 rate limit with no user feedback | Added warning field to RefinerResult, UI shows orange banner | Always surface API errors to user with actionable message |

## KEY DECISIONS

| # | Decision | Rationale | ADR Link | Date |
|---|----------|-----------|----------|------|
| 1 | Local Whisper over cloud STT | Free, private, no API costs, configurable model size | TBD | 2026-02-11 |
| 2 | React+Vite for frontend | Modern, fast dev experience, TypeScript support | TBD | 2026-02-11 |
| 3 | Three integration backends | Flexibility - test which works best for Claude Code workflow | TBD | 2026-02-11 |
| 4 | Three activation modes | User preference testing - find optimal UX | TBD | 2026-02-11 |
| 5 | Reuse bacon-ai-voice-mcp Whisper engine | Proven, GPU-optimized, already tested | TBD | 2026-02-11 |
| 6 | English only for v1.0 | Simplicity, can add multi-language later | - | 2026-02-11 |
| 7 | WebM/Opus direct to Faster-Whisper | Avoids WAV conversion step, Whisper accepts WebM natively | - | 2026-02-11 |
| 8 | AnalyserNode+RMS for browser VAD | Simpler than ONNX, no model dependency, sufficient accuracy | - | 2026-02-11 |
| 9 | localStorage for frontend settings | Simple, no database, survives page refreshes | - | 2026-02-11 |
| 10 | Git branching over separate directories | Single repo, incremental features, full diff/merge tooling | PLAN-VERSIONING-STRATEGY | 2026-02-16 |
| 11 | API keys in .env file (not config.json or localStorage) | Most secure - secrets separated from config, auto-migration | ADD-002 | 2026-02-19 |
| 12 | Ollama as default refiner provider | Works without API key, best first-run UX | PRD-002 | 2026-02-16 |
| 13 | 6 refiner providers (Groq, Ollama, Gemini, OpenAI, Anthropic, Claude CLI) | Maximum flexibility for user's existing API keys | - | 2026-02-19 |
| 14 | HistorySidebar left panel layout | Claude Desktop-style, always-visible history | - | 2026-02-19 |
| 15 | edge-tts for discuss mode TTS | Free, no API key, good voice quality | - | 2026-02-19 |
| 16 | Conversation history in discuss mode | Frontend tracks and sends history, backend builds full message array | - | 2026-02-19 |
| 17 | File transcription as separate tab | Clean separation from live recording UX | - | 2026-02-23 |
| 18 | Suffix injections as frontend-only feature | Injections arrive at backend as part of custom_prompt | - | 2026-02-23 |
| 19 | AHK v2 tray icon (no pystray) | pystray must run as Windows process; AHK already is | - | 2026-02-23 |
| 20 | ttyd port guard in Chrome ext | Prevent false-positive on non-ttyd xterm.js pages | - | 2026-02-23 |

## DOCUMENTS

| Document | Path | Status |
|----------|------|--------|
| PRD-001 (v1.0 Core STT) | docs/prd/PRD-001-bacon-ai-voice.md | Implemented |
| PRD-002 (v1.1 Text Refinement) | docs/prd/PRD-002-v1.1-text-refinement.md | Implemented |
| PRD-003 (v1.3 UX Enhancements) | docs/prd/PRD-003-v1.3-ux-enhancements.md | Draft |
| ADD-001 (v1.0 Architecture) | docs/add/ADD-001-architecture.md | Implemented |
| ADD-002 (v1.1 Architecture) | docs/add/ADD-002-v1.1-text-refinement.md | Needs update (missing .env, new providers) |
| ADD-003 (v1.3 Architecture) | TBD | Not yet created |
| Test Strategy | docs/test-strategy/TEST-STRATEGY-001.md | Current |
| PRD-004 (v1.4 File Transcription) | docs/prd/PRD-004-v1.4-file-transcription.md | Draft |
| ADD-004 (v1.4 Architecture) | docs/add/ADD-004-v1.4-file-transcription.md | Draft |
| TEST-STRATEGY-003 (v1.4) | docs/test-strategy/TEST-STRATEGY-003-v1.4.md | Draft |
| Versioning Plan | docs/plans/PLAN-VERSIONING-STRATEGY-20260216.md | Approved |

## RECOVERY PROTOCOL (READ AFTER COMPACTION)

```
1. You are HERE -> Reading CLAUDE.md (auto-loaded)
2. Read CURRENT STATUS table above -> Know phase, branch, last action
3. Read progress/in-progress/ -> Get detailed build notes
4. Read progress/lessons-learned/ -> Avoid repeating past mistakes
5. Run: git log --oneline -10 -> See recent changes
6. Run: git status -> See uncommitted work
7. Resume from "Next Step" in status table
```

## PROJECT STRUCTURE

```
bacon-ai-voice/
├── docs/
│   ├── prd/                    # Project Requirements (PRD-001, PRD-002, PRD-003)
│   ├── prd-features/           # Feature-level requirements
│   ├── urd/                    # User Requirements
│   ├── add/                    # Architecture Design (ADD-001, ADD-002)
│   ├── tsd/                    # Technical Specifications
│   ├── fsd/                    # Functional Specifications
│   ├── test-strategy/          # Test Strategy + Cases
│   ├── plans/                  # Phase plans
│   └── adr/                    # Architecture Decision Records
├── progress/
│   ├── planned/
│   ├── in-progress/            # !! READ THIS AFTER COMPACTION
│   ├── testing/
│   ├── completed/
│   ├── lessons-learned/        # !! READ THIS AFTER COMPACTION
│   └── audit/
├── src/
│   ├── frontend/               # React+Vite+TypeScript
│   │   └── src/components/     # HistorySidebar, RefinerSettings, TextComparison, etc.
│   └── backend/                # Python+FastAPI+Whisper
│       └── app/
│           ├── refiner/        # AI text refinement pipeline
│           │   └── providers/  # groq, ollama, gemini, openai, anthropic, claude_cli
│           ├── discuss.py      # Chat with Elisabeth (TTS via edge-tts)
│           └── refiner_api.py  # REST API for refiner
├── tests/
│   ├── unit/
│   │   └── backend/            # 103 tests
│   ├── integration/
│   ├── e2e/
│   ├── performance/
│   └── quarantine/
├── .github/workflows/
├── CLAUDE.md                   # THIS FILE
├── constitution.yml
├── CHANGELOG.md
└── README.md
```

---

*This CLAUDE.md is a living document. Update it as the project progresses.*
*Skill reference: ~/.claude/skills/ai-coding-orchestrator/SKILL.md v3.0*
