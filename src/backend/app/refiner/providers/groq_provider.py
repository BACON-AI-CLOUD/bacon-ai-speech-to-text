"""
Groq refiner provider for BACON-AI Voice Backend.

Uses the Groq API (OpenAI-compatible) with Llama models for fast
text refinement.
"""

import logging
import time
from typing import Any, Dict, Optional

import httpx

from .base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
DEFAULT_MODEL = "llama-3.3-70b-versatile"

DEFAULT_MODELS = [
    {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile"},
    {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant"},
    {"id": "llama-4-scout-17b-16e-instruct", "name": "Llama 4 Scout 17B"},
    {"id": "llama-4-maverick-17b-128e-instruct", "name": "Llama 4 Maverick 17B"},
]


class GroqRefinerProvider(BaseRefinerProvider):
    """Refiner provider using the Groq API."""

    PROVIDER_DISPLAY_NAME = "Groq"
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
        """Query Groq API for available models, fall back to custom or defaults."""
        fallback = custom_models if custom_models is not None else list(DEFAULT_MODELS)
        if not self._api_key:
            return fallback
        try:
            client = self._get_client()
            response = await client.get(
                GROQ_MODELS_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=5.0,
            )
            response.raise_for_status()
            data = response.json()
            models = []
            for m in data.get("data", []):
                model_id = m.get("id", "")
                if m.get("active", True):
                    models.append({"id": model_id, "name": model_id})
            return models if models else fallback
        except Exception:
            logger.warning("Failed to fetch Groq models, using %s", "custom" if custom_models else "defaults")
            return fallback

    async def test_connection(self) -> dict:
        """Verify Groq API key by listing models."""
        if not self._api_key:
            return {"ok": False, "latency_ms": 0, "message": "API key not configured"}
        try:
            client = self._get_client()
            start = time.monotonic()
            response = await client.get(
                GROQ_MODELS_URL,
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
            raise ValueError("Groq API key not configured")

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
            GROQ_API_URL,
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
            provider="groq",
            model=self._model,
            processing_time_ms=round(elapsed_ms, 1),
            tokens_used=tokens,
        )

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": "groq",
            "model": self._model,
            "configured": self.is_configured(),
        }
