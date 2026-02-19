"""
Anthropic refiner provider for BACON-AI Voice Backend.

Uses the Anthropic Messages API for text refinement.
Supports both API keys (sk-ant-api...) and OAuth tokens (sk-ant-oat...)
from Claude Max/Pro subscriptions.
"""

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from .base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"

AVAILABLE_MODELS = [
    {"id": "claude-opus-4-6", "name": "Claude Opus 4.6"},
    {"id": "claude-sonnet-4-5-20250929", "name": "Claude Sonnet 4.5"},
    {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5"},
]

# Path to Claude Code's OAuth credentials
_CLAUDE_CREDENTIALS_FILE = Path.home() / ".claude" / ".credentials.json"


def _is_oauth_token(key: str) -> bool:
    """Check if the key is an OAuth token (vs a standard API key)."""
    return key.startswith("sk-ant-oat")


def _load_oauth_token() -> Optional[str]:
    """Load OAuth access token from Claude Code's credentials file."""
    if not _CLAUDE_CREDENTIALS_FILE.exists():
        return None
    try:
        data = json.loads(_CLAUDE_CREDENTIALS_FILE.read_text())
        oauth = data.get("claudeAiOauth", {})
        token = oauth.get("accessToken")
        if token:
            logger.info("Loaded OAuth token from Claude Code credentials")
            return token
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Failed to load Claude Code credentials: %s", e)
    return None


def _build_auth_headers(key: str) -> dict:
    """Build the correct auth headers based on key type."""
    headers = {
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    if _is_oauth_token(key):
        headers["Authorization"] = f"Bearer {key}"
    else:
        headers["x-api-key"] = key
    return headers


class AnthropicRefinerProvider(BaseRefinerProvider):
    """Refiner provider using the Anthropic Messages API.

    Supports two authentication methods:
    - API key (sk-ant-api...): Standard pay-per-token billing
    - OAuth token (sk-ant-oat...): Claude Max/Pro subscription
    - "auto": Auto-load OAuth token from ~/.claude/.credentials.json
    """

    PROVIDER_DISPLAY_NAME = "Anthropic"
    REQUIRES_API_KEY = True

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        # If "auto", load from Claude Code credentials
        if api_key == "auto":
            api_key = _load_oauth_token()
        self._api_key = api_key
        self._model = model or DEFAULT_MODEL
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    def _auth_headers(self) -> dict:
        """Return auth headers appropriate for the configured key type."""
        return _build_auth_headers(self._api_key) if self._api_key else {}

    async def list_models(self, custom_models: list[dict] | None = None) -> list[dict]:
        if custom_models is not None:
            return custom_models
        return list(AVAILABLE_MODELS)

    async def test_connection(self) -> dict:
        """Verify Anthropic API key or OAuth token with a minimal request."""
        if not self._api_key:
            return {"ok": False, "latency_ms": 0, "message": "API key not configured"}

        auth_type = "OAuth token" if _is_oauth_token(self._api_key) else "API key"

        try:
            client = self._get_client()
            start = time.monotonic()
            response = await client.post(
                ANTHROPIC_API_URL,
                json={
                    "model": self._model,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}],
                },
                headers=self._auth_headers(),
                timeout=10.0,
            )
            latency = (time.monotonic() - start) * 1000
            response.raise_for_status()
            return {
                "ok": True,
                "latency_ms": round(latency, 1),
                "message": f"Connected via {auth_type}. Model: {self._model}",
            }
        except httpx.HTTPStatusError as e:
            body = ""
            try:
                body = e.response.json().get("error", {}).get("message", "")
            except Exception:
                pass
            if e.response.status_code == 401:
                return {"ok": False, "latency_ms": 0, "message": f"Invalid {auth_type}. {body}".strip()}
            if e.response.status_code == 403:
                msg = f"Access denied ({auth_type}). {body}".strip()
                if _is_oauth_token(self._api_key):
                    msg += " OAuth tokens may be restricted to Claude Code only."
                return {"ok": False, "latency_ms": 0, "message": msg}
            return {"ok": False, "latency_ms": 0, "message": f"HTTP {e.response.status_code}: {body}".strip()}
        except Exception as e:
            return {"ok": False, "latency_ms": 0, "message": str(e)}

    async def refine(
        self,
        text: str,
        system_prompt: str,
        timeout: float = 5.0,
        messages: list[dict] | None = None,
    ) -> RefinerResult:
        if not self._api_key:
            raise ValueError("Anthropic API key not configured")

        client = self._get_client()
        start = time.monotonic()

        if messages:
            system_text = system_prompt
            api_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_text = msg["content"]
                else:
                    api_messages.append({"role": msg["role"], "content": msg["content"]})
            payload = {
                "model": self._model,
                "max_tokens": 2048,
                "system": system_text,
                "messages": api_messages,
            }
        else:
            payload = {
                "model": self._model,
                "max_tokens": 2048,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": text},
                ],
            }

        response = await client.post(
            ANTHROPIC_API_URL,
            json=payload,
            headers=self._auth_headers(),
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()

        elapsed_ms = (time.monotonic() - start) * 1000
        refined = data["content"][0]["text"]
        tokens = data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0)

        return RefinerResult(
            refined_text=refined,
            provider="anthropic",
            model=self._model,
            processing_time_ms=round(elapsed_ms, 1),
            tokens_used=tokens,
        )

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def get_info(self) -> Dict[str, Any]:
        auth_type = "oauth" if self._api_key and _is_oauth_token(self._api_key) else "api_key"
        return {
            "name": "anthropic",
            "model": self._model,
            "configured": self.is_configured(),
            "auth_type": auth_type,
        }
