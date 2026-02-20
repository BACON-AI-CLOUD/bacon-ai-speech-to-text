# Plan: UI Layout Redesign + Discuss Mode Conversation Context

## Context

Colin identified two UX issues during browser testing:

1. **Chat history is off-canvas** - The transcription history sits below the fold in a single-column centered layout (max-width 640px inside 800px app-main). Colin wants it moved to a left sidebar like Claude Desktop, so it's always visible.

2. **Elisabeth discuss mode has no conversation context** - Each message to `/discuss/chat` sends only the current transcription text. The backend builds a single `[system, user]` message array every time. No history is preserved, so Elisabeth can't reference previous turns.

**Current state:** Branch `feature/multi-version-ports`, 179 tests passing (103 backend, 76 frontend). Servers running on 8702/5002.

## Change 1: Left Sidebar Layout for History

### Current Layout
```
┌─────────────────────────────────┐
│ Header                          │
├─────────────────────────────────┤
│      ┌───────────────┐          │
│      │ Mic + Controls│          │
│      │ Current Result │          │
│      │ History (below)│  ← OFF SCREEN
│      └───────────────┘          │
├─────────────────────────────────┤
│ Footer                          │
└─────────────────────────────────┘
```

### Target Layout
```
┌─────────────────────────────────────────┐
│ Header                                  │
├──────────┬──────────────────────────────┤
│ History  │  Mic + Controls              │
│ sidebar  │  Current Transcription       │
│ (280px)  │  Discuss conversation        │
│ scrolls  │  Settings                    │
│ full ht  │                              │
├──────────┴──────────────────────────────┤
│ Footer                                  │
└─────────────────────────────────────────┘
```

### Files to modify

**`src/frontend/src/App.css`** - Change `.app-main` from single column to two-column layout:
```css
.app-main {
  display: flex;
  flex-direction: row;        /* was: column */
  flex: 1;
  padding: 0;                 /* remove padding, let children handle it */
  gap: 0;
}

.app-sidebar {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid #1e1e3a;
  overflow-y: auto;
  height: calc(100vh - 60px - 32px); /* viewport - header - footer */
  padding: 12px;
  background: #0d0d1a;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 16px;
  max-width: 800px;
  overflow-y: auto;
}
```

**`src/frontend/src/App.tsx`** - Wrap layout in sidebar + content structure:
- Extract history from `TranscriptionDisplay` into `App.tsx` sidebar
- Pass only current result + discuss conversation to `TranscriptionDisplay`
- OR: Split `TranscriptionDisplay` into two components: `HistorySidebar` and `CurrentTranscription`

**`src/frontend/src/components/TranscriptionDisplay.tsx`** - Remove history section from this component (move to sidebar)

**`src/frontend/src/components/TranscriptionDisplay.css`** - Remove `.transcription-history` styles, add to new sidebar styles

### Approach: Extract history into a new `HistorySidebar` component

Create `src/frontend/src/components/HistorySidebar.tsx`:
- Receives `history` array and callbacks (copy, edit, delete, download)
- Always visible, scrollable, full sidebar height
- Shows discuss conversation bubbles above history when in discuss mode

In `App.tsx`:
- Lift `history` state from `TranscriptionDisplay` up to `App`
- Pass `history` and discuss results to `HistorySidebar`
- Pass only current result to `TranscriptionDisplay` (simplified)

## Change 2: Discuss Mode Conversation Context

### Current Problem
- Frontend sends: `{ text: "current message" }`
- Backend builds: `[{role: "system", content: SYSTEM_PROMPT}, {role: "user", content: text}]`
- No history - Elisabeth has amnesia every turn

### Solution: Frontend tracks history, sends with each request

**`src/frontend/src/App.tsx`** - Add conversation state:
```typescript
const [discussHistory, setDiscussHistory] = useState<Array<{role: string, content: string}>>([]);

// In discuss effect: send history with request
body: JSON.stringify({
  text: lastResult.text,
  history: discussHistory,
  voice: settings.discussVoice,
})

// After response: append both user message and assistant response to history
setDiscussHistory(prev => [
  ...prev,
  { role: "user", content: lastResult.text },
  { role: "assistant", content: data.answer },
]);

// Reset history when discuss mode toggled off
useEffect(() => {
  if (!settings.discussMode) setDiscussHistory([]);
}, [settings.discussMode]);
```

**`src/backend/app/discuss.py`** - Accept and use history:
```python
class DiscussChatRequest(BaseModel):
    text: str
    history: list[dict] = []   # ADD: [{role, content}, ...]
    provider: Optional[str] = None
    voice: str = "en-GB-SoniaNeural"

# In discuss_chat():
messages = [{"role": "system", "content": DISCUSS_SYSTEM_PROMPT}]
messages.extend(request.history)            # Prior turns
messages.append({"role": "user", "content": request.text})  # Current turn

result = await provider.refine(
    request.text, DISCUSS_SYSTEM_PROMPT, timeout=15.0,
    messages=messages,  # Pass full history
)
```

