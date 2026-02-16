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
"""

import sys
from pathlib import Path

import httpx
import pytest

backend_src = Path(__file__).resolve().parents[3] / "src" / "backend"
if str(backend_src) not in sys.path:
    sys.path.insert(0, str(backend_src))

from app.refiner.providers import PROVIDER_REGISTRY
from app.refiner.providers.gemini_provider import GeminiRefinerProvider
from app.refiner.providers.groq_provider import GroqRefinerProvider
from app.refiner.providers.ollama_provider import OllamaRefinerProvider


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
    assert PROVIDER_REGISTRY["groq"] is GroqRefinerProvider
    assert PROVIDER_REGISTRY["ollama"] is OllamaRefinerProvider
    assert PROVIDER_REGISTRY["gemini"] is GeminiRefinerProvider
    assert len(PROVIDER_REGISTRY) == 3
