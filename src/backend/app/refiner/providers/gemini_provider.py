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
DEFAULT_MODEL = "gemini-2.5-flash"

AVAILABLE_MODELS = [
    {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash"},
    {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro"},
    {"id": "gemini-3-pro-preview", "name": "Gemini 3 Pro (Preview)"},
    {"id": "gemini-3-flash-preview", "name": "Gemini 3 Flash (Preview)"},
]


class GeminiRefinerProvider(BaseRefinerProvider):
    """Refiner provider using the Google Gemini API."""

    PROVIDER_DISPLAY_NAME = "Google Gemini"
    REQUIRES_API_KEY = True

    async def list_models(self, custom_models: list[dict] | None = None) -> list[dict]:
        if custom_models is not None:
            return custom_models
        return list(AVAILABLE_MODELS)

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self._api_key = api_key
        self._model = model or DEFAULT_MODEL
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    async def test_connection(self) -> dict:
        """Verify Gemini API key by listing models."""
        if not self._api_key:
            return {"ok": False, "latency_ms": 0, "message": "API key not configured"}
        try:
            client = self._get_client()
            start = time.monotonic()
            response = await client.get(
                GEMINI_API_URL,
                params={"key": self._api_key},
                timeout=5.0,
            )
            latency = (time.monotonic() - start) * 1000
            response.raise_for_status()
            data = response.json()
            model_count = len(data.get("models", []))
            return {
                "ok": True,
                "latency_ms": round(latency, 1),
                "message": f"Connected. {model_count} model(s) available.",
            }
        except httpx.HTTPStatusError as e:
            # Extract actual error message from response body
            try:
                err_data = e.response.json()
                err_msg = err_data.get("error", {}).get("message", f"HTTP {e.response.status_code}")
            except Exception:
                err_msg = f"HTTP {e.response.status_code}"
            return {"ok": False, "latency_ms": 0, "message": err_msg}
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
            raise ValueError("Gemini API key not configured")

        client = self._get_client()
        start = time.monotonic()

        url = f"{GEMINI_API_URL}/{self._model}:generateContent"

        if messages:
            # Convert OpenAI-style messages to Gemini format
            system_text = system_prompt
            contents = []
            for msg in messages:
                role = msg["role"]
                if role == "system":
                    system_text = msg["content"]
                else:
                    gemini_role = "model" if role == "assistant" else "user"
                    contents.append({
                        "role": gemini_role,
                        "parts": [{"text": msg["content"]}],
                    })
            payload = {
                "system_instruction": {
                    "parts": [{"text": system_text}],
                },
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 2048,
                },
            }
        else:
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
