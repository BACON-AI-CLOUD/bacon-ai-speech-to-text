# Plan: v1.6 — UX Enhancements
*BACON-AI Voice Pro | Updated: 2026-02-28 | Orchestrator Plan*

---

## Status
| Field | Value |
|-------|-------|
| **Phase** | v1.6 — Planning complete, implementation not yet started |
| **Branch** | `feature/v1.6-ux-enhancements` |
| **Worktree** | `.worktrees/v1.6-ux-enhancements` |
| **Base commit** | `eb29c9b` (CLAUDE.md v1.6 planning advance) |
| **Latest commit** | `18873a0` (PRO branding README + BPMN diagrams) |
| **PRD Reference** | `docs/prd/PRD-003-v1.3-ux-enhancements.md` |
| **Test Strategy** | `docs/test-strategy/TEST-STRATEGY-001.md` |

---

## Context

v1.5 delivered document/text processing (Text Editor tab, YouTube/URL transcription, PDF/DOCX extraction, editable results, Markdown template). All 14 SIT + 15 UAT tests passed. Merged to main 2026-02-26.

v1.6 picks up the remaining PRD-003 features that were deferred from v1.3:
- Chat tab (full chatbot UI)
- Dictation mode (pause/resume, canvas sessions)
- History persistence + project grouping
- MCP server for text refinement
- Wake word trigger ("Hey Colin")

Additionally, during this planning phase, the project was rebranded as **BACON-AI Voice Pro** with a complete marketing README, SVG logo, 5 use-case BPMN diagrams, and benefit-led documentation.

---

## Feature IDs

| ID | Title | Priority | PRD Ref | Status |
|----|-------|----------|---------|--------|
| FEAT-304 | Chat tab (chatbot UI + voice/text input) | P0 | REQ-304-306 | planned |
| FEAT-305 | Dictation mode (pause/resume, canvas sessions) | P0 | REQ-307-310 | planned |
| FEAT-309 | History persistence + project grouping | P0 | REQ-317-320 | planned |
| FEAT-306 | MCP server for text refinement | P1 | REQ-311-312 | planned |
| FEAT-307 | Wake word trigger ("Hey Colin") | P2 | REQ-313-314 | planned |

*Note: FEAT-301 (Quick Controls sidebar), FEAT-302 (Output Controls), FEAT-303 (Audio beeps), FEAT-308 (Mini-button) were completed in earlier versions.*

---

## FEAT-304: Chat Tab

### Overview
A dedicated third (now fourth) tab alongside Live / File / Text providing a persistent chatbot interface. Users can type or dictate messages, view conversation history, and get responses from any configured AI provider.

### UI Layout
```
┌─ Chat ────────────────────────────────────────────────────┐
│  ┌─ Conversation ──────────────────────────────────────┐  │
│  │ 🤖 Elisabeth: How can I help?                       │  │
│  │ 👤 You: Can you summarise this document?            │  │
│  │ 🤖 Elisabeth: Sure, here is the summary...         │  │
│  └────────────────────────────────────────────────────┘  │
│  [🎙️ Voice input] [Type message...] [Send]              │
│  Provider: [Ollama ▼]  Model: [llama3 ▼]                │
└───────────────────────────────────────────────────────────┘
```

