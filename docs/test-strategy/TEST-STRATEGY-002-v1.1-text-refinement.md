# TEST-STRATEGY-002: v1.1 AI Text Refinement Test Strategy

**Version:** 1.0
**Status:** Draft
**Date:** 2026-02-16
**Scope:** v1.1 AI Text Refinement feature (Groq, Ollama, Gemini providers)

---

## 1. Test Pyramid (v1.1 Additions)

```
        /‾‾‾‾‾‾‾‾‾\
       /    UAT     \        Colin validates refiner UX
      /──────────────\
     /   SIT (E2E)    \      Transcription -> Refiner -> Display
    /───────────────────\
   /      FUT            \    Refiner toggle, provider switch, comparison view
  /─────────────────────────\
 /         TUT               \  Refiner pipeline, providers (mocked), API endpoints, React components
/─────────────────────────────\
```

---

## 2. Test Levels

### 2.1 TUT - Technical Unit Tests (Backend)

#### test_refiner.py - Refiner Pipeline (`src/backend/app/refiner/`)

| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-R001 | Refiner | Processes text correctly (removes filler words) | Input/output comparison |
| TUT-R002 | Refiner | Returns raw text unchanged when disabled | Input === output |
| TUT-R003 | Refiner | Handles empty string input | Returns empty string |
| TUT-R004 | Refiner | Handles very long text (>5000 chars) | Output returned, no timeout |
| TUT-R005 | Refiner | Uses custom prompt when provided | Mock provider receives custom prompt |

#### test_refiner_providers.py - Provider Tests (`src/backend/app/refiner/providers/`)

All provider tests use mocked httpx responses. **No real API calls.**

| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-RP001 | GroqProvider | Sends correct API format (model, messages, temperature) | Captured request body |
| TUT-RP002 | GroqProvider | Handles 401 auth error | Raises AuthError with message |
| TUT-RP003 | GroqProvider | Handles 429 rate limit | Raises RateLimitError with retry-after |
| TUT-RP004 | GroqProvider | Handles request timeout | Raises TimeoutError |
| TUT-RP005 | OllamaProvider | Sends correct format (model, prompt, stream=false) | Captured request body |
| TUT-RP006 | OllamaProvider | Handles connection refused (Ollama not running) | Raises ConnectionError with guidance |
| TUT-RP007 | GeminiProvider | Sends correct format (contents, generationConfig) | Captured request body |
| TUT-RP008 | GeminiProvider | Handles 401 auth error | Raises AuthError with message |
| TUT-RP009 | ProviderFactory | Returns correct provider by name ("groq"/"ollama"/"gemini") | isinstance check |

#### test_refiner_api.py - API Endpoint Tests (`src/backend/app/refiner_api.py`)

| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-RA001 | POST /refiner/process | Returns refined text with 200 | Response body: {raw, refined, provider} |
| TUT-RA002 | POST /refiner/process | Invalid provider name returns 400 | Error response body |
| TUT-RA003 | POST /refiner/process | Provider error returns 500 with fallback to raw text | Response: {raw, refined=raw, error} |
| TUT-RA004 | GET /refiner/config | Returns current refiner config | Response: {enabled, provider, model} |
| TUT-RA005 | POST /refiner/test | Processes sample text and returns result | Response: {raw, refined, latency_ms} |

**Backend test count: 19 tests**

### 2.2 TUT - Technical Unit Tests (Frontend)

#### RefinerSettings.test.tsx (`src/frontend/src/components/__tests__/`)

| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-FR001 | RefinerSettings | Renders provider dropdown with 3 options (Groq, Ollama, Gemini) | DOM: 3 option elements |
| TUT-FR002 | RefinerSettings | Shows API key input for Groq provider | DOM: input[type=password] visible |
| TUT-FR003 | RefinerSettings | Shows API key input for Gemini provider | DOM: input[type=password] visible |
| TUT-FR004 | RefinerSettings | Shows Ollama URL input only for Ollama provider (no API key) | DOM: URL input visible, no password input |
| TUT-FR005 | RefinerSettings | Toggle enables/disables refiner | onUpdate called with {refinerEnabled: bool} |
| TUT-FR006 | RefinerSettings | Test button calls /refiner/test endpoint | fetch mock called with correct URL |

#### TextComparison.test.tsx (`src/frontend/src/components/__tests__/`)

| Test ID | Component | What | Evidence |
|---------|-----------|------|----------|
| TUT-FC001 | TextComparison | Shows raw text on left panel, refined on right panel | DOM: two panels with correct content |
| TUT-FC002 | TextComparison | Shows only raw text when refiner is disabled | DOM: single panel, no comparison |
| TUT-FC003 | TextComparison | Copy button copies refined text to clipboard | navigator.clipboard.writeText called |
| TUT-FC004 | TextComparison | Shows processing spinner while refining | DOM: spinner element visible |
| TUT-FC005 | TextComparison | Shows error message on refiner failure | DOM: error banner with message |
| TUT-FC006 | TextComparison | Highlights differences between raw and refined text | DOM: diff markers present |

