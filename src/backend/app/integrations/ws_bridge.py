"""
FEAT-007: WebSocket Bridge to Claude Code

Sends transcribed text to Claude Code via subprocess using
``claude --print`` in stdin/stdout mode. This is the v1.0
approach -- simpler than the full --sdk-url NDJSON protocol.
"""

import asyncio
import logging
import shutil
from typing import Any, Dict, Optional, Union

logger = logging.getLogger(__name__)


class WebSocketBridgeBackend:
    """
    Integration backend that bridges to Claude Code via subprocess.

    Uses ``claude --print`` which accepts a prompt on stdin and
    writes the response to stdout, making it suitable for
    single-turn interactions.
    """

    # Sentinel indicating _resolve_path has not been called yet
    _NOT_RESOLVED = object()

    def __init__(self, claude_path: Optional[str] = None, timeout: float = 120.0):
        """
        Args:
            claude_path: Explicit path to the ``claude`` binary.
                         If *None*, resolved via ``shutil.which``.
            timeout: Maximum seconds to wait for a Claude Code response.
        """
        self._claude_path = claude_path
        self._timeout = timeout
        self._resolved_path: Any = self._NOT_RESOLVED

    @property
    def is_available(self) -> bool:
        """Return True when the claude CLI can be located on the system."""
        return self._resolve_path() is not None

    def _resolve_path(self) -> Optional[str]:
        """Locate the claude CLI binary, caching the result."""
        if self._resolved_path is not self._NOT_RESOLVED:
            return self._resolved_path

        if self._claude_path:
            self._resolved_path = self._claude_path
        else:
            self._resolved_path = shutil.which("claude")

        if self._resolved_path:
            logger.info("Claude CLI found at %s", self._resolved_path)
        else:
            logger.warning("Claude CLI not found in PATH")

        return self._resolved_path

    async def send(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Send transcribed text to Claude Code and return the response.

        Spawns ``claude --print`` as a subprocess, pipes *text* to its
        stdin, and reads the complete response from stdout.

        Args:
            text: The transcribed text to send.
            metadata: Additional context (unused for now).

        Returns:
            Dict with success status, the response text, and backend name.
        """
        if metadata is None:
            metadata = {}

        claude_bin = self._resolve_path()
        if not claude_bin:
            return {
                "success": False,
                "message": (
                    "Claude CLI not found. Install Claude Code or "
                    "provide the path via claude_path parameter."
                ),
                "response": "",
            }

        try:
            process = await asyncio.create_subprocess_exec(
                claude_bin,
                "--print",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(input=text.encode("utf-8")),
                timeout=self._timeout,
            )

            stdout_text = stdout_bytes.decode("utf-8", errors="replace").strip()
            stderr_text = stderr_bytes.decode("utf-8", errors="replace").strip()

            if process.returncode != 0:
                logger.error(
                    "Claude CLI exited with code %d: %s",
                    process.returncode,
                    stderr_text,
                )
                return {
                    "success": False,
                    "message": f"Claude CLI error (exit {process.returncode}): {stderr_text}",
                    "response": stdout_text,
                }

            logger.info(
                "Claude CLI response received (%d chars)", len(stdout_text)
            )

            return {
                "success": True,
                "message": "Response received from Claude Code",
                "response": stdout_text,
            }

        except asyncio.TimeoutError:
            logger.error("Claude CLI timed out after %.0fs", self._timeout)
            return {
                "success": False,
                "message": f"Claude CLI timed out after {self._timeout}s",
                "response": "",
            }
        except FileNotFoundError:
            logger.error("Claude CLI binary not found at %s", claude_bin)
            return {
                "success": False,
                "message": f"Claude CLI binary not found at {claude_bin}",
                "response": "",
            }
        except Exception as e:
            logger.error("WebSocket bridge error: %s", e)
            return {
                "success": False,
                "message": f"WebSocket bridge error: {e}",
                "response": "",
            }
