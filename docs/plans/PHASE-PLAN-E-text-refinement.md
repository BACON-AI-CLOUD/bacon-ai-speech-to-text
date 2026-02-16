# Phase Plan E: AI Text Refinement (v1.1)

**Date:** 2026-02-16
**Branch:** `feature/v1.1-text-refinement`
**PRD:** PRD-002-v1.1-text-refinement.md
**Architecture:** ADD-002-v1.1-text-refinement.md
**Test Strategy:** TEST-STRATEGY-002-v1.1-text-refinement.md
**Status:** PLANNED

---

## Overview

Phase E adds an AI text refinement pipeline to clean up raw Whisper transcriptions. Three LLM providers (Groq, Ollama, Gemini) process raw text to remove filler words, fix grammar, and restructure rambling speech while preserving intent.

## Prerequisites

- [x] v1.0 complete and merged to main (110 tests passing)
- [x] `feature/v1.1-text-refinement` branch created from develop
- [x] PRD-002 approved (19 requirements)
- [x] ADD-002 approved (13 new files, 8 modified)
- [x] TEST-STRATEGY-002 approved (31 new tests)
- [ ] Human checkpoint: Pre-Implementation approval

## Implementation Steps

### Step 1: Backend Refiner Module (Sub-Agent: backend-coder)

**Goal:** Create the refiner package with provider abstraction and pipeline.

**Files to create:**
```
src/backend/app/refiner/
├── __init__.py           # Exports get_refiner() singleton
├── refiner.py            # Main pipeline (Refiner class)
├── prompts.py            # DEFAULT_REFINE_PROMPT + helpers
└── providers/
    ├── __init__.py       # Provider registry
    ├── base.py           # BaseRefinerProvider ABC + RefinerResult dataclass
    ├── groq_provider.py  # GroqRefinerProvider (httpx -> api.groq.com)
    ├── ollama_provider.py # OllamaRefinerProvider (httpx -> localhost:11434)
    └── gemini_provider.py # GeminiRefinerProvider (httpx -> generativelanguage.googleapis.com)
```

**Files to modify:**
- `src/backend/pyproject.toml` - Move `httpx>=0.27` from dev to main dependencies

**Key design decisions:**
- Follow `IntegrationBackend` Protocol pattern from `integrations/base.py`
- Lazy-init httpx clients (same pattern as integration router)
- API keys loaded from config.json (NOT from frontend requests)
- Default provider: Ollama (works without API key)
- Timeout: 5 seconds, graceful fallback to raw text

**Gate:** All provider classes instantiate, refiner pipeline processes text with mock providers.

### Step 2: Backend API Routes (Sub-Agent: backend-coder)

**Goal:** Create FastAPI routes for refiner endpoints.

**Files to create:**
```
src/backend/app/refiner_api.py  # FastAPI router with 4 endpoints
```

**Files to modify:**
- `src/backend/app/main.py` - Mount refiner router: `app.include_router(refiner_router, prefix="/refiner")`
- `src/backend/app/config.py` - Add refiner config loading from config.json

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | /refiner/process | Refine raw text through active provider |
| GET | /refiner/config | Get current config + provider status |
| PUT | /refiner/config | Update config (enable/disable, provider, API keys, prompt, timeout) |
| POST | /refiner/test | Test refiner with sample text |

**Gate:** All 4 endpoints respond correctly via curl. Config persists across restarts.

### Step 3: Backend Tests (Sub-Agent: backend-coder)

**Goal:** Write unit tests for refiner module.

**Files to create:**
```
tests/unit/backend/
├── test_refiner.py           # 5 tests - Pipeline logic
├── test_refiner_providers.py # 9 tests - Provider mocks (httpx.MockTransport)
└── test_refiner_api.py       # 5 tests - Endpoint validation
```

**Test count:** 19 new backend tests
**Gate:** `cd src/backend && uv run pytest -v` → 71 tests pass (52 existing + 19 new), 0 failures.

### Step 4: Frontend Types + Settings Hook (Sub-Agent: frontend-coder)

**Goal:** Add refiner types and defaults to frontend settings.

**Files to modify:**
- `src/frontend/src/types/index.ts` - Add `RefinerConfig` interface, extend `AppSettings`, add `RefinerResult` type
- `src/frontend/src/hooks/useSettings.ts` - Add refiner defaults to `DEFAULT_SETTINGS`

**Key detail:** RefinerConfig does NOT contain API keys (those are backend-side). Frontend stores: enabled, provider selection, custom prompt.