**`src/backend/app/refiner/providers/base.py`** - Add optional `messages` param:
```python
@abstractmethod
async def refine(self, text: str, system_prompt: str, timeout: float = 5.0,
                 messages: list[dict] | None = None) -> RefinerResult:
```

**Provider implementations** (groq, ollama, gemini, anthropic, openai) - Use `messages` if provided:
```python
async def refine(self, text, system_prompt, timeout=5.0, messages=None):
    if messages:
        payload_messages = messages
    else:
        payload_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ]
    # ... rest uses payload_messages
```

All providers already build `[system, user]` message arrays internally, so this is a minimal change - just use the passed array instead of building a new one.

## Implementation Steps

### Step 1: Add `messages` param to provider interface + implementations
- `base.py`: Add optional `messages` param to `refine()` abstract method
- `groq_provider.py`, `ollama_provider.py`, `gemini_provider.py`, `anthropic_provider.py`, `openai_provider.py`: Use `messages` if provided, else build single-turn array (backwards compatible)

### Step 2: Update discuss backend for conversation history
- `discuss.py`: Add `history: list[dict] = []` to `DiscussChatRequest`
- Build full message array from system prompt + history + current message
- Pass `messages=` to `provider.refine()`

### Step 3: Add conversation state to frontend
- `App.tsx`: Add `discussHistory` state, send with requests, update after responses, reset on mode toggle

### Step 4: Create HistorySidebar component
- New file: `src/frontend/src/components/HistorySidebar.tsx` + `HistorySidebar.css`
- Move history rendering from `TranscriptionDisplay` to this component
- Include discuss conversation bubbles in sidebar

### Step 5: Restructure App layout
- `App.tsx`: Add sidebar wrapper, lift history state from TranscriptionDisplay
- `App.css`: Change `.app-main` to flex-row with sidebar + content areas
- `TranscriptionDisplay.tsx`: Remove history section (sidebar handles it)
- `TranscriptionDisplay.css`: Remove `.transcription-history` styles

### Step 6: Update tests
- Backend: Add tests for discuss with history, provider refine with messages param
- Frontend: Update TranscriptionDisplay tests (no more history), add HistorySidebar tests

## Files Summary

| File | Action | ~Lines Changed |
|------|--------|----------------|
| `src/backend/app/refiner/providers/base.py` | EDIT - add messages param | +2 |
| `src/backend/app/refiner/providers/groq_provider.py` | EDIT - use messages if provided | +5 |
| `src/backend/app/refiner/providers/ollama_provider.py` | EDIT - use messages if provided | +5 |
| `src/backend/app/refiner/providers/gemini_provider.py` | EDIT - use messages if provided | +5 |
| `src/backend/app/refiner/providers/anthropic_provider.py` | EDIT - use messages if provided | +5 |
| `src/backend/app/refiner/providers/openai_provider.py` | EDIT - use messages if provided | +5 |
| `src/backend/app/discuss.py` | EDIT - accept history, build message array | +15 |
| `src/frontend/src/App.tsx` | EDIT - sidebar layout, discuss history state | +40 |
| `src/frontend/src/App.css` | EDIT - two-column layout with sidebar | +30 |
| `src/frontend/src/components/HistorySidebar.tsx` | NEW - history + discuss sidebar | +120 |
| `src/frontend/src/components/HistorySidebar.css` | NEW - sidebar styles | +60 |
| `src/frontend/src/components/TranscriptionDisplay.tsx` | EDIT - remove history section | -80 |
| `src/frontend/src/components/TranscriptionDisplay.css` | EDIT - remove history styles | -30 |
| `tests/unit/backend/test_refiner_providers.py` | EDIT - test messages param | +20 |
| `tests/unit/backend/test_discuss.py` | NEW or EDIT - test history support | +30 |

**Total: ~12 files modified/created, ~250 net lines.**

## Verification

1. **Backend tests:** `cd src/backend && uv run pytest -v` - all existing + new tests pass
2. **Frontend tests:** `cd src/frontend && npx vitest run` - all existing + new tests pass
3. **Visual test - sidebar:** Open http://localhost:5002/, verify history appears in left sidebar, always visible
4. **Visual test - discuss context:** Enable "Chat with Elisabeth", say something, then say a follow-up referencing the first message. Verify Elisabeth's response acknowledges the prior context.
5. **Visual test - discuss reset:** Toggle discuss mode off then on, verify conversation starts fresh
6. **Responsive check:** Narrow the browser window, verify sidebar collapses or scrolls gracefully
