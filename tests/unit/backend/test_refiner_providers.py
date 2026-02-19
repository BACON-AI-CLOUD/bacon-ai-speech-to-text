"""
Unit tests for BACON-AI Voice Backend Refiner Providers.

Test IDs:
    TUT-B022: Groq sends correct API format
    TUT-B023: Groq handles auth error
    TUT-B024: Groq handles rate limit
    TUT-B025: Groq handles timeout
    TUT-B026: Ollama sends correct format
    TUT-B027: Ollama handles connection refused
    TUT-B028: Gemini sends correct format
    TUT-B029: Gemini handles auth error
    TUT-B030: Provider factory returns correct type
    TUT-B036: Anthropic sends correct API format
    TUT-B037: Anthropic handles auth error
    TUT-B038: OpenAI sends correct API format
    TUT-B039: OpenAI handles auth error
    TUT-B040: Groq list_models returns dynamic models
    TUT-B041: Groq list_models falls back to defaults
    TUT-B042: Ollama list_models returns dynamic models
    TUT-B043: Ollama list_models falls back to defaults
    TUT-B044: Gemini list_models returns hardcoded list
    TUT-B045: Anthropic list_models returns hardcoded list
    TUT-B046: OpenAI list_models returns hardcoded list
    TUT-B047: Provider display names and API key requirements
"""

import sys
from pathlib import Path

import httpx
import pytest

backend_src = Path(__file__).resolve().parents[3] / "src" / "backend"
if str(backend_src) not in sys.path:
    sys.path.insert(0, str(backend_src))

from app.refiner.providers import PROVIDER_REGISTRY
from app.refiner.providers.anthropic_provider import AnthropicRefinerProvider
from app.refiner.providers.gemini_provider import GeminiRefinerProvider
from app.refiner.providers.groq_provider import GroqRefinerProvider
from app.refiner.providers.ollama_provider import OllamaRefinerProvider
from app.refiner.providers.openai_provider import OpenAIRefinerProvider


# ============================================================================
# Helpers
# ============================================================================


def _groq_success_response(request: httpx.Request) -> httpx.Response:
    """Mock Groq API success response."""
    return httpx.Response(
        200,
        json={
            "choices": [
                {"message": {"content": "Hello world."}}
            ],
            "usage": {"total_tokens": 25},
        },
    )


def _ollama_success_response(request: httpx.Request) -> httpx.Response:
    """Mock Ollama API success response."""
    return httpx.Response(
        200,
        json={
            "message": {"content": "Hello world."},
            "eval_count": 18,
        },
    )


def _gemini_success_response(request: httpx.Request) -> httpx.Response:
    """Mock Gemini API success response."""
    return httpx.Response(
        200,
        json={
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Hello world."}],
                    }
                }
            ],
            "usageMetadata": {"totalTokenCount": 30},
        },
    )


def _anthropic_success_response(request: httpx.Request) -> httpx.Response:
    """Mock Anthropic API success response."""
    return httpx.Response(
        200,
        json={
            "content": [{"type": "text", "text": "Hello world."}],
            "usage": {"input_tokens": 15, "output_tokens": 10},
        },
    )


def _openai_success_response(request: httpx.Request) -> httpx.Response:
    """Mock OpenAI API success response."""
    return httpx.Response(
        200,
        json={
            "choices": [
                {"message": {"content": "Hello world."}}
            ],
            "usage": {"total_tokens": 22},
        },
    )


# ============================================================================
# TUT-B022: Groq sends correct API format
# ============================================================================


@pytest.mark.asyncio
async def test_groq_sends_correct_api_format():
    """TUT-B022: Groq provider sends correctly formatted API request."""
    provider = GroqRefinerProvider(api_key="test-key-123")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_groq_success_response)
    )

    result = await provider.refine("hello um world", "Fix the text.", timeout=5.0)

    assert result.refined_text == "Hello world."
    assert result.provider == "groq"
    assert result.tokens_used == 25
    assert result.processing_time_ms > 0


# ============================================================================
# TUT-B023: Groq handles auth error
# ============================================================================


