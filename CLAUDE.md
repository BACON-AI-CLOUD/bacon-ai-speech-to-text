# bacon-ai-voice - Project Directive

> **Auto-loaded by Claude Code on every session start and after every context compaction.**
> This file is the single source of truth for project context recovery.

## PROJECT IDENTITY

| Field | Value |
|-------|-------|
| Project | bacon-ai-voice |
| Description | STT web interface for Claude Code - speech-to-text with local Whisper, multiple activation modes, and multi-backend integration |
| Repository | TBD |
| Tech Stack | React+Vite+TypeScript frontend, Python+FastAPI backend, OpenAI Whisper (local), WebSocket |
| Created | 2026-02-11 |
| Owner | Colin Bacon |

## CURRENT STATUS (KEEP UPDATED)

| Field | Value |
|-------|-------|
| **Current Phase** | v1.1 AI Text Refinement - Design Complete, Pre-Implementation |
| **Phase Status** | design-complete |
| **Active Features** | v1.1 Text Refinement (REQ-101 to REQ-117) |
| **Active Branch** | feature/v1.1-text-refinement |
| **Last Action** | Gap analysis complete, PRD/ADD/CLAUDE.md conflicts resolved |
| **Next Step** | Human checkpoint (Pre-Implementation), then delegate coding to sub-agents |
| **Blockers** | None |
| **Last Updated** | 2026-02-16 by orchestrator |

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
1. **Frontend (React+Vite+TS)**: Web UI with microphone access, waveform display, activation controls
2. **Backend (Python+FastAPI)**: Whisper STT engine, audio processing, WebSocket server
3. **Integration Layer**: Three output backends:
   - **Claude API Direct**: Send transcribed text to Claude API, display response
   - **WebSocket Bridge**: Inject text into running Claude Code session
   - **MCP Server**: Native Claude Code MCP tool integration

### Existing Reusable Components (from bacon-ai-voice-mcp)
Located at: `/mnt/c/Users/colin/Claude-Work/mcp-servers/bacon-ai-voice-mcp/`
- `stt/whisper_engine.py` - Faster-Whisper with GPU auto-detection (REUSE)
- `audio/recorder.py` - VAD-enabled audio recording (REFERENCE for backend)
- `config.py` - GPU detection, model configs (REUSE)

### Activation Modes (all 3 to be implemented)
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

### Post-v1.0 Bug Fixes (on develop, merged to main 2026-02-16)

| ID | Title | Status | Details |
|----|-------|--------|---------|
| FIX-001 | CORS blocking /windows endpoint | completed | Added /windows to CORS allowed origins |
| FIX-002 | Silence timeout not auto-stopping in toggle mode | completed | Standalone silence monitor in App.tsx |
| FIX-003 | WebSocket StrictMode race condition | completed | Fixed double-mount cleanup |
| FIX-004 | StatusBar crash on undefined state | completed | Added null safety checks |

### Post-v1.0 Enhancements (on develop)

| ID | Title | Status | Details |
|----|-------|--------|---------|
| FEAT-015 | Auto-focus typing to target window | completed | Types transcription to specified window title |
| FEAT-016 | Global hotkey (system-wide recording toggle) | planned | Plan exists, deferred to v1.2 |

### v1.1 Features (IN PROGRESS - feature/v1.1-text-refinement)

| Feature ID | Title | Priority | Status | PRD Ref |
|-----------|-------|----------|--------|---------|
| FEAT-101 | Refiner pipeline (raw text → AI cleanup → clean text) | P0 | planned | REQ-101 |
| FEAT-102 | Groq provider (cloud, ~200ms) | P0 | planned | REQ-102 |
| FEAT-103 | Ollama provider (local, free) | P0 | planned | REQ-103 |
| FEAT-104 | Gemini provider (cloud) | P1 | planned | REQ-104 |
| FEAT-105 | Refiner on/off toggle UI | P0 | planned | REQ-105 |
| FEAT-106 | Provider selection + API key management | P0 | planned | REQ-106, REQ-107 |
| FEAT-107 | Raw vs refined text comparison | P0 | planned | REQ-108 |
| FEAT-108 | Customizable cleanup prompt | P1 | planned | REQ-109 |
| FEAT-109 | Test refiner button | P1 | planned | REQ-110 |
| FEAT-110 | Auto-refine after transcription | P0 | planned | REQ-111 |
| FEAT-111 | Refined text for keyboard typing | P0 | planned | REQ-112 |
| FEAT-112 | REST endpoints (process, config, test) | P0 | planned | REQ-113-115 |
| FEAT-113 | Graceful fallback on provider error | P0 | planned | REQ-116 |
| FEAT-114 | API key security (backend config.json) | P0 | planned | REQ-117 |

## LESSONS LEARNED (PROJECT-SPECIFIC)

| # | Issue | Resolution | Prevention |
|---|-------|------------|------------|
| 1 | pyproject.toml missing wheel packages config | Added `[tool.hatch.build.targets.wheel] packages = ["app"]` | Always verify build config on new Python projects |
| 2 | Sub-agents shared CWD causing wrong-branch confusion | Explicit branch switch in agent prompts | Always specify branch in sub-agent context |
| 3 | Git unrelated histories merge (55+ add/add conflicts) | Force push after extracting needed files from remote | Use force push for initial repo setup, not merge |
| 4 | thebacons account denied push to BACON-AI-CLOUD | Use BACON-AI-CLOUD PAT from ~/.env | Always check which GitHub account has push access |
| 5 | PRD vs ADD conflicts (API key storage, default provider) | Resolved during gap analysis, docs updated | Run gap analysis between PRD and ADD before coding |

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
| 11 | API keys in backend config.json (not localStorage) | More secure, keys never touch browser | ADD-002 | 2026-02-16 |
| 12 | Ollama as default refiner provider | Works without API key, best first-run UX | PRD-002 | 2026-02-16 |
| 13 | Global hotkey deferred to v1.2 | v1.1 focused on text refinement, hotkey is separate concern | PLAN-VERSIONING-STRATEGY | 2026-02-16 |

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
│   ├── prd/                    # Project Requirements
│   ├── prd-features/           # Feature-level requirements
│   ├── urd/                    # User Requirements
│   ├── add/                    # Architecture Design
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
│   └── backend/                # Python+FastAPI+Whisper
├── tests/
│   ├── unit/
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
