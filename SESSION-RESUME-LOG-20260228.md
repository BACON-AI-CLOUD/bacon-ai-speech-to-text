# SESSION RESUME LOG — 2026-02-28
*Read this first when restarting work on bacon-ai-voice. This is the authoritative context handover for the next agent/session.*

---

## TL;DR — What You Need to Know in 30 Seconds

- **v1.5 is COMPLETE** — merged to main, 14/14 SIT + 15/15 UAT passed
- **v1.6 planning is COMPLETE** — branch and worktree exist, branding done, NO feature code written yet
- **Next task:** Start coding `FEAT-309` (history persistence) in `.worktrees/v1.6-ux-enhancements`
- **Your branch:** `feature/v1.6-ux-enhancements` (work in the worktree, NOT in main)
- **Bash CWD warning:** The previous session's Bash CWD was stuck on a deleted path. Start fresh — always `cd` to the worktree first

---

## Project Identity

| Field | Value |
|-------|-------|
| Project | bacon-ai-voice (rebranded: **BACON-AI Voice Pro**) |
| Location | `/mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice` |
| Stack | React+Vite+TS frontend, Python+FastAPI backend, Faster-Whisper |
| Owner | Colin Bacon |
| Role | You are the **BACON-AI Project Orchestrator** — plan, delegate, verify. Do NOT write production code directly. |

---

## Git State (as of 2026-02-28)

```
Worktree layout:
  /mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice          → main (ae97f56) ← STABLE, DO NOT TOUCH
  /mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice/.worktrees/v1.6-ux-enhancements
                                                                 → feature/v1.6-ux-enhancements (18873a0) ← WORK HERE

Remotes:
  bacon-cloud     → https://github.com/BACON-AI-CLOUD/bacon-ai-speech-to-text.git (public community edition)
  bacon-voice     → https://github.com/BACON-AI-CLOUD/bacon-ai-voice.git (private)
  bacon-voice-pro → https://github.com/BACON-AI-CLOUD/bacon-ai-voice-pro.git (private PRO)
  thebacons       → https://github.com/thebacons/bacon-ai-voice.git (private personal copy)

GitHub auth: gh CLI authenticated as 'thebacons' (repo scope)
PAT for BACON-AI-CLOUD: stored in git remote URLs (NOT in tracked files — safe)
```

### Key Branch Commits
| Commit | Branch | Description |
|--------|--------|-------------|
| `ae97f56` | main | v1.5 merge — stable production baseline |
| `eb29c9b` | feature/v1.6 | CLAUDE.md v1.6 planning update |
| `61db6b4` | feature/v1.6 | PRO README branding + SVG logo |
| `18873a0` | feature/v1.6 | Use Cases + BPMN diagrams (latest) |

---

## What Was Done This Session

### v1.5 UAT Bug Fixes (all merged to main)
1. **`keyboard.py`** — PowerShell `-NoProfile` + UTF-8 encoding fix → `/windows` now returns live windows
2. **`refiner_api.py`** — Force-enable refiner for explicit `/process` calls → Text Editor Refine works
3. **`TextEditorPanel.tsx`** — AbortController 120s timeout + full output settings in Type button
4. **`refiner/refiner.py`** — XML tag wrapping prevents prompt injection attacks
5. SIT + UAT run via antigravity browser tools — all passed

### PRO Branding (on feature/v1.6-ux-enhancements)
1. Full README rewrite with 7 mermaid architecture diagrams
2. SVG logo (`docs/assets/bacon-ai-voice-pro-logo.svg`)
3. "Use Cases, Benefits & Features" section — 4-column table (benefit-led)
4. 5 BPMN v2.0 use-case diagrams (Developer, Creator, Legal/Medical, Video, Business)
5. `bacon-ai-voice-pro` private repo created on BACON-AI-CLOUD
6. `bacon-ai-speech-to-text` updated with "Coming Soon" teasers (no IP revealed)
7. `bacon-ai-voice` personal repo created on thebacons account

### Repo Cleanup
- Main project dir switched back to `main` (was accidentally on feature branch)
- Old stale Claude worktree removed
- New clean worktree created at `.worktrees/v1.6-ux-enhancements`

---

## Immediate Next Steps (in order)

### 1. Read these docs first
```
CLAUDE.md                                              ← project rules, always read first
docs/plans/PLAN-V1.6-UX-ENHANCEMENTS-20260228.md      ← v1.6 implementation plan
docs/plans/LATEST-STATUS-REPORT-20260228.md            ← full status overview
docs/prd/PRD-003-v1.3-ux-enhancements.md              ← requirements
```

### 2. Verify worktree is healthy
```bash
cd /mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice
git worktree list
cd .worktrees/v1.6-ux-enhancements
git log --oneline -3
git status
```