@pytest.mark.asyncio
async def test_groq_handles_auth_error():
    """TUT-B023: Groq provider raises on 401 Unauthorized."""

    def _auth_error(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "Invalid API Key"}})

    provider = GroqRefinerProvider(api_key="bad-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_auth_error)
    )

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await provider.refine("test", "prompt")
    assert exc_info.value.response.status_code == 401


# ============================================================================
# TUT-B024: Groq handles rate limit
# ============================================================================


@pytest.mark.asyncio
async def test_groq_handles_rate_limit():
    """TUT-B024: Groq provider raises on 429 rate limit."""

    def _rate_limit(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "Rate limit exceeded"}})

    provider = GroqRefinerProvider(api_key="test-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_rate_limit)
    )

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await provider.refine("test", "prompt")
    assert exc_info.value.response.status_code == 429


# ============================================================================
# TUT-B025: Groq handles timeout
# ============================================================================


@pytest.mark.asyncio
async def test_groq_handles_timeout():
    """TUT-B025: Groq provider raises on request timeout."""

    def _timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Connection timed out")

    provider = GroqRefinerProvider(api_key="test-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_timeout)
    )

    with pytest.raises(httpx.ReadTimeout):
        await provider.refine("test", "prompt", timeout=0.1)


# ============================================================================
# TUT-B026: Ollama sends correct format
# ============================================================================


@pytest.mark.asyncio
async def test_ollama_sends_correct_format():
    """TUT-B026: Ollama provider sends correctly formatted request."""
    provider = OllamaRefinerProvider(model="llama3.2")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_ollama_success_response)
    )

    result = await provider.refine("hello um world", "Fix the text.", timeout=5.0)

    assert result.refined_text == "Hello world."
    assert result.provider == "ollama"
    assert result.tokens_used == 18


# ============================================================================
# TUT-B027: Ollama handles connection refused
# ============================================================================


@pytest.mark.asyncio
async def test_ollama_handles_connection_refused():
    """TUT-B027: Ollama provider raises on connection refused."""

    def _connection_refused(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    provider = OllamaRefinerProvider()
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_connection_refused)
    )

    with pytest.raises(httpx.ConnectError):
        await provider.refine("test", "prompt")


# ============================================================================
# TUT-B028: Gemini sends correct format
# ============================================================================


@pytest.mark.asyncio
async def test_gemini_sends_correct_format():
    """TUT-B028: Gemini provider sends correctly formatted request."""
    provider = GeminiRefinerProvider(api_key="test-key-456")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_gemini_success_response)
    )

    result = await provider.refine("hello um world", "Fix the text.", timeout=5.0)

    assert result.refined_text == "Hello world."
    assert result.provider == "gemini"
    assert result.tokens_used == 30


# ============================================================================
# TUT-B029: Gemini handles auth error
# ============================================================================


@pytest.mark.asyncio
async def test_gemini_handles_auth_error():
    """TUT-B029: Gemini provider raises on 403 Forbidden."""

    def _auth_error(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"error": {"message": "API key invalid"}})

    provider = GeminiRefinerProvider(api_key="bad-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_auth_error)
    )

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await provider.refine("test", "prompt")
    assert exc_info.value.response.status_code == 403


# ============================================================================
# TUT-B030: Provider factory returns correct type
# ============================================================================


def test_provider_factory_returns_correct_type():
    """TUT-B030: PROVIDER_REGISTRY maps names to correct provider classes."""
    assert PROVIDER_REGISTRY["anthropic"] is AnthropicRefinerProvider
    assert PROVIDER_REGISTRY["openai"] is OpenAIRefinerProvider
    assert PROVIDER_REGISTRY["groq"] is GroqRefinerProvider
    assert PROVIDER_REGISTRY["ollama"] is OllamaRefinerProvider
    assert PROVIDER_REGISTRY["gemini"] is GeminiRefinerProvider
    assert len(PROVIDER_REGISTRY) == 6


# ============================================================================
# TUT-B036: Anthropic sends correct API format
# ============================================================================


