"""
Integration Backend Protocol for BACON-AI Voice Backend

Defines the interface that integration backends must implement.
Phase C will add concrete implementations (Claude, MCP, etc.).
"""

from typing import Any, Dict, Protocol, runtime_checkable


@runtime_checkable
class IntegrationBackend(Protocol):
    """
    Protocol for integration backends that receive transcribed text.

    Implementations might send text to Claude API, MCP servers,
    terminal input, or other destinations.
    """

    async def send(self, text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send transcribed text to the integration target.

        Args:
            text: The transcribed text to send.
            metadata: Additional context (language, confidence, duration, etc.).

        Returns:
            Dict with at least {"success": bool, "message": str}.
        """
        ...
