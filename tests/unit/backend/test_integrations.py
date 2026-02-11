"""
Unit tests for BACON-AI Voice Backend Integration Backends.

Test IDs:
    TUT-B009: IntegrationRouter routes to correct backend
    TUT-B010: ClaudeAPIBackend sends message (mock Anthropic client)
    TUT-B011: Router returns error for unknown backend
    TUT-B012: ClaudeAPIBackend without API key returns error
    TUT-B013: WebSocketBridgeBackend with mock subprocess
    TUT-B014: MCPServerBackend writes exchange file
    TUT-B015: IntegrationRouter list_backends returns all names
    TUT-B016: ClaudeAPIBackend conversation history management
"""

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ensure backend source is importable
backend_src = Path(__file__).resolve().parents[3] / "src" / "backend"
if str(backend_src) not in sys.path:
    sys.path.insert(0, str(backend_src))

from app.integrations.claude_api import ClaudeAPIBackend
from app.integrations.mcp_server import MCPServerBackend
from app.integrations.router import IntegrationRouter
from app.integrations.ws_bridge import WebSocketBridgeBackend


# ============================================================================
# Helpers
# ============================================================================


def _make_mock_anthropic_response(
    text: str = "Hello from Claude",
    model: str = "claude-sonnet-4-5-20250929",
    input_tokens: int = 10,
    output_tokens: int = 25,
):
    """Build a mock Anthropic messages.create() response object."""
    content_block = SimpleNamespace(text=text)
    usage = SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens)
    return SimpleNamespace(
        content=[content_block],
        model=model,
        usage=usage,
    )


# ============================================================================
# TUT-B009: IntegrationRouter routes to correct backend
# ============================================================================


@pytest.mark.asyncio
async def test_router_routes_to_claude_api():
    """TUT-B009a: Router dispatches to claude-api backend."""
    router = IntegrationRouter()

    # Inject a mock backend
    mock_backend = MagicMock()
    mock_backend.send = AsyncMock(
        return_value={"success": True, "message": "ok", "response": "mocked"}
    )
    router._backends["claude-api"] = mock_backend

    result = await router.send("Hello", backend="claude-api")

    mock_backend.send.assert_awaited_once_with("Hello", {})
    assert result["success"] is True
    assert result["backend"] == "claude-api"


@pytest.mark.asyncio
async def test_router_routes_to_ws_bridge():
    """TUT-B009b: Router dispatches to ws-bridge backend."""
    router = IntegrationRouter()

    mock_backend = MagicMock()
    mock_backend.send = AsyncMock(
        return_value={"success": True, "message": "ok", "response": "bridged"}
    )
    router._backends["ws-bridge"] = mock_backend

    result = await router.send("Test input", backend="ws-bridge")

    mock_backend.send.assert_awaited_once_with("Test input", {})
    assert result["success"] is True
    assert result["backend"] == "ws-bridge"


@pytest.mark.asyncio
async def test_router_routes_to_mcp_server():
    """TUT-B009c: Router dispatches to mcp-server backend."""
    router = IntegrationRouter()

    mock_backend = MagicMock()
    mock_backend.send = AsyncMock(
        return_value={"success": True, "message": "ok", "response": ""}
    )
    router._backends["mcp-server"] = mock_backend

    result = await router.send("Transcribed text", backend="mcp-server")

    mock_backend.send.assert_awaited_once_with("Transcribed text", {})
    assert result["success"] is True
    assert result["backend"] == "mcp-server"


@pytest.mark.asyncio
async def test_router_uses_active_backend_when_none_specified():
    """TUT-B009d: Router falls back to active_backend when backend is None."""
    router = IntegrationRouter()
    router._active_backend = "mcp-server"

    mock_backend = MagicMock()
    mock_backend.send = AsyncMock(
        return_value={"success": True, "message": "ok", "response": ""}
    )
    router._backends["mcp-server"] = mock_backend

    result = await router.send("Some text")

    mock_backend.send.assert_awaited_once()
    assert result["backend"] == "mcp-server"


# ============================================================================
# TUT-B010: ClaudeAPIBackend sends message (mock Anthropic client)
# ============================================================================