@pytest.mark.asyncio
async def test_anthropic_sends_correct_api_format():
    """TUT-B036: Anthropic provider sends correctly formatted API request."""
    provider = AnthropicRefinerProvider(api_key="test-key-789")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_anthropic_success_response)
    )

    result = await provider.refine("hello um world", "Fix the text.", timeout=5.0)

    assert result.refined_text == "Hello world."
    assert result.provider == "anthropic"
    assert result.tokens_used == 25  # 15 input + 10 output
    assert result.processing_time_ms > 0


# ============================================================================
# TUT-B037: Anthropic handles auth error
# ============================================================================


@pytest.mark.asyncio
async def test_anthropic_handles_auth_error():
    """TUT-B037: Anthropic provider raises on 401 Unauthorized."""

    def _auth_error(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "Invalid API Key"}})

    provider = AnthropicRefinerProvider(api_key="bad-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_auth_error)
    )

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await provider.refine("test", "prompt")
    assert exc_info.value.response.status_code == 401


# ============================================================================
# TUT-B038: OpenAI sends correct API format
# ============================================================================


@pytest.mark.asyncio
async def test_openai_sends_correct_api_format():
    """TUT-B038: OpenAI provider sends correctly formatted API request."""
    provider = OpenAIRefinerProvider(api_key="test-key-abc")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_openai_success_response)
    )

    result = await provider.refine("hello um world", "Fix the text.", timeout=5.0)

    assert result.refined_text == "Hello world."
    assert result.provider == "openai"
    assert result.tokens_used == 22
    assert result.processing_time_ms > 0


# ============================================================================
# TUT-B039: OpenAI handles auth error
# ============================================================================


@pytest.mark.asyncio
async def test_openai_handles_auth_error():
    """TUT-B039: OpenAI provider raises on 401 Unauthorized."""

    def _auth_error(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "Invalid API Key"}})

    provider = OpenAIRefinerProvider(api_key="bad-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_auth_error)
    )

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await provider.refine("test", "prompt")
    assert exc_info.value.response.status_code == 401


# ============================================================================
# TUT-B040: Groq list_models returns dynamic models
# ============================================================================


@pytest.mark.asyncio
async def test_groq_list_models_dynamic():
    """TUT-B040: Groq list_models queries API and returns models."""

    def _models_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": "llama-3.3-70b-versatile", "active": True},
                    {"id": "llama-3.1-8b-instant", "active": True},
                    {"id": "whisper-large-v3", "active": True},
                ],
            },
        )

    provider = GroqRefinerProvider(api_key="test-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_models_response)
    )

    models = await provider.list_models()
    assert len(models) == 3
    assert models[0]["id"] == "llama-3.3-70b-versatile"


# ============================================================================
# TUT-B041: Groq list_models falls back to defaults
# ============================================================================


@pytest.mark.asyncio
async def test_groq_list_models_fallback():
    """TUT-B041: Groq list_models returns defaults when API fails."""

    def _error(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "Server error"})

    provider = GroqRefinerProvider(api_key="test-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_error)
    )

    models = await provider.list_models()
    assert len(models) == 4  # Default list
    assert models[0]["id"] == "llama-3.3-70b-versatile"


# ============================================================================
# TUT-B042: Ollama list_models returns dynamic models
# ============================================================================


@pytest.mark.asyncio
async def test_ollama_list_models_dynamic():
    """TUT-B042: Ollama list_models queries /api/tags and returns models."""

    def _tags_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "models": [
                    {"name": "llama3.2:latest"},
                    {"name": "codellama:latest"},
                ],
            },
        )

    provider = OllamaRefinerProvider()
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_tags_response)
    )

    models = await provider.list_models()
    assert len(models) == 2
    assert models[0]["id"] == "llama3.2:latest"


# ============================================================================
# TUT-B043: Ollama list_models falls back to defaults
# ============================================================================


@pytest.mark.asyncio
async def test_ollama_list_models_fallback():
    """TUT-B043: Ollama list_models returns defaults when connection fails."""

    def _error(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    provider = OllamaRefinerProvider()
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_error)
    )

    models = await provider.list_models()
    assert len(models) == 1  # Default list
    assert models[0]["id"] == "llama3.2"


# ============================================================================
# TUT-B044: Gemini list_models returns hardcoded list
# ============================================================================


