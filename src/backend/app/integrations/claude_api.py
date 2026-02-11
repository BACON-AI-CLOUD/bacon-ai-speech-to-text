"""
FEAT-006: Claude API Direct Backend

Sends transcribed text to Claude via the Anthropic Python SDK.
Supports configurable model, system prompt, conversation history,
and streaming responses.
"""

import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
DEFAULT_MAX_TOKENS = 4096
DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful AI assistant receiving voice-transcribed input. "
    "Respond concisely and clearly."
)


class ClaudeAPIBackend:
    """
    Integration backend that sends messages to the Claude API.

    Uses the Anthropic Python SDK for communication. Maintains
    per-session conversation history in memory.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    ):
        self._api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self._model = model
        self._max_tokens = max_tokens
        self._system_prompt = system_prompt
        self._conversation_history: List[Dict[str, str]] = []
        self._client = None

    @property
    def is_configured(self) -> bool:
        """Check whether the API key is available."""
        return bool(self._api_key)

    def _get_client(self):
        """Lazy-initialise and return the Anthropic client."""
        if self._client is None:
            if not self._api_key:
                raise ValueError(
                    "ANTHROPIC_API_KEY not set. "
                    "Provide it via constructor or environment variable."
                )
            try:
                import anthropic

                self._client = anthropic.Anthropic(api_key=self._api_key)
            except ImportError:
                raise ImportError(
                    "anthropic package not installed. "
                    "Install with: pip install anthropic"
                )
        return self._client

    def clear_history(self) -> None:
        """Clear the conversation history for the current session."""
        self._conversation_history.clear()

    async def send(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Send transcribed text to the Claude API and return the response.

        Args:
            text: The transcribed text to send.
            metadata: Additional context (model, system_prompt, max_tokens overrides).

        Returns:
            Dict with response text, model used, and token usage.
        """
        if metadata is None:
            metadata = {}

        if not self._api_key:
            return {
                "success": False,
                "message": "ANTHROPIC_API_KEY not configured",
                "response": "",
                "model": self._model,
                "usage": {},
            }

        # Allow per-request overrides via metadata
        model = metadata.get("model", self._model)
        max_tokens = metadata.get("max_tokens", self._max_tokens)
        system_prompt = metadata.get("system_prompt", self._system_prompt)

        # Append user message to conversation history
        self._conversation_history.append({"role": "user", "content": text})

        try:
            client = self._get_client()

            # Call Claude API (synchronous SDK call)
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=list(self._conversation_history),
            )

            # Extract response text
            response_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    response_text += block.text

            # Add assistant response to history
            self._conversation_history.append(
                {"role": "assistant", "content": response_text}
            )

            usage = {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }

            logger.info(
                "Claude API response: model=%s, input_tokens=%d, output_tokens=%d",
                response.model,
                usage["input_tokens"],
                usage["output_tokens"],
            )

            return {
                "success": True,
                "message": "Response received from Claude API",
                "response": response_text,
                "model": response.model,
                "usage": usage,
            }

        except Exception as e:
            # Remove the user message from history on failure so it can be retried
            if self._conversation_history and self._conversation_history[-1]["role"] == "user":
                self._conversation_history.pop()

            logger.error("Claude API error: %s", e)
            return {
                "success": False,
                "message": f"Claude API error: {e}",
                "response": "",
                "model": model,
                "usage": {},
            }