### Implementation
**New component:** `src/frontend/src/components/ChatPanel.tsx`
**New styles:** `src/frontend/src/components/ChatPanel.css`

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const [messages, setMessages] = useState<ChatMessage[]>([]);
const [inputText, setInputText] = useState('');
const [isStreaming, setIsStreaming] = useState(false);
```

**Backend:** Reuse `POST /refiner/process` with `stream=true` parameter, or add `POST /chat/message` endpoint that wraps the existing provider infrastructure with full conversation history.

**Voice input:** Triggered via Push-to-talk within the Chat tab context — transcription auto-populates the input field.

**App.tsx changes:** Add `'chat'` to `activeTab` union type, render `<ChatPanel>` for `activeTab === 'chat'`.

---

## FEAT-305: Dictation Mode

### Overview
A continuous recording mode for long-form dictation. User can pause and resume without losing context. Each "canvas session" is a named document that accumulates text over multiple recording chunks.

### UI Layout
```
┌─ Dictation Mode ───────────────────────────────────────────┐
│  Session: [Project Notes ▼]   [+ New Session]             │
│  ─────────────────────────────────────────────────────── │
│  [▶ Start] / [⏸ Pause] / [⏹ End Session]                │
│  Recording: 02:34  |  Words so far: 342                   │
│  ─────────────────────────────────────────────────────── │
│  CANVAS ─────────────────────────────────────────────── │
│  [Accumulated text from all recording chunks,            │
│   editable, auto-appended on each stop]                  │
│  ─────────────────────────────────────────────────────── │
│  [Refine All]  [Copy All]  [Save]  [Clear]               │
└────────────────────────────────────────────────────────────┘
```

### Implementation
- New state: `dictationSession` (name, chunks[], totalText, duration)
- On each recording stop: append new transcription to canvas (with optional separator `---`)
- Refine All: send full canvas to refiner as single text block
- Sessions persist to localStorage under `dictation_sessions` key
- Sessions accessible from History Sidebar (new "Dictation" category)

---

## FEAT-309: History Persistence + Project Grouping

### Overview
Current history resets on page refresh. v1.6 persists all transcriptions with project metadata and allows grouping by project/date.

### Data Model
```typescript
interface HistoryItem {
  id: string;
  timestamp: number;
  rawText: string;
  refinedText?: string;
  tab: 'live' | 'file' | 'text' | 'chat' | 'dictation';
  project?: string;  // user-set project label
  template?: string;
  provider?: string;
  source?: string;   // filename, URL, or 'microphone'
}
```

### Storage
- `localStorage` key: `bacon_voice_history` (JSON array, max 500 items, LRU eviction)
- Export: `POST /history/export` → `.json` download
- Project labels: user-defined strings, managed in Settings

### HistorySidebar changes
- Group by: Date / Project / Tab type
- Search bar (filter by text content)
- Click to restore: loads item back into appropriate tab
- "Export History" button

---

## FEAT-306: MCP Server for Text Refinement

### Overview
Expose BACON-AI Voice Pro's refiner as a native MCP tool so Claude Code can invoke it directly — without the browser UI.

### MCP Tool Definition
```json
{
  "name": "refine_text",
  "description": "Clean up and reformat text using BACON-AI's AI refiner pipeline",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "Raw text to refine" },
      "template": { "type": "string", "description": "Template name (speech-cleanup, technical-docs, email, etc.)" },
      "provider": { "type": "string", "description": "AI provider (ollama, groq, openai, etc.)" }
    },
    "required": ["text"]
  }
}
```

### Implementation
- New file: `src/backend/app/mcp_server.py` — FastMCP server exposing `refine_text` tool
- Startup: `uv run python -m app.mcp_server` (separate process, stdio transport)
- Claude Code config (`.mcp.json`):
```json
{
  "mcpServers": {
    "bacon-voice": {
      "command": "uv",
      "args": ["run", "python", "-m", "app.mcp_server"],
      "cwd": "/path/to/bacon-ai-voice/src/backend"
    }
  }
}
```

---

## FEAT-307: Wake Word ("Hey Colin")

### Overview
Continuously listen for a configurable wake word. On detection, trigger recording automatically — fully hands-free.

### Implementation Options (in priority order)
1. **Porcupine** (Picovoice) — free tier, accurate, no cloud
2. **Vosk** small model — open source, offline, ~50MB
3. **OpenWakeWord** — pure Python, free, decent accuracy

### Frontend
- New toggle in Settings: "Wake Word" on/off
- Text input: custom wake word (default: "Hey Colin")
- Sensitivity slider
- Status indicator: "Listening for wake word..."

### Backend
- New endpoint: `POST /wake-word/config` + `GET /wake-word/status`
- Background task runs continuously when enabled
- Fires `POST /recording/toggle` internally when wake word detected
- Browser notified via WebSocket event `{type: 'wake_word_detected'}`

---

## Implementation Order

1. **FEAT-309** — History persistence (pure frontend, highest ROI, enables all other features to benefit from history)
2. **FEAT-304** — Chat tab (reuses existing provider infrastructure, clear scope)
3. **FEAT-305** — Dictation mode (builds on FEAT-309 sessions + Live tab patterns)
4. **FEAT-306** — MCP server (backend only, reuses refiner pipeline)
5. **FEAT-307** — Wake word (most complex, new dependency, optional)

---

## Files to Create / Modify

| File | Action | Feature |
|------|--------|---------|
| `src/frontend/src/App.tsx` | EDIT — add 'chat' tab | FEAT-304 |
| `src/frontend/src/components/ChatPanel.tsx` | CREATE | FEAT-304 |
| `src/frontend/src/components/ChatPanel.css` | CREATE | FEAT-304 |
| `src/frontend/src/components/HistorySidebar.tsx` | EDIT — persistence + projects | FEAT-309 |
| `src/frontend/src/types/index.ts` | EDIT — HistoryItem type | FEAT-309 |
| `src/frontend/src/hooks/useHistory.ts` | CREATE — localStorage hook | FEAT-309 |
| `src/frontend/src/components/DictationPanel.tsx` | CREATE | FEAT-305 |
| `src/frontend/src/components/DictationPanel.css` | CREATE | FEAT-305 |
| `src/backend/app/mcp_server.py` | CREATE — FastMCP | FEAT-306 |
| `src/backend/app/wake_word.py` | CREATE — wake word listener | FEAT-307 |
| `src/backend/app/main.py` | EDIT — mount wake word routes | FEAT-307 |
| `src/backend/pyproject.toml` | EDIT — add fastmcp, porcupine/vosk | FEAT-306/307 |
| `CLAUDE.md` | EDIT — update status | Docs |

---

## Quality Gates

| Test | Evidence |
|------|----------|
| Chat tab: type message → AI responds → history item created | Screenshot |
| Chat tab: voice → transcribe → auto-populates input | Screenshot |
| Dictation: start → pause → resume → canvas accumulates | Screenshot |
| History: transcribe → refresh page → item still in sidebar | Screenshot |
| History: project label → filter by project works | Screenshot |
| MCP: `claude` CLI uses `refine_text` tool successfully | `claude` output log |
| Wake word: say "Hey Colin" → recording starts | Video/log |
| Existing 186 tests still pass | pytest + vitest output |

---

## PRO Branding Work (Completed 2026-02-26/27)

The following marketing/branding work was completed during this planning phase on `feature/v1.6-ux-enhancements`:

| Item | File | Status |
|------|------|--------|
| PRO README with 7 mermaid architecture diagrams | `README.md` | ✅ Done |
| SVG logo (BACON-AI Voice Pro) | `docs/assets/bacon-ai-voice-pro-logo.svg` | ✅ Done |
| Use Cases, Benefits & Features table (4 columns) | `README.md` (new section) | ✅ Done |
| 5 BPMN v2.0 use-case flow diagrams | `README.md` (new section) | ✅ Done |
| Private repo `bacon-ai-voice-pro` (BACON-AI-CLOUD) | GitHub | ✅ Done |
| Private repo `bacon-ai-voice` (BACON-AI-CLOUD) | GitHub | ✅ Done |
| Public teaser README on `bacon-ai-speech-to-text` | GitHub API | ✅ Done |
| Private repo `bacon-ai-voice` (thebacons) | GitHub | ✅ Done |

---

*Plan created: 2026-02-28*
*Previous plan: `/home/colin/.claude/plans/functional-exploring-ocean.md` (v1.5 — complete)*
*PRD reference: `docs/prd/PRD-003-v1.3-ux-enhancements.md`*