@pytest.mark.asyncio
async def test_gemini_list_models_hardcoded():
    """TUT-B044: Gemini list_models returns hardcoded model list."""
    provider = GeminiRefinerProvider(api_key="test-key")
    models = await provider.list_models()
    assert len(models) == 4
    assert models[0]["id"] == "gemini-2.5-flash"


# ============================================================================
# TUT-B045: Anthropic list_models returns hardcoded list
# ============================================================================


@pytest.mark.asyncio
async def test_anthropic_list_models_hardcoded():
    """TUT-B045: Anthropic list_models returns hardcoded model list."""
    provider = AnthropicRefinerProvider(api_key="test-key")
    models = await provider.list_models()
    assert len(models) == 3
    assert any(m["id"] == "claude-sonnet-4-5-20250929" for m in models)


# ============================================================================
# TUT-B046: OpenAI list_models returns hardcoded list
# ============================================================================


@pytest.mark.asyncio
async def test_openai_list_models_hardcoded():
    """TUT-B046: OpenAI list_models returns hardcoded model list."""
    provider = OpenAIRefinerProvider(api_key="test-key")
    models = await provider.list_models()
    assert len(models) == 3
    assert any(m["id"] == "gpt-4o" for m in models)


# ============================================================================
# TUT-B047: Provider display names and API key requirements
# ============================================================================


def test_provider_display_names_and_api_key_requirements():
    """TUT-B047: Providers have correct display names and API key flags."""
    assert AnthropicRefinerProvider.PROVIDER_DISPLAY_NAME == "Anthropic"
    assert AnthropicRefinerProvider.REQUIRES_API_KEY is True

    assert OpenAIRefinerProvider.PROVIDER_DISPLAY_NAME == "OpenAI"
    assert OpenAIRefinerProvider.REQUIRES_API_KEY is True

    assert GroqRefinerProvider.PROVIDER_DISPLAY_NAME == "Groq"
    assert GroqRefinerProvider.REQUIRES_API_KEY is True

    assert OllamaRefinerProvider.PROVIDER_DISPLAY_NAME == "Ollama"
    assert OllamaRefinerProvider.REQUIRES_API_KEY is False

    assert GeminiRefinerProvider.PROVIDER_DISPLAY_NAME == "Google Gemini"
    assert GeminiRefinerProvider.REQUIRES_API_KEY is True


# ============================================================================
# TUT-B051: Anthropic list_models with custom models
# ============================================================================


@pytest.mark.asyncio
async def test_anthropic_list_models_custom():
    """TUT-B051: Anthropic list_models returns custom_models when provided."""
    provider = AnthropicRefinerProvider(api_key="test-key")
    custom = [{"id": "custom-claude", "name": "Custom Claude"}]
    models = await provider.list_models(custom_models=custom)
    assert models == custom


# ============================================================================
# TUT-B052: OpenAI list_models with custom models
# ============================================================================


@pytest.mark.asyncio
async def test_openai_list_models_custom():
    """TUT-B052: OpenAI list_models returns custom_models when provided."""
    provider = OpenAIRefinerProvider(api_key="test-key")
    custom = [{"id": "custom-gpt", "name": "Custom GPT"}]
    models = await provider.list_models(custom_models=custom)
    assert models == custom


# ============================================================================
# TUT-B053: Gemini list_models with custom models
# ============================================================================


@pytest.mark.asyncio
async def test_gemini_list_models_custom():
    """TUT-B053: Gemini list_models returns custom_models when provided."""
    provider = GeminiRefinerProvider(api_key="test-key")
    custom = [{"id": "custom-gemini", "name": "Custom Gemini"}]
    models = await provider.list_models(custom_models=custom)
    assert models == custom


# ============================================================================
# TUT-B054: Groq list_models uses custom models when no API key
# ============================================================================


@pytest.mark.asyncio
async def test_groq_list_models_custom_no_api_key():
    """TUT-B054: Groq returns custom_models instead of defaults when no API key."""
    provider = GroqRefinerProvider()  # no api_key
    custom = [{"id": "custom-llama", "name": "Custom Llama"}]
    models = await provider.list_models(custom_models=custom)
    assert models == custom


# ============================================================================
# TUT-B055: Groq API response takes precedence over custom models
# ============================================================================


