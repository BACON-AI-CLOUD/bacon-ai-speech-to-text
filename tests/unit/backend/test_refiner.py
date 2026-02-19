"""
Unit tests for the BACON-AI Voice Backend Refiner module.

Test IDs:
    TUT-B017: Refiner disabled returns raw text
    TUT-B018: Refiner processes text with mock provider
    TUT-B019: Refiner fallback on provider error
    TUT-B020: Refiner uses custom prompt
    TUT-B021: Refiner handles empty text
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

backend_src = Path(__file__).resolve().parents[3] / "src" / "backend"
if str(backend_src) not in sys.path:
    sys.path.insert(0, str(backend_src))

from app.refiner.providers.base import RefinerResult
from app.refiner.refiner import Refiner


# ============================================================================
# TUT-B017: Refiner disabled returns raw text
# ============================================================================


@pytest.mark.asyncio
async def test_refiner_disabled_returns_raw_text():
    """TUT-B017: When refiner is disabled, raw text is returned unchanged."""
    refiner = Refiner()
    refiner._enabled = False

    result = await refiner.process("hello um world")

    assert result.refined_text == "hello um world"
    assert result.provider == "disabled"
    assert result.tokens_used == 0


# ============================================================================
# TUT-B018: Refiner processes text with mock provider
# ============================================================================


@pytest.mark.asyncio
async def test_refiner_processes_text_with_mock_provider():
    """TUT-B018: Refiner calls the active provider and returns its result."""
    refiner = Refiner()
    refiner._enabled = True
    refiner._active_provider = "ollama"

    mock_provider = MagicMock()
    mock_provider.refine = AsyncMock(
        return_value=RefinerResult(
            refined_text="Hello world.",
            provider="ollama",
            model="llama3.2",
            processing_time_ms=42.0,
            tokens_used=15,
        )
    )
    refiner._providers["ollama"] = mock_provider

    result = await refiner.process("hello um world")

    assert result.refined_text == "Hello world."
    assert result.provider == "ollama"
    assert result.tokens_used == 15
    mock_provider.refine.assert_awaited_once()


# ============================================================================
# TUT-B019: Refiner fallback on provider error
# ============================================================================


@pytest.mark.asyncio
async def test_refiner_fallback_on_provider_error():
    """TUT-B019: On provider failure, refiner returns raw text unchanged."""
    refiner = Refiner()
    refiner._enabled = True
    refiner._active_provider = "ollama"

    mock_provider = MagicMock()
    mock_provider.refine = AsyncMock(side_effect=Exception("API timeout"))
    refiner._providers["ollama"] = mock_provider

    result = await refiner.process("raw text here")

    assert result.refined_text == "raw text here"
    assert result.model == "fallback"


# ============================================================================
# TUT-B020: Refiner uses custom prompt
# ============================================================================


@pytest.mark.asyncio
async def test_refiner_uses_custom_prompt():
    """TUT-B020: Custom prompt additions are passed to the provider."""
    refiner = Refiner()
    refiner._enabled = True
    refiner._active_provider = "ollama"
    refiner._custom_prompt = "Also fix technical jargon."

    mock_provider = MagicMock()
    mock_provider.refine = AsyncMock(
        return_value=RefinerResult(
            refined_text="Fixed text.",
            provider="ollama",
            model="llama3.2",
        )
    )
    refiner._providers["ollama"] = mock_provider

    await refiner.process("some text")

    call_args = mock_provider.refine.call_args
    prompt_used = call_args[0][1]  # second positional arg is system_prompt
    assert prompt_used == "Also fix technical jargon."


# ============================================================================
# TUT-B021: Refiner handles empty text
# ============================================================================


@pytest.mark.asyncio
async def test_refiner_handles_empty_text():
    """TUT-B021: Empty or whitespace text is returned without calling provider."""
    refiner = Refiner()
    refiner._enabled = True

    result_empty = await refiner.process("")
    assert result_empty.refined_text == ""
    assert result_empty.provider == "none"

    result_whitespace = await refiner.process("   ")
    assert result_whitespace.refined_text == "   "
    assert result_whitespace.provider == "none"
