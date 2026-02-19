"""
Refiner provider registry for BACON-AI Voice Backend.

Maps provider name strings to their implementation classes.
"""

from .anthropic_provider import AnthropicRefinerProvider
from .claude_cli_provider import ClaudeCliRefinerProvider
from .gemini_provider import GeminiRefinerProvider
from .groq_provider import GroqRefinerProvider
from .ollama_provider import OllamaRefinerProvider
from .openai_provider import OpenAIRefinerProvider

PROVIDER_REGISTRY = {
    "claude-cli": ClaudeCliRefinerProvider,
    "anthropic": AnthropicRefinerProvider,
    "openai": OpenAIRefinerProvider,
    "groq": GroqRefinerProvider,
    "ollama": OllamaRefinerProvider,
    "gemini": GeminiRefinerProvider,
}

__all__ = [
    "PROVIDER_REGISTRY",
    "ClaudeCliRefinerProvider",
    "AnthropicRefinerProvider",
    "OpenAIRefinerProvider",
    "GroqRefinerProvider",
    "OllamaRefinerProvider",
    "GeminiRefinerProvider",
]