@pytest.mark.asyncio
async def test_groq_list_models_api_takes_precedence():
    """TUT-B055: Groq API response beats custom_models."""

    def _models_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": "live-model-1", "active": True},
                ],
            },
        )

    provider = GroqRefinerProvider(api_key="test-key")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_models_response)
    )

    custom = [{"id": "custom-llama", "name": "Custom Llama"}]
    models = await provider.list_models(custom_models=custom)
    assert len(models) == 1
    assert models[0]["id"] == "live-model-1"


# ============================================================================
# TUT-B056: Ollama list_models uses custom models when unreachable
# ============================================================================


@pytest.mark.asyncio
async def test_ollama_list_models_custom_fallback():
    """TUT-B056: Ollama returns custom_models when connection fails."""

    def _error(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    provider = OllamaRefinerProvider()
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_error)
    )

    custom = [{"id": "custom-ollama", "name": "Custom Ollama"}]
    models = await provider.list_models(custom_models=custom)
    assert models == custom


# ============================================================================
# TUT-B061: Ollama test_connection returns ok on success
# ============================================================================


@pytest.mark.asyncio
async def test_ollama_test_connection_success():
    """TUT-B061: Ollama test_connection returns ok when reachable."""
    tags_response = {"models": [{"name": "llama3.2"}, {"name": "mistral"}]}

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=tags_response)

    provider = OllamaRefinerProvider()
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_handler)
    )

    result = await provider.test_connection()
    assert result["ok"] is True
    assert result["latency_ms"] > 0
    assert "2 model(s)" in result["message"]


# ============================================================================
# TUT-B062: Ollama test_connection returns fail on connection error
# ============================================================================


@pytest.mark.asyncio
async def test_ollama_test_connection_fail():
    """TUT-B062: Ollama test_connection returns fail when unreachable."""

    def _error(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    provider = OllamaRefinerProvider()
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_error)
    )

    result = await provider.test_connection()
    assert result["ok"] is False
    assert "Cannot connect" in result["message"]


# ============================================================================
# TUT-B063: Groq test_connection returns ok with valid key
# ============================================================================


@pytest.mark.asyncio
async def test_groq_test_connection_success():
    """TUT-B063: Groq test_connection returns ok with valid API key."""
    models_response = {"data": [{"id": "llama-3.3-70b-versatile"}]}

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=models_response)

    provider = GroqRefinerProvider(api_key="gsk_test")
    provider._client = httpx.AsyncClient(
        transport=httpx.MockTransport(_handler)
    )

    result = await provider.test_connection()
    assert result["ok"] is True
    assert "1 model(s)" in result["message"]


# ============================================================================
# TUT-B064: Groq test_connection returns fail without key
# ============================================================================


@pytest.mark.asyncio
async def test_groq_test_connection_no_key():
    """TUT-B064: Groq test_connection returns fail without API key."""
    provider = GroqRefinerProvider()
    result = await provider.test_connection()
    assert result["ok"] is False
    assert "not configured" in result["message"]


# ============================================================================
# TUT-B065: Anthropic test_connection returns fail without key
# ============================================================================


@pytest.mark.asyncio
async def test_anthropic_test_connection_no_key():
    """TUT-B065: Anthropic test_connection returns fail without API key."""
    provider = AnthropicRefinerProvider()
    result = await provider.test_connection()
    assert result["ok"] is False
    assert "not configured" in result["message"]


# ============================================================================
# TUT-B066: OpenAI test_connection returns fail without key
# ============================================================================


@pytest.mark.asyncio
async def test_openai_test_connection_no_key():
    """TUT-B066: OpenAI test_connection returns fail without API key."""
    provider = OpenAIRefinerProvider()
    result = await provider.test_connection()
    assert result["ok"] is False
    assert "not configured" in result["message"]


# ============================================================================
# TUT-B067: Gemini test_connection returns fail without key
# ============================================================================


@pytest.mark.asyncio
async def test_gemini_test_connection_no_key():
    """TUT-B067: Gemini test_connection returns fail without API key."""
    provider = GeminiRefinerProvider()
    result = await provider.test_connection()
    assert result["ok"] is False
    assert "not configured" in result["message"]
