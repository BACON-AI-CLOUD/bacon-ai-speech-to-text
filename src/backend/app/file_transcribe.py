"""
File transcription endpoints for BACON-AI Voice Backend.

Handles transcription of uploaded audio/video files or local file paths,
with support for multiple output formats (txt, srt, vtt) and optional
AI text refinement.
"""

import asyncio
import logging
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .refiner import get_refiner
from .refiner.providers import PROVIDER_REGISTRY
from .stt.whisper_engine import get_engine

logger = logging.getLogger(__name__)

router = APIRouter()

TRANSCRIPT_CACHE_DIR = Path("/tmp/bacon-voice-transcripts")
TRANSCRIPT_MAX_AGE_SECONDS = 600  # 10 minutes

# Valid filename pattern: alphanumeric + hyphens/underscores + extension
_FILENAME_RE = re.compile(r"^[a-zA-Z0-9\-_]+\.(txt|srt|vtt)$")

# Supported audio/video extensions
SUPPORTED_EXTENSIONS = {
    ".mp3", ".wav", ".webm", ".ogg", ".flac", ".m4a", ".aac",
    ".mp4", ".mkv", ".avi", ".mov", ".wma",
}


# =============================================================================
# Request / Response Models
# =============================================================================


class FileTranscribeOptions(BaseModel):
    """Options for file transcription via local path."""
    path: str
    language: str = ""
    output_format: str = "txt"
    refine: bool = False
    refine_provider: Optional[str] = None
    custom_prompt: Optional[str] = None


class FileTranscribeResponse(BaseModel):
    """Response from file transcription."""
    text: str
    refined_text: Optional[str] = None
    language: str
    duration: float
    output_url: str
    output_format: str
    processing_time_ms: int
    segments: List[Dict[str, Any]]


# =============================================================================
# Helpers
# =============================================================================


def _cleanup_old_transcripts() -> None:
    """Delete transcript files older than TRANSCRIPT_MAX_AGE_SECONDS."""
    if not TRANSCRIPT_CACHE_DIR.exists():
        return
    now = time.time()
    for f in TRANSCRIPT_CACHE_DIR.iterdir():
        try:
            if f.is_file() and now - f.stat().st_mtime > TRANSCRIPT_MAX_AGE_SECONDS:
                f.unlink()
        except OSError:
            pass


def format_srt_time(seconds: float) -> str:
    """Format seconds as SRT timestamp HH:MM:SS,mmm."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_vtt_time(seconds: float) -> str:
    """Format seconds as VTT timestamp HH:MM:SS.mmm."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def segments_to_srt(segments: List[Dict[str, Any]]) -> str:
    """Convert transcript segments to SRT subtitle format."""
    lines = []
    for i, seg in enumerate(segments, 1):
        start = format_srt_time(seg["start"])
        end = format_srt_time(seg["end"])
        text = seg.get("text", "").strip()
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)


def segments_to_vtt(segments: List[Dict[str, Any]]) -> str:
    """Convert transcript segments to WebVTT subtitle format."""
    lines = ["WEBVTT", ""]
    for i, seg in enumerate(segments, 1):
        start = format_vtt_time(seg["start"])
        end = format_vtt_time(seg["end"])
        text = seg.get("text", "").strip()
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)


def _save_output(text: str, output_format: str) -> str:
    """Save transcription output to cache dir and return filename."""
    TRANSCRIPT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    ext = output_format if output_format in ("txt", "srt", "vtt") else "txt"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = TRANSCRIPT_CACHE_DIR / filename
    filepath.write_text(text, encoding="utf-8")
    return filename


async def _transcribe_and_format(
    file_path: Path,
    language: str,
    output_format: str,
    refine: bool,
    refine_provider: Optional[str],
    custom_prompt: Optional[str],
) -> FileTranscribeResponse:
    """Core transcription logic shared by upload and path endpoints."""
    start_time = time.time()
    engine = get_engine()

    lang_arg = language if language else None

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, engine.transcribe_file, file_path, lang_arg
    )

    if not result.text and not result.segments:
        raise HTTPException(status_code=500, detail="Transcription produced no output")

    # Format output
    if output_format == "srt":
        output_text = segments_to_srt(result.segments)
    elif output_format == "vtt":
        output_text = segments_to_vtt(result.segments)
    else:
        output_text = result.text

    # Optional refinement (only for txt format)
    refined_text = None
    if refine and output_format == "txt":
        if refine_provider and refine_provider not in PROVIDER_REGISTRY:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown refiner provider: {refine_provider}",
            )
        refiner = get_refiner()
        was_enabled = refiner._enabled
        refiner._enabled = True
        try:
            refine_result = await refiner.process(
                result.text,
                provider_override=refine_provider,
                prompt_override=custom_prompt,
            )
            refined_text = refine_result.refined_text
            output_text = refined_text  # Save refined version
        finally:
            refiner._enabled = was_enabled

    # Save output file
    _cleanup_old_transcripts()
    filename = _save_output(output_text, output_format)
    processing_time_ms = round((time.time() - start_time) * 1000)

    return FileTranscribeResponse(
        text=result.text,
        refined_text=refined_text,
        language=result.language,
        duration=result.duration,
        output_url=f"/transcribe/file/output/{filename}",
        output_format=output_format,
        processing_time_ms=processing_time_ms,
        segments=result.segments,
    )


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/upload", response_model=FileTranscribeResponse)
async def upload_and_transcribe(
    file: UploadFile = File(...),
    language: str = "",
    output_format: str = "txt",
    refine: bool = False,
    refine_provider: Optional[str] = None,
    custom_prompt: Optional[str] = None,
) -> FileTranscribeResponse:
    """
    Upload an audio/video file and transcribe it.

    Accepts multipart form upload. The file is saved to a temp location,
    transcribed with Whisper, and optionally refined.
    """
    if output_format not in ("txt", "srt", "vtt"):
        raise HTTPException(status_code=400, detail="output_format must be txt, srt, or vtt")

    # Read uploaded file
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    # Save to temp file
    filename = file.filename or "upload.webm"
    suffix = Path(filename).suffix or ".webm"
    tmp_path = Path(f"/tmp/bacon-upload-{uuid.uuid4().hex}{suffix}")
    tmp_path.write_bytes(audio_bytes)

    try:
        return await _transcribe_and_format(
            tmp_path, language, output_format, refine, refine_provider, custom_prompt
        )
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass


@router.post("/path", response_model=FileTranscribeResponse)
async def transcribe_local_path(options: FileTranscribeOptions) -> FileTranscribeResponse:
    """
    Transcribe a file from a local filesystem path.

    The file must exist and be a supported audio/video format.
    """
    if options.output_format not in ("txt", "srt", "vtt"):
        raise HTTPException(status_code=400, detail="output_format must be txt, srt, or vtt")

    file_path = Path(options.path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {options.path}")
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {options.path}")
    if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {file_path.suffix}. Supported: {sorted(SUPPORTED_EXTENSIONS)}",
        )

    return await _transcribe_and_format(
        file_path,
        options.language,
        options.output_format,
        options.refine,
        options.refine_provider,
        options.custom_prompt,
    )


@router.get("/output/{filename}")
async def get_output_file(filename: str):
    """Serve a transcription output file from the cache."""
    if not _FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = TRANSCRIPT_CACHE_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Output file not found or expired")

    media_types = {
        ".txt": "text/plain",
        ".srt": "text/plain",
        ".vtt": "text/vtt",
    }
    ext = Path(filename).suffix
    media_type = media_types.get(ext, "text/plain")

    return FileResponse(
        path=str(filepath),
        media_type=media_type,
        filename=filename,
    )
