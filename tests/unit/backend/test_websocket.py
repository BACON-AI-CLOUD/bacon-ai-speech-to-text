"""
Tests for WebSocket /ws/audio endpoint.

Uses Starlette's TestClient for WebSocket testing since httpx_ws
does not support ASGITransport-based WebSocket connections.
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from starlette.testclient import TestClient

backend_src = Path(__file__).resolve().parents[3] / "src" / "backend"
if str(backend_src) not in sys.path:
    sys.path.insert(0, str(backend_src))


@pytest.fixture()
def ws_test_client(mock_whisper_model, monkeypatch):
    """Create a Starlette TestClient (sync) for WebSocket testing."""
    import app.stt.whisper_engine as engine_mod

    engine_mod._engine_instance = None

    from app.main import app

    return TestClient(app)


def test_websocket_connect_and_receive_ready(ws_test_client):
    """WebSocket should accept connection and send 'ready' status."""
    with ws_test_client.websocket_connect("/ws/audio") as ws:
        data = ws.receive_json()
        assert data["type"] == "status"
        assert data["state"] == "ready"


def test_websocket_start_recording(ws_test_client):
    """Sending 'start' should switch state to 'recording'."""
    with ws_test_client.websocket_connect("/ws/audio") as ws:
        ws.receive_json()  # ready

        ws.send_json({"type": "start"})
        data = ws.receive_json()
        assert data["type"] == "status"
        assert data["state"] == "recording"


def test_websocket_cancel(ws_test_client):
    """Sending 'cancel' should return to ready state."""
    with ws_test_client.websocket_connect("/ws/audio") as ws:
        ws.receive_json()  # ready

        ws.send_json({"type": "start"})
        ws.receive_json()  # recording

        ws.send_json({"type": "cancel"})
        data = ws.receive_json()
        assert data["type"] == "status"
        assert data["state"] == "ready"


def test_websocket_stop_without_audio(ws_test_client):
    """Sending 'stop' with no audio chunks should return an error."""
    with ws_test_client.websocket_connect("/ws/audio") as ws:
        ws.receive_json()  # ready

        ws.send_json({"type": "start"})
        ws.receive_json()  # recording

        ws.send_json({"type": "stop"})
        # Should get processing status
        data = ws.receive_json()
        assert data["type"] == "status"
        assert data["state"] == "processing"

        # Should get error (no audio)
        data = ws.receive_json()
        assert data["type"] == "error"

        # Should get ready again
        data = ws.receive_json()
        assert data["type"] == "status"
        assert data["state"] == "ready"


def test_websocket_full_flow(ws_test_client, test_wav_bytes):
    """Full WebSocket flow: start -> send audio -> stop -> receive result."""
    with ws_test_client.websocket_connect("/ws/audio") as ws:
        ws.receive_json()  # ready

        # Start recording
        ws.send_json({"type": "start"})
        ws.receive_json()  # recording

        # Send audio chunk as binary
        ws.send_bytes(test_wav_bytes)

        # Stop recording
        ws.send_json({"type": "stop"})

        # Should get processing
        data = ws.receive_json()
        assert data["type"] == "status"
        assert data["state"] == "processing"

        # Should get result
        data = ws.receive_json()
        assert data["type"] == "result"
        assert "text" in data
        assert "confidence" in data
        assert "language" in data

        # Should get ready
        data = ws.receive_json()
        assert data["type"] == "status"
        assert data["state"] == "ready"


def test_websocket_invalid_json(ws_test_client):
    """Sending invalid JSON should return an error."""
    with ws_test_client.websocket_connect("/ws/audio") as ws:
        ws.receive_json()  # ready

        ws.send_text("not valid json{{{")
        data = ws.receive_json()
        assert data["type"] == "error"
        assert "Invalid JSON" in data["message"]
