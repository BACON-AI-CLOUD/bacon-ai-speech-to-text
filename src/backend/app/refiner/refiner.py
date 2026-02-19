"""
Text Refiner for BACON-AI Voice Backend.

Singleton class that manages refiner providers and processes raw
transcribed text through an LLM for cleanup and formatting.

API keys are stored in ~/.config/bacon-ai-voice/.env (never in refiner.json).
Non-secret settings (model, enabled, timeout, prompt) stay in refiner.json.
"""

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import dotenv_values, set_key

from .prompts import get_default_prompt
from .providers import PROVIDER_REGISTRY
from .providers.base import BaseRefinerProvider, RefinerResult

logger = logging.getLogger(__name__)

_REFINER_CONFIG_DIR = Path.home() / ".config" / "bacon-ai-voice"
_REFINER_CONFIG_FILE = _REFINER_CONFIG_DIR / "refiner.json"
_REFINER_ENV_FILE = _REFINER_CONFIG_DIR / ".env"

# Map provider names to env var names for API keys
_API_KEY_ENV_VARS = {
    "groq": "GROQ_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


class Refiner:
    """
    Manages text refinement through configurable LLM providers.

    Uses a singleton pattern consistent with IntegrationRouter.
    Providers are lazily initialised on first use.
    Non-secret config persisted to ~/.config/bacon-ai-voice/refiner.json.
    API keys persisted to ~/.config/bacon-ai-voice/.env (separate, secure).
    """

    def __init__(self):
        self._providers: Dict[str, BaseRefinerProvider] = {}
        self._active_provider: str = "ollama"
        self._enabled: bool = False
        self._custom_prompt: Optional[str] = None
        self._timeout: float = 15.0
        self._provider_configs: Dict[str, Dict[str, Any]] = {}
        self._provider_models: Dict[str, list] = {}
        self._load_persistent_config()

    def _load_persistent_config(self) -> None:
        """Load saved config from disk and API keys from .env on startup."""
        if _REFINER_CONFIG_FILE.exists():
            try:
                data = json.loads(_REFINER_CONFIG_FILE.read_text())
                self._enabled = data.get("enabled", self._enabled)
                self._active_provider = data.get("active_provider", self._active_provider)
                self._custom_prompt = data.get("custom_prompt", self._custom_prompt)
                self._timeout = data.get("timeout", self._timeout)
                self._provider_configs = data.get("provider_configs", self._provider_configs)
                self._provider_models = data.get("provider_models", self._provider_models)
                logger.info("Loaded refiner config from %s", _REFINER_CONFIG_FILE)
            except (json.JSONDecodeError, OSError) as e:
                logger.warning("Failed to load refiner config: %s", e)

        # Load API keys from .env and inject into provider configs
        if _REFINER_ENV_FILE.exists():
            env_vars = dotenv_values(_REFINER_ENV_FILE)
            for provider_name, env_var in _API_KEY_ENV_VARS.items():
                key_value = env_vars.get(env_var)
                if key_value:
                    if provider_name not in self._provider_configs:
                        self._provider_configs[provider_name] = {}
                    self._provider_configs[provider_name]["api_key"] = key_value
            logger.info("Loaded API keys from %s", _REFINER_ENV_FILE)
        else:
            # Migrate: if keys exist in refiner.json, move them to .env
            self._migrate_keys_to_env()

    def _save_persistent_config(self) -> None:
        """Save config to disk. API keys go to .env, everything else to JSON."""
        try:
            _REFINER_CONFIG_DIR.mkdir(parents=True, exist_ok=True)

            # Write API keys to .env file
            self._save_keys_to_env()

            # Build JSON config WITHOUT api_key fields
            clean_configs = {}
            for name, cfg in self._provider_configs.items():
                clean_configs[name] = {
                    k: v for k, v in cfg.items() if k != "api_key"
                }

            data = {
                "enabled": self._enabled,
                "active_provider": self._active_provider,
                "custom_prompt": self._custom_prompt,
                "timeout": self._timeout,
                "provider_configs": clean_configs,
                "provider_models": self._provider_models,
            }
            _REFINER_CONFIG_FILE.write_text(json.dumps(data, indent=2))
            logger.info("Saved refiner config to %s", _REFINER_CONFIG_FILE)
        except OSError as e:
            logger.warning("Failed to save refiner config: %s", e)

    def _save_keys_to_env(self) -> None:
        """Write API keys from provider configs to the .env file."""
        # Ensure .env file exists
        if not _REFINER_ENV_FILE.exists():
            _REFINER_ENV_FILE.touch()

        for provider_name, env_var in _API_KEY_ENV_VARS.items():
            cfg = self._provider_configs.get(provider_name, {})
            api_key = cfg.get("api_key")
            if api_key:
                set_key(str(_REFINER_ENV_FILE), env_var, api_key)

    def _migrate_keys_to_env(self) -> None:
        """One-time migration: move API keys from refiner.json to .env."""
        migrated = False
        for provider_name, env_var in _API_KEY_ENV_VARS.items():
            cfg = self._provider_configs.get(provider_name, {})
            api_key = cfg.get("api_key")
            if api_key:
                _REFINER_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
                if not _REFINER_ENV_FILE.exists():
                    _REFINER_ENV_FILE.touch()
                set_key(str(_REFINER_ENV_FILE), env_var, api_key)
                migrated = True
        if migrated:
            logger.info("Migrated API keys from refiner.json to %s", _REFINER_ENV_FILE)

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
        prompt = self._custom_prompt if self._custom_prompt else get_default_prompt()

        try:
            provider = self._get_provider(target)
            result = await provider.refine(raw_text, prompt, self._timeout)
            return result
        except Exception as e:
            error_msg = str(e)
            logger.warning(
                "Refiner provider '%s' failed: %s. Returning raw text.",
                target,
                error_msg,
            )
            # Build user-friendly warning message
            if "429" in error_msg:
                warning = f"Rate limited by {target}. Falling back to raw text. Check your API plan/credits."
            elif "401" in error_msg or "403" in error_msg:
                warning = f"Authentication failed for {target}. Check your API key."
            elif "timeout" in error_msg.lower():
                warning = f"{target} timed out after {self._timeout}s. Falling back to raw text."
            else:
                warning = f"{target} error: {error_msg[:150]}. Falling back to raw text."
            return RefinerResult(
                refined_text=raw_text,
                provider=target,
                model="fallback",
                processing_time_ms=0.0,
                tokens_used=0,
                warning=warning,
            )

    def configure(
        self,
        enabled: Optional[bool] = None,
        provider: Optional[str] = None,
        prompt: Optional[str] = None,
        timeout: Optional[float] = None,
        provider_configs: Optional[Dict[str, Dict[str, Any]]] = None,
        provider_models: Optional[Dict[str, list]] = None,
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
            # Deep-merge per-provider configs to preserve existing keys
            # (e.g. don't lose api_key when only model changes)
            for name, cfg in provider_configs.items():
                if name in self._provider_configs:
                    self._provider_configs[name].update(cfg)
                else:
                    self._provider_configs[name] = cfg
                # Recreate any already-initialised providers with new config
                if name in self._providers:
                    del self._providers[name]

        if provider_models is not None:
            self._provider_models.update(provider_models)

        self._save_persistent_config()

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
            "provider_models": self._provider_models,
        }

    def get_custom_models(self, provider_name: str) -> Optional[list]:
        """Return custom model list for a provider, or None if not configured."""
        return self._provider_models.get(provider_name)
