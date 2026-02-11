"""
Pytest fixtures for BACON-AI Voice Backend unit tests.

Provides a FastAPI test client, mock Whisper engine, and test audio data.
"""

import io
import struct
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

import pytest

# Add backend source to path
backend_src = Path(__file__).resolve().parents[3] / "src" / "backend"
if str(backend_src) not in sys.path:
    sys.path.insert(0, str(backend_src))


# ============================================================================
# Mock Whisper Segment and Info
# ============================================================================


class MockSegment:
    """Mock Faster-Whisper transcription segment."""

    def __init__(
        self,
        start: float = 0.0,
        end: float = 1.0,
        text: str = " Hello world",
        avg_logprob: float = -0.2,
        no_speech_prob: float = 0.01,
    ):
        self.start = start
        self.end = end
        self.text = text
        self.avg_logprob = avg_logprob
        self.no_speech_prob = no_speech_prob


class MockTranscribeInfo:
    """Mock Faster-Whisper transcription info."""

    def __init__(
        self,
        language: str = "en",
        duration: float = 1.5,
    ):
        self.language = language
        self.duration = duration


# ============================================================================
# Mock WhisperModel
# ============================================================================


class MockWhisperModel:
    """Mock for faster_whisper.WhisperModel."""

    def __init__(self, *args, **kwargs):
        self._transcribe_result = (
            [MockSegment()],
            MockTranscribeInfo(),
        )

    def transcribe(self, audio_input, **kwargs):
        segments, info = self._transcribe_result
        return iter(segments), info


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture(autouse=True)
def mock_gpu_detection(monkeypatch):
    """Mock GPU detection to avoid hardware dependency in tests."""
    mock_gpu_info = {
        "gpu_available": False,
        "gpu_type": None,
        "gpu_name": None,
        "vram_mb": 0,
        "compute_type": "int8",
        "recommended_model": "base",
    }
    monkeypatch.setattr(
        "app.config.detect_gpu",
        lambda: mock_gpu_info,
    )
    # Also patch the import in whisper_engine
    monkeypatch.setattr(
        "app.stt.whisper_engine.detect_gpu",
        lambda: mock_gpu_info,
    )


@pytest.fixture()
def mock_whisper_model(monkeypatch):
    """
    Provide a mock WhisperModel that returns canned transcription results.

    This patches the faster_whisper import inside the engine so no real
    model loading occurs.
    """
    mock_module = MagicMock()
    mock_module.WhisperModel = MockWhisperModel
    monkeypatch.setitem(sys.modules, "faster_whisper", mock_module)
    return MockWhisperModel


@pytest.fixture()
def engine_with_mock(mock_whisper_model, monkeypatch):
    """Create a WhisperEngine with mocked model loading."""
    # Reset the singleton
    import app.stt.whisper_engine as engine_mod

    engine_mod._engine_instance = None

    engine = engine_mod.get_engine(model_name="base", force_new=True)
    return engine


@pytest.fixture()
def test_client(mock_whisper_model, monkeypatch):
    """Create a FastAPI TestClient with mocked dependencies."""
    # Reset engine singleton before creating test client
    import app.stt.whisper_engine as engine_mod

    engine_mod._engine_instance = None

    from httpx import ASGITransport, AsyncClient

    from app.main import app

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver")


@pytest.fixture()
def test_wav_bytes() -> bytes:
    """
    Create a minimal valid WAV file (16kHz mono, 0.5s silence).

    This is generated programmatically -- no external audio files needed.
    """
    sample_rate = 16000
    duration_seconds = 0.5
    num_samples = int(sample_rate * duration_seconds)
    # 16-bit PCM silence
    samples = b"\x00\x00" * num_samples

    data_size = len(samples)
    buf = io.BytesIO()
    # RIFF header
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    # fmt chunk
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<H", 1))  # PCM
    buf.write(struct.pack("<H", 1))  # mono
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * 2))
    buf.write(struct.pack("<H", 2))  # block align
    buf.write(struct.pack("<H", 16))  # bits per sample
    # data chunk
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(samples)

    buf.seek(0)
    return buf.read()