### 3. Run test suite baseline (before any v1.6 code)
```bash
# Backend
cd src/backend && uv run pytest tests/ -v 2>&1 | tail -5
# Expected: 103 passed

# Frontend
cd src/frontend && npm test 2>&1 | tail -5
# Expected: 83 passed
```

### 4. Start coding FEAT-309 (History Persistence)
See `docs/plans/PLAN-V1.6-UX-ENHANCEMENTS-20260228.md` for detailed spec.

Files to create/edit:
- `src/frontend/src/hooks/useHistory.ts` (CREATE)
- `src/frontend/src/components/HistorySidebar.tsx` (EDIT)
- `src/frontend/src/types/index.ts` (EDIT)

---

## Architecture Quick Reference

| Component | Command | URL |
|-----------|---------|-----|
| Start both | `bash start-dev.sh` | — |
| Frontend | `cd src/frontend && npm run dev` | http://localhost:5002 |
| Backend | `cd src/backend && uv run uvicorn app.main:app --port 8702 --reload` | http://localhost:8702 |
| Run backend tests | `cd src/backend && uv run pytest tests/ -v` | — |
| Run frontend tests | `cd src/frontend && npm test` | — |
| Ollama (Windows host) | — | http://172.24.144.1:11434 |

---

## Critical Rules (from CLAUDE.md)

1. **NEVER commit to `main` directly** — all work on `feature/v1.6-ux-enhancements`
2. **NEVER claim success without evidence** — tests must pass, screenshots required
3. **Always run full test suite before any PR/merge**
4. **Anti-hallucination:** Read files before referencing them
5. **Human checkpoints:** Pause before merging to main — Colin must approve
6. **Sub-agents:** Spawn for parallel work; always pass branch + worktree context

---

## Provider / API Key Reference

| Provider | Key location | Notes |
|----------|-------------|-------|
| Ollama | No key needed | WSL auto-detects Windows host at `172.24.144.1:11434` |
| Groq | `~/.config/bacon-ai-voice/.env` → `GROQ_API_KEY` | Cloud, ~200ms |
| OpenAI | `~/.config/bacon-ai-voice/.env` → `OPENAI_API_KEY` | Cloud |
| Anthropic | `~/.config/bacon-ai-voice/.env` → `ANTHROPIC_API_KEY` | Cloud |
| Gemini | `~/.config/bacon-ai-voice/.env` → `GEMINI_API_KEY` | Cloud |
| BACON-AI-CLOUD PAT | In git remote URLs (not tracked files) | For pushing to BACON-AI-CLOUD |

---

## Lessons Learned (This Session)

| # | Issue | Resolution |
|---|-------|------------|
| 1 | PowerShell takes ~5s to start in WSL2 without -NoProfile | Add -NoProfile to all PS calls in keyboard.py |
| 2 | Windows PS output can be non-UTF8 (byte 0xfa) | Use capture_output=True, decode manually with errors='replace' |
| 3 | Main project dir was on feature branch, not main | Always check `git branch --show-current` at session start |
| 4 | Session Bash CWD stuck on deleted worktree path | Use Task subagent for git commands when CWD is broken |
| 5 | `gh` CLI is thebacons, but BACON-AI-CLOUD needs PAT | Use PAT from git remote URL for BACON-AI-CLOUD operations |
| 6 | GitHub user account API is `/user/repos` not `/orgs/{org}/repos` | BACON-AI-CLOUD is a user account, not an org |

---

## Key File Locations

```
docs/plans/PLAN-V1.6-UX-ENHANCEMENTS-20260228.md   ← v1.6 implementation plan
docs/plans/LATEST-STATUS-REPORT-20260228.md          ← this session's status report
docs/prd/PRD-003-v1.3-ux-enhancements.md            ← v1.6 requirements
docs/prd/PRD-001-bacon-ai-voice.md                  ← v1.0 requirements
docs/prd/PRD-002-v1.1-text-refinement.md            ← v1.1 requirements
docs/add/ADD-001-architecture.md                     ← architecture design
docs/test-strategy/TEST-STRATEGY-001.md             ← test strategy
progress/testing/sit-v1.5/SIT-CLOSURE-MEMO-v1.5-2026-02-25.md  ← v1.5 SIT evidence
progress/testing/sit-v1.5/UAT-CLOSURE-MEMO-v1.5-2026-02-26.md  ← v1.5 UAT evidence
README.md (on feature branch)                        ← PRO branding README
docs/assets/bacon-ai-voice-pro-logo.svg             ← PRO logo
CLAUDE.md                                           ← project directive (always read first)
```

---

*Generated by: Claude Sonnet 4.6 | Session: 2026-02-28*
*Next review: After FEAT-309 implementation*