**Frontend test count: 12 tests**

### 2.3 FUT - Functional Unit Tests

| Test ID | Feature | What | Evidence |
|---------|---------|------|----------|
| FUT-R001 | Refiner Toggle | Enable refiner in settings, transcribe, see comparison | Screenshot: side-by-side view |
| FUT-R002 | Provider Switch | Change provider in settings, verify next refinement uses new provider | Screenshot: settings + result |
| FUT-R003 | API Key Entry | Enter Groq API key, save, verify persisted on reload | Screenshot: settings persistence |
| FUT-R004 | Ollama Config | Enter custom Ollama URL, verify connection test | Screenshot: connection status |
| FUT-R005 | Test Button | Click "Test Refiner", see sample refinement result | Screenshot: test result display |
| FUT-R006 | Copy Refined | Click copy on refined text, verify clipboard | Screenshot: copy confirmation |
| FUT-R007 | Refiner Error | Use invalid API key, see graceful error + raw text fallback | Screenshot: error state |

### 2.4 SIT - System Integration Tests

| Test ID | Flow | What | Evidence |
|---------|------|------|----------|
| SIT-R001 | Full Refiner Flow | Transcription result -> refiner -> TextComparison display | E2E screenshot + API logs |
| SIT-R002 | Refiner Off Flow | Transcription result -> direct display (no refiner call) | API logs show no /refiner calls |
| SIT-R003 | Refiner Error Fallback | Transcription -> refiner error -> raw text displayed + error notification | Error UI screenshot |
| SIT-R004 | Provider Switch Mid-Session | Change provider during active session, next transcription uses new provider | Before/after screenshots |
| SIT-R005 | Regression: Core STT | All v1.0 flows still work with refiner disabled | SIT-001 from TEST-STRATEGY-001 passes |

### 2.5 UAT - User Acceptance Tests

| Test ID | Scenario | Pass Criteria | Sign-off |
|---------|----------|---------------|----------|
| UAT-R001 | Colin speaks with filler words, sees cleaned text | Filler words removed, meaning preserved | Colin |
| UAT-R002 | Colin switches between Groq and Ollama | Both produce reasonable refinements | Colin |
| UAT-R003 | Colin toggles refiner on/off during session | Seamless transition, no errors | Colin |
| UAT-R004 | Colin uses refined text for Claude prompt | Refined text improves Claude response quality | Colin |

---

## 3. Test Data

### Sample Transcriptions for Deterministic Testing

```python
# test_data.py - Shared test fixtures

REFINER_TEST_CASES = [
    {
        "id": "filler_words",
        "raw": "So um basically what I want is uh you know like a function that uh takes a list and um sorts it by by the second element",
        "expected": "I want a function that takes a list and sorts it by the second element",
        "description": "Removes filler words (um, uh, like, you know) and false starts"
    },
    {
        "id": "repetition",
        "raw": "Hey so I was I was thinking maybe we could we could refactor the uh the auth module to use to use JWT tokens instead",
        "expected": "I was thinking we could refactor the auth module to use JWT tokens instead",
        "description": "Removes repetitions and hesitations"
    },
    {
        "id": "clean_input",
        "raw": "Create a Python function that calculates the Fibonacci sequence",
        "expected": "Create a Python function that calculates the Fibonacci sequence",
        "description": "Clean input should pass through unchanged"
    },
    {
        "id": "empty_input",
        "raw": "",
        "expected": "",
        "description": "Empty string returns empty string"
    },
    {
        "id": "long_input",
        "raw": "So basically " * 500 + "I need a function",
        "expected": "I need a function",
        "description": "Very long input with repeated filler (stress test)"
    }
]
```

### Mock API Responses

```python
# Groq mock response
GROQ_MOCK_RESPONSE = {
    "choices": [{
        "message": {
            "content": "I want a function that takes a list and sorts it by the second element"
        }
    }],
    "usage": {"prompt_tokens": 50, "completion_tokens": 20}
}

# Ollama mock response
OLLAMA_MOCK_RESPONSE = {
    "response": "I want a function that takes a list and sorts it by the second element",
    "done": True,
    "total_duration": 150000000  # nanoseconds
}

# Gemini mock response
GEMINI_MOCK_RESPONSE = {
    "candidates": [{
        "content": {
            "parts": [{"text": "I want a function that takes a list and sorts it by the second element"}]
        }
    }]
}

# Error responses
GROQ_AUTH_ERROR = {"error": {"message": "Invalid API key", "type": "invalid_api_key", "code": 401}}
GROQ_RATE_LIMIT = {"error": {"message": "Rate limit exceeded", "type": "rate_limit_exceeded", "code": 429}}
GEMINI_AUTH_ERROR = {"error": {"message": "API key not valid", "status": "PERMISSION_DENIED", "code": 403}}
```

