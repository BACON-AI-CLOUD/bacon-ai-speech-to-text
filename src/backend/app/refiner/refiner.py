"""
Text Refiner for BACON-AI Voice Backend.

Singleton class that manages refiner providers and processes raw
transcribed text through an LLM for cleanup and formatting.
"""

import logging
import time
from typing import Any, Dict, Optional

from .prompts import get_custom_prompt, get_default_prompt
from .providers import PROVIDER_REGISTRY
from .providers.base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)


class Refiner:
    """
    Manages text refinement through configurable LLM providers.

    Uses a singleton pattern consistent with IntegrationRouter.
    Providers are lazily initialised on first use.
    """

    def __init__(self):
        self._providers: Dict[str, BaseRefinerProvider] = {}
        self._active_provider: str = "ollama"
        self._enabled: bool = False
        self._custom_prompt: Optional[str] = None
        self._timeout: float = 5.0
        self._provider_configs: Dict[str, Dict[str, Any]] = {}

    def _get_provider(self, name: str) -> BaseRefinerProvider:
        """
        Return the provider instance for *name*, creating it if needed.

        Raises ValueError for unknown provider names.
        """
        if name not in PROVIDER_REGISTRY:
            raise ValueError(
                f"Unknown refiner provider: {name}. "
                f"Supported: {', '.join(PROVIDER_REGISTRY.keys())}"
            )

        if name not in self._providers:
            logger.info("Initialising refiner provider: %s", name)
            cfg = self._provider_configs.get(name, {})
            provider_cls = PROVIDER_REGISTRY[name]
            self._providers[name] = provider_cls(**cfg)

        return self._providers[name]

    async def process(
        self,
        raw_text: str,
        provider_override: Optional[str] = None,
    ) -> RefinerResult:
        """
        Process raw transcribed text through the active refiner provider.

        If the refiner is disabled or the text is empty, returns the raw
        text unchanged. On provider error, falls back to returning the
        raw text so that transcription is never blocked.

        Args:
            raw_text: Raw speech-to-text output.
            provider_override: Use this provider instead of the active one.

        Returns:
            RefinerResult with refined (or original) text.
        """
        if not raw_text or not raw_text.strip():
            return RefinerResult(
                refined_text=raw_text,
                provider="none",
                model="none",
                processing_time_ms=0.0,
                tokens_used=0,
            )

        if not self._enabled:
            return RefinerResult(
                refined_text=raw_text,
                provider="disabled",
                model="none",
                processing_time_ms=0.0,
                tokens_used=0,
            )

        target = provider_override or self._active_provider
        prompt = (
            get_custom_prompt(self._custom_prompt)
            if self._custom_prompt
            else get_default_prompt()
        )

        try:
            provider = self._get_provider(target)
            result = await provider.refine(raw_text, prompt, self._timeout)
            return result
        except Exception as e:
            logger.warning(
                "Refiner provider '%s' failed: %s. Returning raw text.",
                target,
                e,
            )
            return RefinerResult(
                refined_text=raw_text,
                provider=target,
                model="fallback",
                processing_time_ms=0.0,
                tokens_used=0,
            )

    def configure(
        self,
        enabled: Optional[bool] = None,
        provider: Optional[str] = None,
        prompt: Optional[str] = None,
        timeout: Optional[float] = None,
        provider_configs: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> None:
        """
        Update refiner configuration.

        Args:
            enabled: Enable or disable the refiner.
            provider: Set the active provider name.
            prompt: Set a custom prompt addition (None clears it).
            timeout: Set the request timeout in seconds.
            provider_configs: Per-provider config dicts (e.g. API keys).
        """
        if enabled is not None:
            self._enabled = enabled

        if provider is not None:
            if provider not in PROVIDER_REGISTRY:
                raise ValueError(
                    f"Unknown provider: {provider}. "
                    f"Supported: {', '.join(PROVIDER_REGISTRY.keys())}"
                )
            self._active_provider = provider

        if prompt is not None:
            self._custom_prompt = prompt if prompt else None

        if timeout is not None:
            self._timeout = timeout

        if provider_configs is not None:
            self._provider_configs.update(provider_configs)
            # Recreate any already-initialised providers with new config
            for name, cfg in provider_configs.items():
                if name in self._providers:
                    del self._providers[name]

    def get_config(self) -> Dict[str, Any]:
        """
        Return current refiner configuration.

        API keys are never exposed; only a 'configured' boolean is returned.
        """
        providers_info = {}
        for name in PROVIDER_REGISTRY:
            try:
                provider = self._get_provider(name)
                info = provider.get_info()
                providers_info[name] = info
            except Exception:
                providers_info[name] = {
                    "name": name,
                    "configured": False,
                }

        return {
            "enabled": self._enabled,
            "active_provider": self._active_provider,
            "timeout": self._timeout,
            "custom_prompt": self._custom_prompt,
            "providers": providers_info,
        }