**Gate:** TypeScript compiles with no errors. useSettings hook returns refiner defaults.

### Step 5: Frontend Components (Sub-Agent: frontend-coder)

**Goal:** Create RefinerSettings and TextComparison UI components.

**Files to create:**
```
src/frontend/src/components/
├── RefinerSettings.tsx   # Toggle, provider dropdown, API key input, test button
├── RefinerSettings.css
├── TextComparison.tsx    # Raw vs refined side-by-side display
└── TextComparison.css
```

**RefinerSettings features:**
- Enable/disable toggle
- Provider dropdown (Groq/Ollama/Gemini) with status indicators
- API key input for cloud providers (sends to PUT /refiner/config)
- Ollama model selection (REQ-119)
- Custom prompt textarea
- Test button (calls POST /refiner/test)

**TextComparison features:**
- Side-by-side raw (left) vs refined (right) panels
- "Use Raw" / "Use Refined" buttons
- Copy to clipboard
- Processing time display
- Error state with fallback to raw text

**Gate:** Components render without errors. Provider selection works.

### Step 6: Frontend Integration (Sub-Agent: frontend-coder)

**Goal:** Wire refiner into existing transcription flow.

**Files to modify:**
- `src/frontend/src/App.tsx` - Add refiner effect after `lastResult`, call POST /refiner/process
- `src/frontend/src/components/TranscriptionDisplay.tsx` - Render TextComparison when refiner active, use refined text for keyboard typing
- `src/frontend/src/components/SettingsPanel.tsx` - Add RefinerSettings section

**Flow when refiner enabled:**
1. Whisper returns raw text via WebSocket
2. App.tsx receives `lastResult`
3. If refiner enabled: POST /refiner/process with raw text
4. Show "Refining..." spinner
5. On success: TextComparison shows raw vs refined
6. Keyboard typing uses refined text

**Gate:** Full flow works: speak → transcribe → refine → display comparison → type refined text.

### Step 7: Frontend Tests (Sub-Agent: frontend-coder)

**Goal:** Write unit tests for new components.

**Files to create:**
```
src/frontend/src/components/__tests__/
├── RefinerSettings.test.tsx  # 6 tests
└── TextComparison.test.tsx   # 6 tests
```

**Test count:** 12 new frontend tests
**Gate:** `cd src/frontend && npx vitest run` → 70 tests pass (58 existing + 12 new), 0 failures.

### Step 8: Integration Testing (Orchestrator)

**Goal:** Verify full end-to-end flow and regression.

**Tests:**
- SIT-R001: Full refiner flow (transcription → refiner → display)
- SIT-R002: Refiner off flow (no /refiner calls made)
- SIT-R003: Error fallback (bad API key → raw text displayed)
- SIT-R004: Provider switch mid-session
- SIT-R005: v1.0 regression (all existing features work)

**Gate:** All 141 tests pass (110 v1.0 + 31 v1.1). Browser testing screenshots captured.

---

## Agent Assignment Strategy

| Step | Agent | Type | Parallel? |
|------|-------|------|-----------|
| 1-3 | backend-coder | general-purpose | Yes (with 4-5) |
| 4-7 | frontend-coder | general-purpose | Yes (with 1-3) |
| 8 | orchestrator | verification | After 1-7 complete |

Steps 1-3 (backend) and 4-7 (frontend) can run in parallel since they don't share files. Step 8 runs after both complete.

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| httpx async issues in FastAPI | Test with `pytest-asyncio`, mock transport pattern |
| Ollama not available on dev machine | All unit tests use mocks, manual FUT uses Groq |
| API key leakage | Code review check: keys never in logs, never in GET responses |
| Refiner blocks transcription | 5s timeout + graceful fallback, non-blocking design |
| Config.json merge conflicts | Refiner config is a new top-level key, no conflicts with existing |

---

## Completion Criteria

- [ ] 19 new backend tests passing
- [ ] 12 new frontend tests passing
- [ ] All 110 existing tests still passing (regression)
- [ ] Browser testing: refiner toggle, provider switch, comparison view
- [ ] curl test: all 4 refiner endpoints respond correctly
- [ ] Config persistence: settings survive backend restart
- [ ] Graceful fallback: invalid API key → raw text displayed
- [ ] Commit to feature branch with evidence
- [ ] Human checkpoint: Pre-merge review

---

*Phase Plan E follows PHASE-PLAN-{A,B,C,D} format for consistency.*
*Ready for Pre-Implementation human checkpoint.*
