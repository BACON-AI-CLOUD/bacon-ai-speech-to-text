"""
Ollama refiner provider for BACON-AI Voice Backend.

Uses a local Ollama instance for text refinement. No API key required.
"""

import logging
import time
from typing import Any, Dict, Optional

import httpx

from .base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "llama3.2"


class OllamaRefinerProvider(BaseRefinerProvider):
    """Refiner provider using a local Ollama instance."""

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

    async def refine(
        self,
        text: str,
        system_prompt: str,
        timeout: float = 5.0,
    ) -> RefinerResult:
        client = self._get_client()
        start = time.monotonic()

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
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
