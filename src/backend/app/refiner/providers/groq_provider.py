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
DEFAULT_MODEL = "llama-3.3-70b-versatile"


class GroqRefinerProvider(BaseRefinerProvider):
    """Refiner provider using the Groq API."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self._api_key = api_key
        self._model = model or DEFAULT_MODEL
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    async def refine(
        self,
        text: str,
        system_prompt: str,
        timeout: float = 5.0,
    ) -> RefinerResult:
        if not self._api_key:
            raise ValueError("Groq API key not configured")

        client = self._get_client()
        start = time.monotonic()

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
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
