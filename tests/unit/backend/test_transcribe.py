"""
Tests for POST /transcribe endpoint.
"""

import io

import pytest


@pytest.mark.asyncio
async def test_transcribe_with_wav(test_client, test_wav_bytes):
    """POST /transcribe with a WAV file should return transcription result."""
    files = {"file": ("test.wav", io.BytesIO(test_wav_bytes), "audio/wav")}
    response = await test_client.post("/transcribe", files=files)

    assert response.status_code == 200

    data = response.json()
    assert "text" in data
    assert "confidence" in data
    assert "language" in data
    assert "duration" in data
    assert "segments" in data
    assert "model_used" in data
    assert "processing_time" in data


@pytest.mark.asyncio
async def test_transcribe_returns_text(test_client, test_wav_bytes):
    """Transcription result should contain non-empty text from mock."""
    files = {"file": ("test.wav", io.BytesIO(test_wav_bytes), "audio/wav")}
    response = await test_client.post("/transcribe", files=files)

    data = response.json()
    # Mock returns "Hello world"
    assert "Hello world" in data["text"]
    assert data["language"] == "en"


@pytest.mark.asyncio
async def test_transcribe_empty_file_returns_400(test_client):
    """POST /transcribe with an empty file should return 400."""
    files = {"file": ("empty.wav", io.BytesIO(b""), "audio/wav")}
    response = await test_client.post("/transcribe", files=files)

    assert response.status_code == 400
    data = response.json()
    assert "error" in data
