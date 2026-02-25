# TEST-STRATEGY-003: BACON-AI Voice v1.4 - File Transcription & Suffix Injections

| Field | Value |
|-------|-------|
| **Document ID** | TEST-STRATEGY-003 |
| **Version** | 1.4 |
| **Status** | Draft |
| **Date** | 2026-02-23 |
| **Scope** | FEAT-310 (File Transcription), FEAT-311 (Suffix Injections) |

---

## 1. Test Scope

This test strategy covers the two new features in v1.4:

- **FEAT-310**: File Transcription Panel (REQ-401 to REQ-408)
- **FEAT-311**: Suffix Injection Prompts (REQ-409 to REQ-413)

All 179 existing tests (103 backend + 76 frontend) must continue to pass as a regression gate.

---

## 2. Test Levels

### 2.1 TUT - Technical Unit Tests (Backend)

| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-B101 | file_transcribe.py | POST /transcribe/file/upload returns text + output_url | Response body with text, output_url, processing_time_ms |
| TUT-B102 | file_transcribe.py | POST /transcribe/file/path with valid local path returns transcription | Response body with text field |
| TUT-B103 | file_transcribe.py | POST /transcribe/file/path with invalid path returns 400/404 | Error response with message |
| TUT-B104 | file_transcribe.py | GET /transcribe/file/output/{filename} downloads valid .txt file | File content + Content-Type header |
| TUT-B105 | file_transcribe.py | SRT output has correct timestamp format (HH:MM:SS,mmm --> HH:MM:SS,mmm) | Output file content matches SRT spec |
| TUT-B106 | file_transcribe.py | VTT output starts with "WEBVTT" header and has correct timestamp format | Output file content matches VTT spec |
| TUT-B107 | file_transcribe.py | Refiner integration: refine=true returns refined_text alongside text | Response contains both text and refined_text |
| TUT-B108 | file_transcribe.py | Refiner integration: refine=false returns refined_text as null | Response has refined_text: null |
| TUT-B109 | file_transcribe.py | Language parameter passes through to Whisper (non-"auto" value) | Whisper called with language param |
| TUT-B110 | file_transcribe.py | Output file cleanup removes files older than 10 minutes | File deleted after TTL |
| TUT-B111 | main.py | GET /windows/active returns list of window titles | Response body is list of strings |
| TUT-B112 | main.py | POST /keyboard/set-target sets runtime target | GET /keyboard/target returns set value |
| TUT-B113 | main.py | POST /keyboard/type uses _runtime_target_window fallback | Keyboard types to correct window |

### 2.2 TUT - Technical Unit Tests (Frontend)

| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-F101 | FileTranscriptionPanel | Renders upload zone and path input | DOM snapshot |
| TUT-F102 | FileTranscriptionPanel | File drop triggers upload API call | Mock API called with FormData |
| TUT-F103 | FileTranscriptionPanel | Path submit triggers path API call | Mock API called with path |
| TUT-F104 | FileTranscriptionPanel | Progress indicator shows during transcription | Loading state visible |
| TUT-F105 | FileTranscriptionPanel | Download link appears after transcription | Link element with href |
| TUT-F106 | buildTextWithInjections | Appends enabled injections to text | Output matches expected |
| TUT-F107 | buildTextWithInjections | Skips disabled injections | Output has no disabled injection text |
| TUT-F108 | buildTextWithInjections | Respects context flag (live/file/keyboard) | Correct filtering per context |
| TUT-F109 | QCS Inject Tab | Toggle injection persists after page reload | localStorage contains updated value |
| TUT-F110 | QCS Inject Tab | Add custom injection creates new entry | New injection appears in list |
| TUT-F111 | QCS Inject Tab | Delete custom injection removes entry | Injection no longer in list |
| TUT-F112 | QCS Inject Tab | Built-in injections cannot be deleted | Delete button not shown for built-in |

### 2.3 FUT - Functional Unit Tests

