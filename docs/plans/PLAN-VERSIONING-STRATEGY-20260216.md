# Plan: Versioning & Development Strategy (SUPERSEDES PLAN-THREE-VERSION-SPLIT)

**Date**: 2026-02-16
**Author**: Orchestrator Agent (Opus 4.6)
**Status**: APPROVED
**Supersedes**: PLAN-THREE-VERSION-SPLIT-20260215.md

---

## Decision: Git Branching over Separate Directories

### What Was Proposed (2026-02-15)
Split bacon-ai-voice into 3 separate project directories:
- `bacon-ai-voice-v1/` (Simple - current webapp)
- `bacon-ai-voice-v2/` (Advanced - daemon + wake word)
- `bacon-ai-voice-v3/` (Professional - AI text refiner)

### What Was Decided (2026-02-16)
**Use git branches within the single `bacon-ai-voice` project**, with `v0-backup/` as a nuclear safety net.

### Rationale
- Git branches avoid duplicating ~50MB+ per version
- Full diff/merge tooling for tracking changes
- Single codebase with incremental feature additions
- v0-backup directory provides instant reset if git gets messy
- Feature branches isolate experimental work from stable code

---

## Branch Strategy

```
main (stable releases, pushed to BACON-AI-CLOUD)
  └── develop (integration branch)
        ├── feature/v1.1-text-refinement
        ├── feature/v1.2-tts
        ├── feature/v1.3-mcp-integration
        ├── feature/v1.4-multi-language
        └── feature/v1.5-wake-word-daemon
```

### Safety Net
- **v0-backup/**: Directory copy of working v1.0 code (backend + frontend key files)
- **main branch**: Always stable, always deployable
- **develop branch**: Integration testing before merging to main

### Workflow Per Feature
1. Create `feature/v1.X-*` branch from `develop`
2. Implement and test on feature branch
3. If it works → merge to `develop` → test → merge to `main`
4. If it breaks badly → `git checkout develop` (instant reset to last stable)
5. If git gets messy → restore from `v0-backup/`
6. Push `main` to BACON-AI-CLOUD using BACON-AI-CLOUD PAT (see infrastructure-admin skill)

---

## Roadmap Mapping (Old v1/v2/v3 → New v1.X)

The old 3-directory plan's features are remapped to incremental versions:

| Old Plan | New Version | Feature | Status |
|----------|-------------|---------|--------|
| v1 (Simple) | **v1.0** | Core STT webapp, 3 activation modes, keyboard typing, global hotkey, mini mode, REST API toggle, silence auto-stop | **DONE** - on main |
| v3 (Professional) | **v1.1** | AI Text Refinement - clean up transcriptions via Groq/Ollama/Gemini | Next up |
| (new) | **v1.2** | Text-to-Speech (TTS) - hear AI responses (Edge TTS integration) | Planned |
| (new) | **v1.3** | MCP Server Integration - native Claude Code voice input tool | Planned |
| (new) | **v1.4** | Multi-Language - 99+ languages via Whisper multilingual | Planned |
| v2 (Advanced) | **v1.5** | Custom Wake Word + Python Daemon ("Hey BACON!") | Planned |
| v2 (Advanced) | **v2.0** | Real-Time Streaming - live transcription with partial results | Planned |

### Why Reordered?
- **v1.1 (Text Refinement)** moved up because it directly improves the core STT experience
- **v1.5 (Wake Word/Daemon)** moved down because v1.0 already has global hotkey (F2) for hands-free activation
- Keyboard emulation from old v2 is already implemented in v1.0

---

## v1.1 AI Text Refinement - Implementation Plan

### Branch: `feature/v1.1-text-refinement`

### Scope (from old v3 plan, adapted for single-repo approach)

**New Backend Files:**
```
src/backend/app/refiner/
├── __init__.py
├── refiner.py              # Pipeline: raw text → AI cleanup → cleaned text
├── prompts.py              # System prompts for speech cleanup
└── providers/
    ├── __init__.py
    ├── base.py             # Abstract: async def refine(text: str) -> str
    ├── groq_provider.py    # Groq API (llama-3.3-70b-versatile, ~200ms)
    ├── ollama_provider.py  # Local Ollama (any model)
    └── gemini_provider.py  # Google Gemini Flash

src/backend/app/refiner_api.py  # Routes: POST /refiner/process, GET /refiner/config
```

**New Frontend Files:**
```
src/frontend/src/components/RefinerSettings.tsx   # Provider dropdown, API key, toggle
src/frontend/src/components/RefinerSettings.css
src/frontend/src/components/TextComparison.tsx    # Raw vs refined side-by-side
src/frontend/src/components/TextComparison.css
```

**Modified Files:**
- `src/frontend/src/types/index.ts` - Add RefinerSettings type
- `src/frontend/src/hooks/useSettings.ts` - Add refiner defaults
- `src/frontend/src/App.tsx` - Wire refiner into transcription flow
- `src/backend/app/main.py` - Mount refiner_api router
- `src/backend/pyproject.toml` - Add dep: `httpx>=0.27`

### Key Details
- **Default prompt**: Remove filler words (um, uh, ah), false starts, repetitions
- **Providers**: Groq (fastest cloud ~200ms), Ollama (local, free), Gemini (cloud alt)
- **UX**: Toggle on/off, TextComparison shows raw vs refined, user picks which to use
- **Latency target**: < 500ms for refiner step

---

## BACON-AI-CLOUD Push Instructions

**Repository**: https://github.com/BACON-AI-CLOUD/bacon-ai-speech-to-text
**Account**: BACON-AI-CLOUD (NOT thebacons - thebacons doesn't have push access)
**PAT Location**: `~/.env` → `BACON_AI_CLOUD_GITHUB_PAT` (also on ZBook `~/.env`)

```bash
# Push to BACON-AI-CLOUD
source /mnt/c/Users/colin/.env
git remote set-url bacon-cloud https://BACON-AI-CLOUD:${BACON_AI_CLOUD_GITHUB_PAT}@github.com/BACON-AI-CLOUD/bacon-ai-speech-to-text.git
git push bacon-cloud main
# Clean token from URL after push:
git remote set-url bacon-cloud https://github.com/BACON-AI-CLOUD/bacon-ai-speech-to-text.git
```

---

## Recovery Protocol (Read After Context Loss)

1. Read this plan → understand versioning strategy
2. Check `git branch` → know where you are
3. Check `git log --oneline -10` → see recent work
4. v0-backup/ exists as nuclear fallback
5. BACON-AI-CLOUD PAT is in `~/.env` → `BACON_AI_CLOUD_GITHUB_PAT`
6. Never push with thebacons account to BACON-AI-CLOUD repos
7. Follow ai-coding-orchestrator skill: plan → delegate → verify → report
