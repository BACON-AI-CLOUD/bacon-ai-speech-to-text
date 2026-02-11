"""
FEAT-008: MCP Server Integration (Lightweight Stub)

Provides a file-based exchange mechanism so that a separate MCP tool
process can read transcribed text written by the voice backend.

Exchange protocol:
    1. Backend writes transcribed text to ``/tmp/bacon-voice-input.txt``.
    2. An external MCP tool reads that file.
    3. The MCP tool writes its response to ``/tmp/bacon-voice-output.txt``.

This is intentionally simple for v1.0. A future version will use
proper MCP server IPC.
"""

import logging
import time
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

DEFAULT_INPUT_PATH = Path("/tmp/bacon-voice-input.txt")
DEFAULT_OUTPUT_PATH = Path("/tmp/bacon-voice-output.txt")


class MCPServerBackend:
    """
    Integration backend that communicates via the filesystem.

    Writes the transcribed text to an input file and, optionally,
    waits for an output file written by an MCP tool process.
    """

    def __init__(
        self,
        input_path: Optional[Path] = None,
        output_path: Optional[Path] = None,
        wait_for_response: bool = False,
        response_timeout: float = 10.0,
    ):
        """
        Args:
            input_path: File path where transcribed text is written.
            output_path: File path where the MCP tool writes its response.
            wait_for_response: If True, poll for the output file after writing.
            response_timeout: Seconds to wait when polling for a response.
        """
        self._input_path = input_path or DEFAULT_INPUT_PATH
        self._output_path = output_path or DEFAULT_OUTPUT_PATH
        self._wait_for_response = wait_for_response
        self._response_timeout = response_timeout

    async def send(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Write transcribed text to the exchange file.

        Args:
            text: The transcribed text to send.
            metadata: Additional context (included as header in the file).

        Returns:
            Dict with success status and acknowledgment message.
        """
        if metadata is None:
            metadata = {}

        try:
            # Build file content with optional metadata header
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
            lines = [
                f"# BACON-AI Voice Transcription",
                f"# Timestamp: {timestamp}",
            ]

            confidence = metadata.get("confidence")
            if confidence is not None:
                lines.append(f"# Confidence: {confidence}")

            language = metadata.get("language")
            if language:
                lines.append(f"# Language: {language}")

            lines.append("")
            lines.append(text)
            lines.append("")

            content = "\n".join(lines)
            self._input_path.write_text(content, encoding="utf-8")

            logger.info(
                "MCP exchange: wrote %d chars to %s",
                len(content),
                self._input_path,
            )

            result: Dict[str, Any] = {
                "success": True,
                "message": f"Text written to {self._input_path}",
                "response": "",
                "input_path": str(self._input_path),
            }

            # Optionally wait for a response from the MCP tool
            if self._wait_for_response:
                response_text = self._poll_response()
                if response_text is not None:
                    result["response"] = response_text
                    result["message"] = "Response received from MCP tool"
                else:
                    result["message"] = (
                        f"Text written but no MCP response within "
                        f"{self._response_timeout}s"
                    )

            return result

        except OSError as e:
            logger.error("MCP exchange write error: %s", e)
            return {
                "success": False,
                "message": f"Failed to write exchange file: {e}",
                "response": "",
            }

    def _poll_response(self) -> Optional[str]:
        """
        Poll for a response file written by the MCP tool.

        Returns the file contents if found within timeout, else None.
        """
        # Remove stale output file before polling
        if self._output_path.exists():
            try:
                self._output_path.unlink()
            except OSError:
                pass

        deadline = time.monotonic() + self._response_timeout
        poll_interval = 0.25

        while time.monotonic() < deadline:
            if self._output_path.exists():
                try:
                    content = self._output_path.read_text(encoding="utf-8").strip()
                    if content:
                        logger.info(
                            "MCP exchange: read %d chars from %s",
                            len(content),
                            self._output_path,
                        )
                        return content
                except OSError:
                    pass
            time.sleep(poll_interval)

        return None