| Test ID | Feature | What | Evidence |
|---------|---------|------|----------|
| FUT-401 | File Upload | Drag-drop audio file triggers transcription | Screenshot: file accepted, progress shown |
| FUT-402 | File Path | Enter local path, click Go, transcription appears | Screenshot: text output |
| FUT-403 | Download | Click download button, file saves | Screenshot: file downloaded |
| FUT-404 | SRT Output | Select .srt format, transcribe, verify subtitle format | Screenshot: SRT content |
| FUT-405 | Refiner Pass | Check "Pipe through refiner", verify refined text shown | Screenshot: raw vs refined |
| FUT-406 | Inject Toggle | Enable "Format as bullet points", transcribe, verify appended | Screenshot: injection visible |
| FUT-407 | Custom Inject | Add custom injection, enable it, verify in output | Screenshot: custom text appended |
| FUT-408 | Live Inject | Enable injection, do live transcription, verify appended | Screenshot: injection in live output |
| FUT-409 | Keyboard Inject | Enable injection + keyboard typing, verify typed text includes injection | Log: typed text content |

### 2.4 SIT - System Integration Tests

| Test ID | Flow | What | Evidence |
|---------|------|------|----------|
| SIT-401 | File + Refiner | Upload file -> transcribe -> refine -> download | Full flow screenshot + API logs |
| SIT-402 | File + Inject | Upload file -> transcribe -> inject suffix -> display | Screenshot + text comparison |
| SIT-403 | Live + Inject + Keyboard | Speak -> transcribe -> inject -> type to window | Keyboard output log |
| SIT-404 | Tab switching | Switch between Live / File / Discuss tabs, verify state preserved | Screenshots of each tab |

---

## 3. Regression Gate

**All 179 existing tests MUST pass before any v1.4 code is merged.**

### 3.1 Backend Regression

```bash
cd /mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice
source .venv/bin/activate
pytest tests/unit/backend/ -v --tb=short 2>&1 | tee test-results-backend.txt
# Expected: 103 passed, 0 failed
```

### 3.2 Frontend Regression

```bash
cd /mnt/c/Users/colin/bacon-ai/projects/bacon-ai-voice/src/frontend
npx vitest run 2>&1 | tee test-results-frontend.txt
# Expected: 76 passed, 0 failed
```

### 3.3 New Tests

```bash
# After v1.4 implementation, run all tests
pytest tests/unit/backend/ -v --tb=short 2>&1 | tee test-results-v1.4-backend.txt
cd src/frontend && npx vitest run 2>&1 | tee test-results-v1.4-frontend.txt
# Expected: 103 + new backend tests passed, 76 + new frontend tests passed
```

---

## 4. Evidence Requirements

| Phase | Artifact | Location |
|-------|----------|----------|
| TUT | pytest output log | `progress/testing/test-results-v1.4-backend.txt` |
| TUT | vitest output log | `progress/testing/test-results-v1.4-frontend.txt` |
| FUT | Browser screenshots | `progress/testing/screenshots/v1.4/` |
| SIT | Full flow recordings | `progress/testing/screenshots/v1.4/` |
| RGT | Regression test output | `progress/testing/regression-v1.4.txt` |

---

## 5. Test Automation

### 5.1 New Test Files to Create

| File | Scope | Est. Tests |
|------|-------|-----------|
| `tests/unit/backend/test_file_transcribe.py` | TUT-B101 to TUT-B110 | ~10 |
| `tests/unit/backend/test_keyboard_target.py` | TUT-B111 to TUT-B113 | ~3 |
| `src/frontend/src/components/__tests__/FileTranscriptionPanel.test.tsx` | TUT-F101 to TUT-F105 | ~5 |
| `src/frontend/src/utils/__tests__/injections.test.ts` | TUT-F106 to TUT-F108 | ~3 |
| `src/frontend/src/components/__tests__/InjectTab.test.tsx` | TUT-F109 to TUT-F112 | ~4 |

### 5.2 Estimated New Test Count

- Backend: ~13 new tests (total: ~116)
- Frontend: ~12 new tests (total: ~88)
- **New total: ~204 tests**
