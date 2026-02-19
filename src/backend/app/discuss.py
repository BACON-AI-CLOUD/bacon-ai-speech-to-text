"""
Discuss mode for BACON-AI Voice Backend.

Sends transcribed text to an AI provider for conversational response,
then converts the response to speech via edge-tts for playback.
"""

import logging
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import edge_tts
from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .refiner import get_refiner
from .refiner.providers import PROVIDER_REGISTRY

logger = logging.getLogger(__name__)

router = APIRouter()

AUDIO_CACHE_DIR = Path("/tmp/bacon-voice-audio")
AUDIO_MAX_AGE_SECONDS = 600  # 10 minutes

DISCUSS_SYSTEM_PROMPT = (
    "You are Elisabeth, a friendly and knowledgeable AI assistant. "
    "Answer the user's question concisely and naturally, as if speaking aloud. "
    "Keep responses under 3 sentences unless more detail is needed."
)

# Valid filename pattern: alphanumeric + hyphens + .mp3
_FILENAME_RE = re.compile(r"^[a-zA-Z0-9\-]+\.mp3$")


def _cleanup_old_audio() -> None:
    """Delete audio files older than AUDIO_MAX_AGE_SECONDS."""
    if not AUDIO_CACHE_DIR.exists():
        return
    now = time.time()
    for f in AUDIO_CACHE_DIR.glob("*.mp3"):
        try:
            if now - f.stat().st_mtime > AUDIO_MAX_AGE_SECONDS:
                f.unlink()
        except OSError:
            pass


class DiscussChatRequest(BaseModel):
    """Request body for POST /discuss/chat."""

    text: str
    history: list[dict] = []
    provider: Optional[str] = None
    voice: str = "en-GB-SoniaNeural"


@router.post("/chat")
async def discuss_chat(request: DiscussChatRequest) -> Dict[str, Any]:
    """
    Send user text to an AI provider and return the response as audio.

    Uses the refiner's provider infrastructure for AI access, then
    generates speech via edge-tts.
    """
    if not request.text or not request.text.strip():
        return JSONResponse(
            status_code=400,
            content={"error": "Empty text"},
        )

    # Validate provider if specified
    if request.provider and request.provider not in PROVIDER_REGISTRY:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Unknown provider: {request.provider}",
                "available": list(PROVIDER_REGISTRY.keys()),
            },
        )

    # Clean up old audio files
    _cleanup_old_audio()

    # Ensure cache dir exists
    AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    start_time = time.time()

    # Get the AI response using refiner provider infrastructure
    refiner = get_refiner()
    target = request.provider or refiner._active_provider

    try:
        provider = refiner._get_provider(target)
        # Build full message array with system prompt + history + current message
        messages = [{"role": "system", "content": DISCUSS_SYSTEM_PROMPT}]
        for msg in request.history:
            if msg.get("role") in ("user", "assistant") and msg.get("content"):
                messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": request.text})
        result = await provider.refine(
            request.text, DISCUSS_SYSTEM_PROMPT, timeout=15.0,
            messages=messages,
        )
        answer = result.refined_text
        model_used = result.model
    except Exception as e:
        logger.error("Discuss AI provider error: %s", e)
        return JSONResponse(
            status_code=502,
            content={"error": f"AI provider error: {e}"},
        )

    # Generate speech via edge-tts
    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = AUDIO_CACHE_DIR / filename

    try:
        communicate = edge_tts.Communicate(answer, request.voice)
        await communicate.save(str(filepath))
    except Exception as e:
        logger.error("edge-tts error: %s", e)
        return JSONResponse(
            status_code=502,
            content={"error": f"Text-to-speech error: {e}", "answer": answer},
        )

    latency_ms = round((time.time() - start_time) * 1000)

    return {
        "question": request.text,
        "answer": answer,
        "audio_url": f"/discuss/audio/{filename}",
        "provider": target,
        "model": model_used,
        "latency_ms": latency_ms,
    }


@router.get("/audio/{filename}")
async def discuss_audio(filename: str):
    """Serve an audio file from the discuss cache."""
    if not _FILENAME_RE.match(filename):
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid filename"},
        )

    filepath = AUDIO_CACHE_DIR / filename
    if not filepath.exists():
        return JSONResponse(
            status_code=404,
            content={"error": "Audio file not found"},
        )

    return FileResponse(
        path=str(filepath),
        media_type="audio/mpeg",
        filename=filename,
    )
