"""
Tests for GET /health endpoint.
"""

import pytest


@pytest.mark.asyncio
async def test_health_returns_200(test_client):
    """GET /health should return 200 with status, gpu_info, model_info, version."""
    response = await test_client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert "gpu_info" in data
    assert "model_info" in data
    assert "server_version" in data


@pytest.mark.asyncio
async def test_health_gpu_info_structure(test_client):
    """GPU info should contain expected keys."""
    response = await test_client.get("/health")
    data = response.json()

    gpu = data["gpu_info"]
    assert "available" in gpu
    assert "type" in gpu
    assert "name" in gpu
    assert "vram_mb" in gpu


@pytest.mark.asyncio
async def test_health_model_info_structure(test_client):
    """Model info should contain expected keys."""
    response = await test_client.get("/health")
    data = response.json()

    model = data["model_info"]
    assert "loaded" in model
    assert "current" in model
    assert "target" in model
    assert "device" in model
    assert "compute_type" in model
