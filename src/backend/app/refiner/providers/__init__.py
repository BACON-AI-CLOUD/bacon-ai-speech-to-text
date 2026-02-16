"""
Refiner provider registry for BACON-AI Voice Backend.

Maps provider name strings to their implementation classes.
"""

from .gemini_provider import GeminiRefinerProvider
from .groq_provider import GroqRefinerProvider
from .ollama_provider import OllamaRefinerProvider

PROVIDER_REGISTRY = {
    "groq": GroqRefinerProvider,
    "ollama": OllamaRefinerProvider,
    "gemini": GeminiRefinerProvider,
}

__all__ = [
    "PROVIDER_REGISTRY",
    "GroqRefinerProvider",
    "OllamaRefinerProvider",
    "GeminiRefinerProvider",
]
