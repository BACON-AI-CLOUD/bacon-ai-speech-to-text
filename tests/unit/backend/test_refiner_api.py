"""
Unit tests for BACON-AI Voice Backend Refiner API endpoints.

Test IDs:
    TUT-B031: POST /refiner/process returns refined text
    TUT-B032: POST /refiner/process with invalid provider returns 400
    TUT-B033: POST /refiner/process falls back on provider error
    TUT-B034: GET /refiner/config returns configuration
    TUT-B035: POST /refiner/test returns result
    TUT-B048: GET /refiner/providers returns all providers
    TUT-B049: GET /refiner/providers/{name}/models returns model list
    TUT-B050: GET /refiner/providers/{name}/models returns 400 for unknown
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
    mock_refiner._active_provider = "ollama"

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
    mock_provider.list_models = AsyncMock(
        return_value=[
            {"id": "llama3.2", "name": "llama3.2"},
            {"id": "llama3.1", "name": "llama3.1"},
        ]
    )
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
    mock_refiner._active_provider = "ollama"

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


# ============================================================================
# TUT-B048: GET /refiner/providers returns all providers
# ============================================================================


@pytest.mark.asyncio
async def test_providers_endpoint_returns_all(refiner_client):
    """TUT-B048: /refiner/providers returns list of all 5 providers."""
    response = await refiner_client.get("/refiner/providers")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 6
    ids = [p["id"] for p in data]
    assert "anthropic" in ids
    assert "openai" in ids
    assert "groq" in ids
    assert "ollama" in ids
    assert "gemini" in ids
    # Each provider has required fields
    for p in data:
        assert "name" in p
        assert "requires_api_key" in p
        assert "configured" in p


# ============================================================================
# TUT-B049: GET /refiner/providers/{name}/models returns model list
# ============================================================================


@pytest.mark.asyncio
async def test_provider_models_endpoint(refiner_client):
    """TUT-B049: /refiner/providers/{name}/models returns models."""
    response = await refiner_client.get("/refiner/providers/ollama/models")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "id" in data[0]
    assert "name" in data[0]


# ============================================================================
# TUT-B050: GET /refiner/providers/{name}/models returns 400 for unknown
# ============================================================================


@pytest.mark.asyncio
async def test_provider_models_unknown_provider(refiner_client):
    """TUT-B050: /refiner/providers/{name}/models returns 400 for unknown."""
    response = await refiner_client.get("/refiner/providers/nonexistent/models")

    assert response.status_code == 400
    data = response.json()
    assert "Unknown provider" in data["error"]


# ============================================================================
# TUT-B057: GET /refiner/providers/{name}/models with custom config
# ============================================================================


@pytest.mark.asyncio
async def test_provider_models_with_custom_config(test_client, monkeypatch):
    """TUT-B057: Custom models from config are passed to provider.list_models."""
    mock_refiner = Refiner()
    custom = [{"id": "custom-model", "name": "Custom Model"}]
    mock_refiner._provider_models = {"anthropic": custom}

    mock_provider = MagicMock()
    mock_provider.list_models = AsyncMock(return_value=custom)
    mock_provider.is_configured.return_value = True
    mock_provider.get_info.return_value = {"name": "anthropic", "model": "custom-model", "configured": True}
    mock_refiner._providers["anthropic"] = mock_provider

    monkeypatch.setattr("app.refiner_api.get_refiner", lambda: mock_refiner)

    response = await test_client.get("/refiner/providers/anthropic/models")
    assert response.status_code == 200
    data = response.json()
    assert data == custom
    # Verify custom_models kwarg was passed
    mock_provider.list_models.assert_called_once_with(custom_models=custom)


# ============================================================================
# TUT-B058: PUT /refiner/config round-trip preserves provider_models
# ============================================================================


@pytest.mark.asyncio
async def test_config_preserves_provider_models(test_client, monkeypatch):
    """TUT-B058: PUT /refiner/config with provider_models preserves them in get_config."""
    mock_refiner = Refiner()

    mock_provider = MagicMock()
    mock_provider.is_configured.return_value = True
    mock_provider.get_info.return_value = {"name": "ollama", "model": "llama3.2", "configured": True}
    mock_refiner._providers["ollama"] = mock_provider

    monkeypatch.setattr("app.refiner_api.get_refiner", lambda: mock_refiner)
    # Prevent file I/O
    monkeypatch.setattr(mock_refiner, "_save_persistent_config", lambda: None)

    custom = {"anthropic": [{"id": "my-claude", "name": "My Claude"}]}
    response = await test_client.put(
        "/refiner/config",
        json={"provider_models": custom},
    )
    assert response.status_code == 200
    data = response.json()
    assert "provider_models" in data
    assert data["provider_models"]["anthropic"] == custom["anthropic"]


# ============================================================================
# TUT-B059: GET /refiner/providers/{name}/test-connection returns result
# ============================================================================


@pytest.mark.asyncio
async def test_provider_test_connection_success(test_client, monkeypatch):
    """TUT-B059: /refiner/providers/{name}/test-connection returns ok result."""
    mock_refiner = Refiner()

    mock_provider = MagicMock()
    mock_provider.test_connection = AsyncMock(
        return_value={"ok": True, "latency_ms": 42.0, "message": "Connected. 5 model(s) available."}
    )
    mock_provider.is_configured.return_value = True
    mock_provider.get_info.return_value = {"name": "ollama", "model": "llama3.2", "configured": True}
    mock_refiner._providers["ollama"] = mock_provider

    monkeypatch.setattr("app.refiner_api.get_refiner", lambda: mock_refiner)

    response = await test_client.get("/refiner/providers/ollama/test-connection")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["latency_ms"] == 42.0
    assert "Connected" in data["message"]


# ============================================================================
# TUT-B060: GET /refiner/providers/{name}/test-connection returns 400 for unknown
# ============================================================================


@pytest.mark.asyncio
async def test_provider_test_connection_unknown(test_client):
    """TUT-B060: /refiner/providers/{name}/test-connection returns 400 for unknown provider."""
    response = await test_client.get("/refiner/providers/nonexistent/test-connection")
    assert response.status_code == 400
    data = response.json()
    assert "Unknown provider" in data["error"]
