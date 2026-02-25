"""
Base classes and data types for refiner providers.

All refiner providers must subclass BaseRefinerProvider and implement
the refine(), is_configured(), and get_info() methods.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class RefinerResult:
    """Result returned by a refiner provider after processing text."""

    refined_text: str
    provider: str
    model: str
    processing_time_ms: float = 0.0
    tokens_used: int = 0
    warning: Optional[str] = None


class BaseRefinerProvider(ABC):
    """Abstract base class for refiner providers."""

    PROVIDER_DISPLAY_NAME: str = "Unknown"
    REQUIRES_API_KEY: bool = True

    @abstractmethod
    async def list_models(self, custom_models: list[dict] | None = None) -> list[dict]:
        """
        Return available models for this provider.

        Returns:
            List of dicts with 'id' and 'name' keys.
        """
        ...

    @abstractmethod
    async def refine(
        self,
        text: str,
        system_prompt: str,
        timeout: float = 5.0,
        messages: list[dict] | None = None,
    ) -> RefinerResult:
        """
        Refine raw transcribed text using an LLM.

        Args:
            text: Raw transcribed text to refine.
            system_prompt: System prompt with refinement instructions.
            timeout: Request timeout in seconds.
            messages: Optional pre-built message array. If provided, used
                      instead of building [system, user] from text/system_prompt.

        Returns:
            RefinerResult with the refined text and metadata.
        """
        ...

    @abstractmethod
    async def test_connection(self) -> dict:
        """
        Test connectivity to this provider.

        Returns:
            Dict with 'ok' (bool), 'latency_ms' (float), and 'message' (str).
        """
        ...

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if this provider has all required configuration."""
        ...

    @abstractmethod
    def get_info(self) -> Dict[str, Any]:
        """Return provider info (name, model, configured status)."""
        ...