---

## 4. Mocking Strategy

### Backend (pytest)

Use `httpx.MockTransport` for all provider tests. No real API calls.

```python
import httpx
import pytest

@pytest.fixture
def mock_groq_transport():
    """Mock transport that returns a successful Groq API response."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert "api.groq.com" in str(request.url)
        assert request.headers["Authorization"] == "Bearer test-key"
        return httpx.Response(200, json=GROQ_MOCK_RESPONSE)
    return httpx.MockTransport(handler)

@pytest.fixture
def mock_groq_auth_error():
    """Mock transport that returns a 401 auth error."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json=GROQ_AUTH_ERROR)
    return httpx.MockTransport(handler)

@pytest.fixture
def mock_ollama_connection_refused():
    """Mock transport that simulates Ollama not running."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")
    return httpx.MockTransport(handler)
```

### Frontend (vitest)

Use `vi.fn()` for fetch mocking. Follow existing patterns from SettingsPanel.test.tsx.

```typescript
// Mock fetch for refiner API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Successful refine response
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({
    raw: "So um basically I want...",
    refined: "I want...",
    provider: "groq",
    latency_ms: 180
  })
});

// Error response
mockFetch.mockResolvedValueOnce({
  ok: false,
  status: 500,
  json: async () => ({
    error: "Provider timeout",
    raw: "So um basically I want..."
  })
});
```

---

## 5. Test File Locations

### New Backend Test Files
```
tests/unit/backend/
├── test_refiner.py              # 5 tests - Refiner pipeline
├── test_refiner_providers.py    # 9 tests - Provider implementations (mocked httpx)
└── test_refiner_api.py          # 5 tests - FastAPI endpoint tests
```

Note: Backend tests live in `tests/unit/backend/` (configured in pyproject.toml `testpaths`), NOT in `src/backend/app/tests/`.

### New Frontend Test Files
```
src/frontend/src/components/__tests__/
├── RefinerSettings.test.tsx     # 6 tests - Settings component
└── TextComparison.test.tsx      # 6 tests - Comparison display component
```

---

## 6. Test Count Summary

| Category | Existing (v1.0) | New (v1.1) | Total |
|----------|-----------------|------------|-------|
| Backend unit tests | 52 | 19 | 71 |
| Frontend unit tests | 58 | 12 | 70 |
| **Total** | **110** | **31** | **141** |

---

## 7. Test Execution Order

```
1. TUT-R* (refiner pipeline units)          -> Must pass before provider tests
2. TUT-RP* (provider units, mocked)         -> Must pass before API tests
3. TUT-RA* (API endpoint tests)             -> Must pass before frontend tests
4. TUT-FR* (RefinerSettings component)      -> Must pass before FUT
5. TUT-FC* (TextComparison component)       -> Must pass before FUT
6. FUT-R* (functional feature tests)        -> Must pass before SIT
7. SIT-R* (integration flows)              -> Must pass before UAT
8. SIT-R005 (v1.0 regression)             -> Must pass before UAT
9. UAT-R* (user acceptance)               -> Human sign-off
```

---

## 8. Quality Gates

| Gate | Criteria | Blocking? |
|------|----------|-----------|
| TUT Pass | All 31 new unit tests pass | Yes - blocks FUT |
| Coverage | Backend refiner >80%, Frontend refiner >70% | Yes - blocks SIT |
| FUT Pass | All 7 functional tests pass with evidence | Yes - blocks SIT |
| SIT Pass | All 5 integration tests pass | Yes - blocks UAT |
| Regression | All 110 v1.0 tests still pass | Yes - blocks merge |
| UAT Pass | Colin signs off on all 4 acceptance tests | Yes - blocks release |

---

## 9. Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Groq API format changes | Provider tests break | Pin API version, mock responses from real API docs |
| Ollama not installed locally | Cannot test Ollama provider manually | Unit tests use mocks; FUT uses Groq as primary |
| Gemini API auth complexity | Setup friction for testing | Document API key setup in test README |
| Refiner latency varies | UX inconsistency | Set 5s timeout, show spinner, fallback to raw |
| Filler word detection is AI-dependent | Non-deterministic results | Use mocks for unit tests; accept variance in FUT/UAT |

---

## 10. Non-Functional Requirements

| Requirement | Target | How to Test |
|-------------|--------|-------------|
| Refiner latency | <500ms (Groq), <2s (Ollama), <1s (Gemini) | Time API calls in SIT |
| Fallback reliability | 100% - always show raw text on error | Error injection in SIT-R003 |
| Settings persistence | Survive page reload | FUT-R003 |
| No data leakage | API keys never in logs or network tab | Code review + browser DevTools check |

---

*Document end. Awaiting human review.*
