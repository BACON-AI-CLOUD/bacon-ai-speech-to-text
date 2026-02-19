"""
Default prompts for the text refiner.

Loads the system prompt from docs/system-prompt/text-refinement-agent.md
if available, otherwise falls back to a simple built-in prompt.
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_FALLBACK_PROMPT = (
    "You are a text refinement assistant. Your job is to clean up raw "
    "speech-to-text output. Fix punctuation, capitalisation, and grammar "
    "while preserving the original meaning exactly. Remove filler words "
    "like 'um', 'uh', 'like', 'you know' unless they are clearly "
    "intentional. Do not add, remove, or change the substantive content. "
    "Return ONLY the refined text with no commentary or explanation."
)

# Look for the system prompt file relative to the project root
_PROMPT_FILE = (
    Path(__file__).parent.parent.parent.parent.parent
    / "docs"
    / "system-prompt"
    / "text-refinement-agent.md"
)


def _load_prompt_file() -> str:
    """Load system prompt from file, falling back to built-in prompt."""
    if _PROMPT_FILE.exists():
        try:
            content = _PROMPT_FILE.read_text(encoding="utf-8").strip()
            if content:
                logger.info("Loaded refiner system prompt from %s", _PROMPT_FILE)
                return content
        except OSError as e:
            logger.warning("Failed to read prompt file %s: %s", _PROMPT_FILE, e)
    return _FALLBACK_PROMPT


DEFAULT_REFINE_PROMPT = _load_prompt_file()


def get_default_prompt() -> str:
    """Return the default refinement system prompt."""
    return DEFAULT_REFINE_PROMPT


def get_custom_prompt(additions: str) -> str:
    """
    Return the default prompt with user additions appended.

    Args:
        additions: Extra instructions to append to the default prompt.

    Returns:
        Combined prompt string.
    """
    return f"{DEFAULT_REFINE_PROMPT}\n\nAdditional instructions: {additions}"