@pytest.mark.asyncio
async def test_claude_api_sends_message():
    """TUT-B010: ClaudeAPIBackend calls Anthropic SDK and returns response."""
    backend = ClaudeAPIBackend(api_key="test-key-12345")

    mock_response = _make_mock_anthropic_response(
        text="I am Claude, nice to meet you!",
        model="claude-sonnet-4-5-20250929",
        input_tokens=15,
        output_tokens=30,
    )

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    backend._client = mock_client

    result = await backend.send("Hello Claude!")

    assert result["success"] is True
    assert result["response"] == "I am Claude, nice to meet you!"
    assert result["model"] == "claude-sonnet-4-5-20250929"
    assert result["usage"]["input_tokens"] == 15
    assert result["usage"]["output_tokens"] == 30

    # Verify SDK was called with correct parameters
    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args
    assert call_kwargs.kwargs["model"] == "claude-sonnet-4-5-20250929"
    assert len(call_kwargs.kwargs["messages"]) == 1
    assert call_kwargs.kwargs["messages"][0]["content"] == "Hello Claude!"


# ============================================================================
# TUT-B011: Router returns error for unknown backend
# ============================================================================


@pytest.mark.asyncio
async def test_router_unknown_backend_returns_error():
    """TUT-B011: Router returns error dict for an unregistered backend name."""
    router = IntegrationRouter()

    result = await router.send("text", backend="nonexistent-backend")

    assert result["success"] is False
    assert "Unknown backend" in result["message"]
    assert result["backend"] == "nonexistent-backend"


# ============================================================================
# TUT-B012: ClaudeAPIBackend without API key returns error
# ============================================================================


@pytest.mark.asyncio
async def test_claude_api_no_key_returns_error():
    """TUT-B012: ClaudeAPIBackend returns error when no API key is configured."""
    # Make sure env var is not set for this test
    with patch.dict("os.environ", {}, clear=True):
        backend = ClaudeAPIBackend(api_key=None)

    result = await backend.send("Hello?")

    assert result["success"] is False
    assert "not configured" in result["message"]
    assert result["response"] == ""


def test_claude_api_is_configured_property():
    """TUT-B012b: is_configured returns False without key, True with key."""
    backend_no_key = ClaudeAPIBackend(api_key=None)
    # Explicitly clear the attribute since env var might be set
    backend_no_key._api_key = None
    assert backend_no_key.is_configured is False

    backend_with_key = ClaudeAPIBackend(api_key="sk-test")
    assert backend_with_key.is_configured is True


# ============================================================================
# TUT-B013: WebSocketBridgeBackend with mock subprocess
# ============================================================================


@pytest.mark.asyncio
async def test_ws_bridge_sends_via_subprocess():
    """TUT-B013a: WebSocketBridgeBackend sends text via claude --print subprocess."""
    backend = WebSocketBridgeBackend(claude_path="/usr/bin/claude")

    mock_process = AsyncMock()
    mock_process.communicate.return_value = (
        b"Response from Claude Code",
        b"",
    )
    mock_process.returncode = 0

    with patch("asyncio.create_subprocess_exec", return_value=mock_process) as mock_exec:
        result = await backend.send("What is 2+2?")

    assert result["success"] is True
    assert result["response"] == "Response from Claude Code"

    # Verify subprocess was called correctly
    mock_exec.assert_awaited_once()
    args = mock_exec.call_args
    assert args[0][0] == "/usr/bin/claude"
    assert args[0][1] == "--print"


@pytest.mark.asyncio
async def test_ws_bridge_not_found():
    """TUT-B013b: WebSocketBridgeBackend returns error when claude CLI is missing."""
    backend = WebSocketBridgeBackend(claude_path=None)

    with patch("app.integrations.ws_bridge.shutil.which", return_value=None):
        # Reset to sentinel so _resolve_path runs again with mocked shutil.which
        backend._resolved_path = WebSocketBridgeBackend._NOT_RESOLVED
        result = await backend.send("Hello")

    assert result["success"] is False
    assert "not found" in result["message"].lower()


@pytest.mark.asyncio
async def test_ws_bridge_nonzero_exit():
    """TUT-B013c: WebSocketBridgeBackend handles non-zero exit code."""
    backend = WebSocketBridgeBackend(claude_path="/usr/bin/claude")

    mock_process = AsyncMock()
    mock_process.communicate.return_value = (
        b"",
        b"Error: something went wrong",
    )
    mock_process.returncode = 1

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await backend.send("Bad input")

    assert result["success"] is False
    assert "exit 1" in result["message"]


# ============================================================================
# TUT-B014: MCPServerBackend writes exchange file
# ============================================================================


