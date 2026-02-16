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


class BaseRefinerProvider(ABC):
    """Abstract base class for refiner providers."""

    @abstractmethod
    async def refine(
        self,
        text: str,
        system_prompt: str,
        timeout: float = 5.0,
    ) -> RefinerResult:
        """
        Refine raw transcribed text using an LLM.

        Args:
            text: Raw transcribed text to refine.
            system_prompt: System prompt with refinement instructions.
            timeout: Request timeout in seconds.

        Returns:
            RefinerResult with the refined text and metadata.
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
