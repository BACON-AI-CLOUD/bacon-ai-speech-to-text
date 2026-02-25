"""
Claude Code CLI refiner provider for BACON-AI Voice Backend.

Uses the `claude --print` subprocess to leverage an existing Claude
Max/Pro subscription for text refinement - zero API costs.

Based on the claude-code-wrapper skill and Odoo AI provider pattern.
"""

import asyncio
import logging
import os
import shutil
import time
from typing import Any, Dict, Optional

from .base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)

# Model aliases accepted by `claude --model`
AVAILABLE_MODELS = [
    {"id": "sonnet", "name": "Claude Sonnet (default)"},
    {"id": "opus", "name": "Claude Opus"},
    {"id": "haiku", "name": "Claude Haiku"},
]

DEFAULT_MODEL = "sonnet"


def _find_claude_cli() -> Optional[str]:
    """Find the claude CLI binary."""
    return shutil.which("claude")


def _clean_env() -> dict:
    """Return env dict with Claude nesting-detection vars removed."""
    env = os.environ.copy()
    for key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"):
        env.pop(key, None)
    return env


class ClaudeCliRefinerProvider(BaseRefinerProvider):
    """Refiner provider using the Claude Code CLI subprocess.

    Uses `claude --print` with the user's existing Max/Pro subscription.
    No API key required - authentication is handled by the CLI's
    OAuth flow (stored in ~/.claude/.credentials.json).
    """

    PROVIDER_DISPLAY_NAME = "Claude Code (Max/Pro)"
    REQUIRES_API_KEY = False

    def __init__(self, model: Optional[str] = None, **_kwargs):
        self._model = model or DEFAULT_MODEL
        self._cli_path = _find_claude_cli()

    async def list_models(self, custom_models: list[dict] | None = None) -> list[dict]:
        if custom_models is not None:
            return custom_models
        return list(AVAILABLE_MODELS)

    async def test_connection(self) -> dict:
        """Verify claude CLI is installed and authenticated."""
        if not self._cli_path:
            return {
                "ok": False,
                "latency_ms": 0,
                "message": "Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code",
            }

        try:
            start = time.monotonic()
            proc = await asyncio.create_subprocess_exec(
                self._cli_path, "--print", "--model", self._model,
                "--no-session-persistence",
                "Say OK",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=_clean_env(),
                cwd="/tmp",
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=90)
            latency = (time.monotonic() - start) * 1000

            if proc.returncode != 0:
                err = stderr.decode().strip()[:200]
                return {"ok": False, "latency_ms": 0, "message": f"CLI error: {err}"}

            output = stdout.decode().strip()
            return {
                "ok": True,
                "latency_ms": round(latency, 1),
                "message": f"Connected via CLI. Model: {self._model}. Response: {output[:50]}",
            }
        except asyncio.TimeoutError:
            return {"ok": False, "latency_ms": 0, "message": "CLI timed out (30s)"}
        except Exception as e:
            return {"ok": False, "latency_ms": 0, "message": str(e)}

    async def refine(
        self,
        text: str,
        system_prompt: str,
        timeout: float = 30.0,
        messages: list[dict] | None = None,
    ) -> RefinerResult:
        if not self._cli_path:
            raise ValueError("Claude CLI not found")

        # CLI startup is slow; enforce minimum 60s regardless of caller's timeout
        timeout = max(timeout, 60.0)
        start = time.monotonic()

        # Build the prompt
        if messages:
            # Multi-turn: combine history into a single prompt
            parts = []
            for msg in messages:
                if msg["role"] == "system":
                    system_prompt = msg["content"]
                elif msg["role"] == "user":
                    parts.append(f"User: {msg['content']}")
                elif msg["role"] == "assistant":
                    parts.append(f"Assistant: {msg['content']}")
            prompt_text = "\n\n".join(parts) if parts else text
        else:
            prompt_text = text

        cmd = [
            self._cli_path, "--print",
            "--model", self._model,
            "--no-session-persistence",
        ]
        if system_prompt:
            cmd.extend(["--system-prompt", system_prompt])
        cmd.append(prompt_text)

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=_clean_env(),
                cwd="/tmp",
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            raise ValueError(f"Claude CLI timed out after {timeout}s")

        if proc.returncode != 0:
            err = stderr.decode().strip()[:300]
            raise ValueError(f"Claude CLI error (exit {proc.returncode}): {err}")

        elapsed_ms = (time.monotonic() - start) * 1000
        refined = stdout.decode().strip()

        return RefinerResult(
            refined_text=refined,
            provider="claude-cli",
            model=self._model,
            processing_time_ms=round(elapsed_ms, 1),
            tokens_used=0,  # CLI doesn't report token usage
        )

    def is_configured(self) -> bool:
        return bool(self._cli_path)

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": "claude-cli",
            "model": self._model,
            "configured": self.is_configured(),
            "cli_path": self._cli_path or "not found",
        }
