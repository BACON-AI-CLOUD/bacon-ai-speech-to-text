"""
Gemini refiner provider for BACON-AI Voice Backend.

Uses the Google Generative Language API for text refinement.
"""

import logging
import time
from typing import Any, Dict, Optional

import httpx

from .base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-2.0-flash"


class GeminiRefinerProvider(BaseRefinerProvider):
    """Refiner provider using the Google Gemini API."""

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
            raise ValueError("Gemini API key not configured")

        client = self._get_client()
        start = time.monotonic()

        url = f"{GEMINI_API_URL}/{self._model}:generateContent"

        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "parts": [{"text": text}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 2048,
            },
        }

        response = await client.post(
            url,
            json=payload,
            params={"key": self._api_key},
            headers={"Content-Type": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()

        elapsed_ms = (time.monotonic() - start) * 1000
        refined = data["candidates"][0]["content"]["parts"][0]["text"]
        tokens = data.get("usageMetadata", {}).get("totalTokenCount", 0)

        return RefinerResult(
            refined_text=refined,
            provider="gemini",
            model=self._model,
            processing_time_ms=round(elapsed_ms, 1),
            tokens_used=tokens,
        )

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": "gemini",
            "model": self._model,
            "configured": self.is_configured(),
        }
