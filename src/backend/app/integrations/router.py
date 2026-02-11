"""
Integration Router for BACON-AI Voice Backend

Routes messages to the correct integration backend based on a
backend name string. Backends are lazily initialised on first use.
"""

import logging
from typing import Any, Dict, List, Optional

from .claude_api import ClaudeAPIBackend
from .mcp_server import MCPServerBackend
from .ws_bridge import WebSocketBridgeBackend

logger = logging.getLogger(__name__)

# Registry of supported backend names
SUPPORTED_BACKENDS = ("claude-api", "ws-bridge", "mcp-server")


class IntegrationRouter:
    """
    Routes messages to the selected integration backend.

    Backends are created lazily when first requested and reused
    for subsequent calls.
    """

    def __init__(self):
        self._backends: Dict[str, Any] = {}
        self._active_backend: str = "claude-api"

    @property
    def active_backend(self) -> str:
        """Return the name of the currently active backend."""
        return self._active_backend

    @active_backend.setter
    def active_backend(self, name: str) -> None:
        if name not in SUPPORTED_BACKENDS:
            raise ValueError(
                f"Unknown backend: {name}. "
                f"Supported: {', '.join(SUPPORTED_BACKENDS)}"
            )
        self._active_backend = name

    def list_backends(self) -> List[str]:
        """Return the list of supported backend names."""
        return list(SUPPORTED_BACKENDS)

    def _get_backend(self, name: str):
        """
        Return the backend instance for *name*, creating it if needed.

        Raises ValueError for unknown backend names.
        """
        if name not in SUPPORTED_BACKENDS:
            raise ValueError(
                f"Unknown backend: {name}. "
                f"Supported: {', '.join(SUPPORTED_BACKENDS)}"
            )

        if name not in self._backends:
            logger.info("Initialising integration backend: %s", name)
            if name == "claude-api":
                self._backends[name] = ClaudeAPIBackend()
            elif name == "ws-bridge":
                self._backends[name] = WebSocketBridgeBackend()
            elif name == "mcp-server":
                self._backends[name] = MCPServerBackend()

        return self._backends[name]

    async def send(
        self,
        text: str,
        backend: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send text to the specified (or active) backend.

        Args:
            text: The transcribed text to send.
            backend: Backend name. Defaults to ``active_backend``.
            metadata: Additional context forwarded to the backend.

        Returns:
            Dict with at least ``success``, ``message``, and ``backend`` keys.
        """
        if metadata is None:
            metadata = {}

        target = backend or self._active_backend

        try:
            backend_instance = self._get_backend(target)
        except ValueError as e:
            return {
                "success": False,
                "message": str(e),
                "backend": target,
                "response": "",
            }

        result = await backend_instance.send(text, metadata)
        result["backend"] = target
        return result


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_router_instance: Optional[IntegrationRouter] = None


def get_router() -> IntegrationRouter:
    """Return the module-level IntegrationRouter singleton."""
    global _router_instance
    if _router_instance is None:
        _router_instance = IntegrationRouter()
    return _router_instance
