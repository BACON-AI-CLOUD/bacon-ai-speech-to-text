"""
OpenAI refiner provider for BACON-AI Voice Backend.

Uses the OpenAI Chat Completions API for text refinement.
"""

import logging
import time
from typing import Any, Dict, Optional

import httpx

from .base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o"

DEFAULT_MODELS = [
    {"id": "gpt-4o", "name": "GPT-4o"},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
    {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"},
]

# Prefixes that indicate chat-capable models
_CHAT_MODEL_PREFIXES = ("gpt-4", "gpt-5", "gpt-3.5", "o1", "o3", "o4", "chatgpt")
# Suffixes/substrings to exclude (non-chat variants)
_EXCLUDE_SUBSTRINGS = ("audio", "realtime", "transcribe", "tts", "dall-e", "whisper", "embedding")


class OpenAIRefinerProvider(BaseRefinerProvider):
    """Refiner provider using the OpenAI Chat Completions API."""

    PROVIDER_DISPLAY_NAME = "OpenAI"
    REQUIRES_API_KEY = True

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self._api_key = api_key
        self._model = model or DEFAULT_MODEL
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    async def list_models(self, custom_models: list[dict] | None = None) -> list[dict]:
        """Query OpenAI API for available models, filtered to chat-capable ones."""
        fallback = custom_models if custom_models is not None else list(DEFAULT_MODELS)
        if not self._api_key:
            return fallback
        try:
            client = self._get_client()
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=5.0,
            )
            response.raise_for_status()
            data = response.json()
            models = []
            for m in data.get("data", []):
                model_id = m.get("id", "")
                mid_lower = model_id.lower()
                # Include only chat-capable models
                if not any(mid_lower.startswith(p) for p in _CHAT_MODEL_PREFIXES):
                    continue
                # Exclude audio/realtime/embedding variants
                if any(exc in mid_lower for exc in _EXCLUDE_SUBSTRINGS):
                    continue
                models.append({"id": model_id, "name": model_id})
            # Sort: newest/best first
            models.sort(key=lambda x: x["id"], reverse=True)
            return models if models else fallback
        except Exception:
            logger.warning("Failed to fetch OpenAI models, using %s", "custom" if custom_models else "defaults")
            return fallback

    async def test_connection(self) -> dict:
        """Verify OpenAI API key by listing models."""
        if not self._api_key:
            return {"ok": False, "latency_ms": 0, "message": "API key not configured"}
        try:
            client = self._get_client()
            start = time.monotonic()
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=5.0,
            )
            latency = (time.monotonic() - start) * 1000
            response.raise_for_status()
            data = response.json()
            model_count = len(data.get("data", []))
            return {
                "ok": True,
                "latency_ms": round(latency, 1),
                "message": f"Connected. {model_count} model(s) available.",
            }
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                return {"ok": False, "latency_ms": 0, "message": "Invalid API key"}
            return {"ok": False, "latency_ms": 0, "message": f"HTTP {e.response.status_code}"}
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
            raise ValueError("OpenAI API key not configured")

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
            "temperature": 0.1,
            "max_tokens": 2048,
        }

        response = await client.post(
            OPENAI_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()

        elapsed_ms = (time.monotonic() - start) * 1000
        refined = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("total_tokens", 0)

        return RefinerResult(
            refined_text=refined,
            provider="openai",
            model=self._model,
            processing_time_ms=round(elapsed_ms, 1),
            tokens_used=tokens,
        )

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": "openai",
            "model": self._model,
            "configured": self.is_configured(),
        }
