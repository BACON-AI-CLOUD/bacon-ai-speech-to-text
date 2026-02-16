"""
Unit tests for BACON-AI Voice Backend Refiner API endpoints.

Test IDs:
    TUT-B031: POST /refiner/process returns refined text
    TUT-B032: POST /refiner/process with invalid provider returns 400
    TUT-B033: POST /refiner/process falls back on provider error
    TUT-B034: GET /refiner/config returns configuration
    TUT-B035: POST /refiner/test returns result
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
# Fixtures
# ============================================================================


@pytest.fixture()
def refiner_client(test_client, monkeypatch):
    """
    Provide a test client with a mocked refiner singleton.

    Reuses the test_client fixture from conftest.py and patches
    the refiner module singleton.
    """
    mock_refiner = Refiner()
    mock_refiner._enabled = True

    # Inject a mock provider
    mock_provider = MagicMock()
    mock_provider.refine = AsyncMock(
        return_value=RefinerResult(
            refined_text="Refined output.",
            provider="ollama",
            model="llama3.2",
            processing_time_ms=50.0,
            tokens_used=20,
        )
    )
    mock_provider.is_configured.return_value = True
    mock_provider.get_info.return_value = {
        "name": "ollama",
        "model": "llama3.2",
        "configured": True,
    }
    mock_refiner._providers["ollama"] = mock_provider

    monkeypatch.setattr("app.refiner_api.get_refiner", lambda: mock_refiner)
    monkeypatch.setattr("app.refiner.get_refiner", lambda: mock_refiner)

    return test_client


# ============================================================================
# TUT-B031: POST /refiner/process returns refined text
# ============================================================================


@pytest.mark.asyncio
async def test_process_endpoint_returns_refined_text(refiner_client):
    """TUT-B031: /refiner/process returns refined text from provider."""
    response = await refiner_client.post(
        "/refiner/process",
        json={"text": "hello um world"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["refined_text"] == "Refined output."
    assert data["provider"] == "ollama"
    assert data["tokens_used"] == 20


# ============================================================================
# TUT-B032: POST /refiner/process with invalid provider returns 400
# ============================================================================


@pytest.mark.asyncio
async def test_process_endpoint_invalid_provider(refiner_client):
    """TUT-B032: /refiner/process returns 400 for unknown provider."""
    response = await refiner_client.post(
        "/refiner/process",
        json={"text": "hello", "provider": "nonexistent"},
    )

    assert response.status_code == 400
    data = response.json()
    assert "Unknown provider" in data["error"]


# ============================================================================
# TUT-B033: POST /refiner/process falls back on provider error
# ============================================================================


@pytest.mark.asyncio
async def test_process_endpoint_provider_error_fallback(test_client, monkeypatch):
    """TUT-B033: On provider error, endpoint returns raw text as fallback."""
    mock_refiner = Refiner()
    mock_refiner._enabled = True

    # Provider that always fails
    mock_provider = MagicMock()
    mock_provider.refine = AsyncMock(side_effect=Exception("Provider down"))
    mock_refiner._providers["ollama"] = mock_provider

    monkeypatch.setattr("app.refiner_api.get_refiner", lambda: mock_refiner)

    response = await test_client.post(
        "/refiner/process",
        json={"text": "raw input text"},
    )

    assert response.status_code == 200
    data = response.json()
    # Fallback: raw text returned
    assert data["refined_text"] == "raw input text"
    assert data["model"] == "fallback"


# ============================================================================
# TUT-B034: GET /refiner/config returns configuration
# ============================================================================


@pytest.mark.asyncio
async def test_config_endpoint_returns_config(refiner_client):
    """TUT-B034: /refiner/config returns current refiner configuration."""
    response = await refiner_client.get("/refiner/config")

    assert response.status_code == 200
    data = response.json()
    assert "enabled" in data
    assert "active_provider" in data
    assert "timeout" in data
    assert "providers" in data


# ============================================================================
# TUT-B035: POST /refiner/test returns result
# ============================================================================


@pytest.mark.asyncio
async def test_test_endpoint_returns_result(refiner_client):
    """TUT-B035: /refiner/test returns original and refined text."""
    response = await refiner_client.post(
        "/refiner/test",
        json={},
    )

    assert response.status_code == 200
    data = response.json()
    assert "original" in data
    assert "refined_text" in data
    assert "provider" in data
