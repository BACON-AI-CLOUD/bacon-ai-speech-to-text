"""
Default prompts for the text refiner.

Provides the system prompt used to clean up raw speech-to-text output
into well-formatted, punctuated text.
"""

DEFAULT_REFINE_PROMPT = (
    "You are a text refinement assistant. Your job is to clean up raw "
    "speech-to-text output. Fix punctuation, capitalisation, and grammar "
    "while preserving the original meaning exactly. Remove filler words "
    "like 'um', 'uh', 'like', 'you know' unless they are clearly "
    "intentional. Do not add, remove, or change the substantive content. "
    "Return ONLY the refined text with no commentary or explanation."
)


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
