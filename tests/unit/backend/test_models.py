"""
Tests for GET /models and POST /models/{name}/load endpoints.
"""

import pytest


@pytest.mark.asyncio
async def test_models_returns_200(test_client):
    """GET /models should return 200 with model list."""
    response = await test_client.get("/models")
    assert response.status_code == 200

    data = response.json()
    assert "models" in data
    assert "current" in data
    assert "gpu" in data


@pytest.mark.asyncio
async def test_models_contains_all_known_models(test_client):
    """Model list should contain all five known Whisper models."""
    response = await test_client.get("/models")
    data = response.json()

    model_names = [m["name"] for m in data["models"]]
    for expected in ["tiny", "base", "small", "medium", "large-v3"]:
        assert expected in model_names, f"Missing model: {expected}"


@pytest.mark.asyncio
async def test_model_entry_structure(test_client):
    """Each model entry should have required fields."""
    response = await test_client.get("/models")
    data = response.json()

    for model in data["models"]:
        assert "name" in model
        assert "size_mb" in model
        assert "loaded" in model
        assert "accuracy_est" in model


@pytest.mark.asyncio
async def test_load_unknown_model_returns_400(test_client):
    """POST /models/nonexistent/load should return 400."""
    response = await test_client.post("/models/nonexistent/load")
    assert response.status_code == 400

    data = response.json()
    assert "error" in data
    assert "available" in data


@pytest.mark.asyncio
async def test_load_valid_model(test_client):
    """POST /models/base/load should attempt to load and return status."""
    response = await test_client.post("/models/base/load")
    # With mock, this should succeed
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "loaded"
    assert data["model"] == "base"
