"""
Text Refiner package for BACON-AI Voice Backend.

Provides LLM-based text refinement of raw speech-to-text output.
"""

from typing import Optional

from .providers.base import RefinerResult
from .refiner import Refiner

_refiner_instance: Optional[Refiner] = None


def get_refiner() -> Refiner:
    """Return the module-level Refiner singleton."""
    global _refiner_instance
    if _refiner_instance is None:
        _refiner_instance = Refiner()
    return _refiner_instance


__all__ = ["get_refiner", "RefinerResult"]
