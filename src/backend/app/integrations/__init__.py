"""
BACON-AI Voice Backend - Integration Backends

Provides backends for routing transcribed text to external services:
    - ClaudeAPIBackend  (FEAT-006): Direct Anthropic API calls
    - WebSocketBridgeBackend (FEAT-007): Claude Code subprocess bridge
    - MCPServerBackend  (FEAT-008): File-based MCP tool exchange
    - IntegrationRouter: Routes to the correct backend by name
"""

from .base import IntegrationBackend
from .claude_api import ClaudeAPIBackend
from .mcp_server import MCPServerBackend
from .router import IntegrationRouter, get_router
from .ws_bridge import WebSocketBridgeBackend

__all__ = [
    "IntegrationBackend",
    "ClaudeAPIBackend",
    "WebSocketBridgeBackend",
    "MCPServerBackend",
    "IntegrationRouter",
    "get_router",
]