@pytest.mark.asyncio
async def test_mcp_server_writes_file(tmp_path):
    """TUT-B014a: MCPServerBackend writes transcribed text to exchange file."""
    input_file = tmp_path / "voice-input.txt"
    output_file = tmp_path / "voice-output.txt"

    backend = MCPServerBackend(
        input_path=input_file,
        output_path=output_file,
        wait_for_response=False,
    )

    result = await backend.send(
        "Hello from voice",
        metadata={"confidence": 0.95, "language": "en"},
    )

    assert result["success"] is True
    assert input_file.exists()

    content = input_file.read_text(encoding="utf-8")
    assert "Hello from voice" in content
    assert "Confidence: 0.95" in content
    assert "Language: en" in content


@pytest.mark.asyncio
async def test_mcp_server_returns_path(tmp_path):
    """TUT-B014b: MCPServerBackend includes file path in response."""
    input_file = tmp_path / "input.txt"
    backend = MCPServerBackend(input_path=input_file, wait_for_response=False)

    result = await backend.send("test")

    assert result["success"] is True
    assert str(input_file) in result["input_path"]


# ============================================================================
# TUT-B015: IntegrationRouter list_backends returns all names
# ============================================================================


def test_router_list_backends():
    """TUT-B015: list_backends returns all three supported backend names."""
    router = IntegrationRouter()
    backends = router.list_backends()

    assert "claude-api" in backends
    assert "ws-bridge" in backends
    assert "mcp-server" in backends
    assert len(backends) == 3


def test_router_active_backend_default():
    """TUT-B015b: Default active backend is claude-api."""
    router = IntegrationRouter()
    assert router.active_backend == "claude-api"


def test_router_set_active_backend():
    """TUT-B015c: active_backend setter validates names."""
    router = IntegrationRouter()

    router.active_backend = "ws-bridge"
    assert router.active_backend == "ws-bridge"

    with pytest.raises(ValueError, match="Unknown backend"):
        router.active_backend = "invalid-backend"


# ============================================================================
# TUT-B016: ClaudeAPIBackend conversation history management
# ============================================================================


@pytest.mark.asyncio
async def test_claude_api_maintains_history():
    """TUT-B016a: ClaudeAPIBackend keeps conversation history across calls."""
    backend = ClaudeAPIBackend(api_key="test-key")

    mock_response = _make_mock_anthropic_response(text="Answer 1")
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    backend._client = mock_client

    await backend.send("Question 1")

    assert len(backend._conversation_history) == 2  # user + assistant
    assert backend._conversation_history[0]["role"] == "user"
    assert backend._conversation_history[0]["content"] == "Question 1"
    assert backend._conversation_history[1]["role"] == "assistant"
    assert backend._conversation_history[1]["content"] == "Answer 1"

    # Second message should include history
    mock_response2 = _make_mock_anthropic_response(text="Answer 2")
    mock_client.messages.create.return_value = mock_response2

    await backend.send("Question 2")

    assert len(backend._conversation_history) == 4  # 2 user + 2 assistant
    # Check the messages list passed to the API
    last_call = mock_client.messages.create.call_args
    assert len(last_call.kwargs["messages"]) == 3  # 2 history + 1 new


@pytest.mark.asyncio
async def test_claude_api_clear_history():
    """TUT-B016b: clear_history empties the conversation buffer."""
    backend = ClaudeAPIBackend(api_key="test-key")
    backend._conversation_history = [
        {"role": "user", "content": "old"},
        {"role": "assistant", "content": "old response"},
    ]

    backend.clear_history()

    assert len(backend._conversation_history) == 0


@pytest.mark.asyncio
async def test_claude_api_error_removes_failed_message():
    """TUT-B016c: On API error, user message is removed from history for retry."""
    backend = ClaudeAPIBackend(api_key="test-key")

    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("API timeout")
    backend._client = mock_client

    result = await backend.send("This will fail")

    assert result["success"] is False
    assert len(backend._conversation_history) == 0  # failed msg removed


@pytest.mark.asyncio
async def test_claude_api_per_request_overrides():
    """TUT-B016d: Metadata overrides model, system_prompt, max_tokens."""
    backend = ClaudeAPIBackend(api_key="test-key")

    mock_response = _make_mock_anthropic_response(text="Custom response")
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    backend._client = mock_client

    await backend.send(
        "Hello",
        metadata={
            "model": "claude-opus-4-5-20250514",
            "system_prompt": "You are a pirate",
            "max_tokens": 1024,
        },
    )

    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-opus-4-5-20250514"
    assert call_kwargs["system"] == "You are a pirate"
    assert call_kwargs["max_tokens"] == 1024
