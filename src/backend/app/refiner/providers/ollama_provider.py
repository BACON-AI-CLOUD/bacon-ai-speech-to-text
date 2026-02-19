"""
Ollama refiner provider for BACON-AI Voice Backend.

Uses a local Ollama instance for text refinement. No API key required.
"""

import logging
import os
import time
from typing import Any, Dict, Optional

import httpx

from .base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)


def _detect_ollama_url() -> str:
    """Detect Ollama URL, handling WSL where localhost != Windows host."""
    env_url = os.environ.get("OLLAMA_HOST")
    if env_url:
        url = env_url.rstrip("/")
        if not url.endswith("/api/chat"):
            url += "/api/chat"
        return url
    # In WSL, localhost doesn't reach Windows-side Ollama.
    # Try the WSL gateway IP (Windows host) first.
    is_wsl = "microsoft" in os.uname().release.lower()
    if is_wsl:
        try:
            with open("/proc/net/route") as f:
                for line in f:
                    fields = line.strip().split()
                    if fields[1] == "00000000":  # default route
                        hex_ip = fields[2]
                        ip = ".".join(
                            str(int(hex_ip[i : i + 2], 16))
                            for i in range(6, -1, -2)
                        )
                        logger.info("WSL detected, using Windows host IP %s for Ollama", ip)
                        return f"http://{ip}:11434/api/chat"
        except Exception:
            pass
    return "http://localhost:11434/api/chat"


DEFAULT_OLLAMA_URL = _detect_ollama_url()
DEFAULT_MODEL = "llama3.2"

DEFAULT_MODELS = [
    {"id": "llama3.2", "name": "llama3.2"},
]


class OllamaRefinerProvider(BaseRefinerProvider):
    """Refiner provider using a local Ollama instance."""

    PROVIDER_DISPLAY_NAME = "Ollama"
    REQUIRES_API_KEY = False

    def __init__(
        self,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self._model = model or DEFAULT_MODEL
        self._base_url = base_url or DEFAULT_OLLAMA_URL
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    async def list_models(self, custom_models: list[dict] | None = None) -> list[dict]:
        """Query local Ollama instance for available models."""
        fallback = custom_models if custom_models is not None else list(DEFAULT_MODELS)
        try:
            # Derive tags URL from base_url (which points to /api/chat)
            tags_url = self._base_url.replace("/api/chat", "/api/tags")
            client = self._get_client()
            response = await client.get(tags_url, timeout=5.0)
            response.raise_for_status()
            data = response.json()
            models = []
            for m in data.get("models", []):
                name = m.get("name", "")
                if name:
                    models.append({"id": name, "name": name})
            return models if models else fallback
        except Exception:
            logger.warning("Failed to fetch Ollama models, using %s", "custom" if custom_models else "defaults")
            return fallback

    async def test_connection(self) -> dict:
        """Ping Ollama /api/tags to verify connectivity."""
        tags_url = self._base_url.replace("/api/chat", "/api/tags")
        try:
            client = self._get_client()
            start = time.monotonic()
            response = await client.get(tags_url, timeout=5.0)
            latency = (time.monotonic() - start) * 1000
            response.raise_for_status()
            data = response.json()
            model_count = len(data.get("models", []))
            return {
                "ok": True,
                "latency_ms": round(latency, 1),
                "message": f"Connected. {model_count} model(s) available.",
            }
        except httpx.ConnectError:
            return {"ok": False, "latency_ms": 0, "message": f"Cannot connect to {tags_url}"}
        except httpx.TimeoutException:
            return {"ok": False, "latency_ms": 0, "message": f"Connection timed out: {tags_url}"}
        except Exception as e:
            return {"ok": False, "latency_ms": 0, "message": str(e)}

    async def refine(
        self,
        text: str,
        system_prompt: str,
        timeout: float = 5.0,
        messages: list[dict] | None = None,
    ) -> RefinerResult:
        client = self._get_client()
        start = time.monotonic()

        if messages:
            payload_messages = messages
        else:
            payload_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ]

        payload = {
            "model": self._model,
            "messages": payload_messages,
            "stream": False,
        }

        response = await client.post(
            self._base_url,
            json=payload,
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()

        elapsed_ms = (time.monotonic() - start) * 1000
        refined = data["message"]["content"]
        tokens = data.get("eval_count", 0)

        return RefinerResult(
            refined_text=refined,
            provider="ollama",
            model=self._model,
            processing_time_ms=round(elapsed_ms, 1),
            tokens_used=tokens,
        )

    def is_configured(self) -> bool:
        # Ollama requires no API key; always configured
        return True

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": "ollama",
            "model": self._model,
            "configured": True,
            "base_url": self._base_url,
        }
