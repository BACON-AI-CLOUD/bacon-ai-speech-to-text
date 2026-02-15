# Phase D Plan: Polish Features (FEAT-009 through FEAT-014)

**Branch:** `feature/FEAT-009-014-polish` from `develop`
**Date:** 2026-02-12
**Complexity:** STANDARD (each feature is independent, well-defined)
**Estimated Tests:** 30-40 new tests

---

## Feature Breakdown

### FEAT-009: Clipboard Copy + Browser Notifications
**Priority:** P2 (Nice-to-have enhancements)
**Files:** `TranscriptionDisplay.tsx`, `App.tsx`, `types/index.ts`

TranscriptionDisplay already has a "Copy to Clipboard" button. Enhancements:
1. **Browser Notification** on new transcription (Notification API)
   - Request permission on first use
   - Show notification with transcribed text preview
   - Configurable in settings (on/off)
2. **Auto-copy option** - automatically copy transcription to clipboard
   - Toggle in settings
3. Add `notificationsEnabled` and `autoCopy` fields to `AppSettings`

### FEAT-010: Hotkey Configuration UI (Visual Key Capture)
**Priority:** P1 (Improves push-to-talk UX)
**Files:** `SettingsPanel.tsx`, `types/index.ts`

Replace the plain text input for hotkey with a visual key capture widget:
1. "Press a key" dialog/button that listens for keydown
2. Displays captured key name in readable format (reuse `formatKeyName()` from AudioCapture)
3. Shows current binding clearly
4. Cancel/reset to default

### FEAT-011: Model Download Progress Indicator
**Priority:** P0 (Critical for first-time users)
**Files:** `App.tsx` or new `ModelProgress.tsx`, `useWebSocket.ts`

Backend already sends `downloading` and `download_progress` in model info.
1. Poll `/models` endpoint during model load/switch
2. Show progress bar in UI (percentage + model name)
3. Show estimated download size
4. Overlay or status bar indicator

### FEAT-012: Settings Persistence Enhancements
**Priority:** P1 (Import/Export)
**Files:** `useSettings.ts`, `SettingsPanel.tsx`

1. **Export Settings** - download settings as JSON file
2. **Import Settings** - upload JSON file to restore settings
3. Settings validation on import (reject invalid keys/values)

### FEAT-013: Error Handling UX Improvements
**Priority:** P0 (Better user experience)
**Files:** `ErrorDisplay.tsx`, `StatusBar.tsx`, `App.tsx`

1. **Retry button** on error toasts (re-trigger last action)
2. **Error categories** with icons:
   - Connection errors (backend down)
   - Permission errors (mic denied)
   - Transcription errors (model failure)
3. **Graceful degradation** message in StatusBar when disconnected
4. **Auto-reconnect indicator** showing countdown/attempt number

### FEAT-014: Startup Scripts
**Priority:** P1 (Developer/user convenience)
**Files:** New `start.sh`, `start.bat`, `start-dev.sh`, `start-dev.bat`

1. `start.sh` / `start.bat` - Production-like startup (both services)
2. `start-dev.sh` / `start-dev.bat` - Dev mode with hot-reload
3. Pre-flight checks:
   - Python/Node version verification
   - Port availability check
   - uv/npm availability
4. Graceful shutdown (trap signals, kill both processes)
5. Colored console output with service labels

---

## Implementation Order

1. FEAT-014 (startup scripts) - no code dependencies, independent
2. FEAT-010 (hotkey UI) - small, focused change
3. FEAT-009 (clipboard/notifications) - small frontend additions
4. FEAT-012 (settings import/export) - extends useSettings
5. FEAT-011 (model progress) - may need frontend polling hook
6. FEAT-013 (error handling) - touches multiple components, do last

---

## Test Strategy

| Feature | Test Type | Target Count |
|---------|-----------|-------------|
| FEAT-009 | FUT: notification/copy behaviors | 4-6 |
| FEAT-010 | FUT: key capture, display, cancel | 4-6 |
| FEAT-011 | FUT: progress bar render, polling | 3-5 |
| FEAT-012 | TUT: import/export/validation | 5-7 |
| FEAT-013 | FUT: retry, categories, indicators | 5-7 |
| FEAT-014 | TUT: script syntax check (bash -n) | 2-4 |
| **Total** | | **23-35** |

---

## Quality Gate

- All 95 existing tests must continue to pass (regression)
- New tests must pass
- No TypeScript errors (`tsc --noEmit`)
- Scripts must pass `bash -n` syntax check
