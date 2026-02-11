"""
Audio Format Converter for BACON-AI Voice Backend

Primary strategy: pass audio directly to Faster-Whisper which handles
format conversion via ffmpeg internally.

Fallback strategy: convert to WAV 16kHz mono using pydub/ffmpeg when
direct passthrough is not viable (e.g., concatenating WebSocket chunks).
"""

import io
import logging
import struct
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Formats that Faster-Whisper / ffmpeg can handle directly
SUPPORTED_FORMATS = {"wav", "webm", "mp3", "ogg", "flac", "m4a", "opus"}
WHISPER_SAMPLE_RATE = 16000


def get_format_from_filename(filename: str) -> Optional[str]:
    """
    Extract audio format from filename extension.

    Args:
        filename: Original filename.

    Returns:
        Lowercase format string or None if unknown.
    """
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext in SUPPORTED_FORMATS:
        return ext
    return None


def is_format_supported(fmt: str) -> bool:
    """Check if a format is supported for transcription."""
    return fmt.lower() in SUPPORTED_FORMATS


def save_temp_audio(audio_bytes: bytes, suffix: str = ".webm") -> Path:
    """
    Save audio bytes to a temporary file for transcription.

    Faster-Whisper accepts file paths and handles format conversion
    internally via ffmpeg, so we just need to write the bytes to disk.

    Args:
        audio_bytes: Raw audio data bytes.
        suffix: File extension (e.g., ".webm", ".wav").

    Returns:
        Path to the temporary file.
    """
    if not suffix.startswith("."):
        suffix = f".{suffix}"

    tmp = tempfile.NamedTemporaryFile(
        suffix=suffix,
        delete=False,
        prefix="bacon_voice_",
    )
    tmp.write(audio_bytes)
    tmp.close()
    return Path(tmp.name)


def convert_to_wav(
    audio_bytes: bytes,
    source_format: str = "webm",
) -> Optional[bytes]:
    """
    Convert audio bytes to WAV 16kHz mono using pydub (fallback).

    This is used when we need to concatenate WebSocket audio chunks
    and produce a single file for Faster-Whisper.

    Args:
        audio_bytes: Raw audio data in source_format.
        source_format: Source format (e.g., "webm", "mp3").

    Returns:
        WAV bytes at 16kHz mono, or None on failure.
    """
    try:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(
            io.BytesIO(audio_bytes),
            format=source_format,
        )
        # Convert to 16kHz mono
        audio = audio.set_frame_rate(WHISPER_SAMPLE_RATE).set_channels(1)

        wav_buffer = io.BytesIO()
        audio.export(wav_buffer, format="wav")
        wav_buffer.seek(0)
        return wav_buffer.read()

    except ImportError:
        logger.error("pydub not installed; cannot convert audio format")
        return None
    except Exception as e:
        logger.error("Audio conversion failed (%s -> wav): %s", source_format, e)
        return None


def concatenate_webm_to_wav(chunks: list[bytes]) -> Optional[bytes]:
    """
    Concatenate multiple WebM/Opus audio chunks into a single WAV file.

    This is the primary path for WebSocket-based recording: the browser
    sends WebM/Opus chunks, which we concatenate and convert to WAV.

    Args:
        chunks: List of audio data byte chunks (WebM/Opus from MediaRecorder).

    Returns:
        WAV bytes at 16kHz mono, or None on failure.
    """
    if not chunks:
        return None

    combined = b"".join(chunks)

    if not combined:
        return None

    # Try pydub conversion first (handles WebM/Opus properly)
    wav_bytes = convert_to_wav(combined, source_format="webm")
    if wav_bytes:
        return wav_bytes

    # If pydub fails, save as temp file and let Faster-Whisper handle it
    logger.warning("pydub conversion failed; saving raw WebM for Faster-Whisper")
    return combined


def create_silence_wav(duration_seconds: float = 0.5) -> bytes:
    """
    Create a silent WAV file (useful for testing).

    Args:
        duration_seconds: Duration of silence in seconds.

    Returns:
        WAV bytes containing silence.
    """
    num_samples = int(WHISPER_SAMPLE_RATE * duration_seconds)
    # 16-bit PCM silence
    samples = b"\x00\x00" * num_samples

    # Build WAV header
    data_size = len(samples)
    wav = io.BytesIO()
    # RIFF header
    wav.write(b"RIFF")
    wav.write(struct.pack("<I", 36 + data_size))
    wav.write(b"WAVE")
    # fmt chunk
    wav.write(b"fmt ")
    wav.write(struct.pack("<I", 16))  # chunk size
    wav.write(struct.pack("<H", 1))  # PCM format
    wav.write(struct.pack("<H", 1))  # mono
    wav.write(struct.pack("<I", WHISPER_SAMPLE_RATE))  # sample rate
    wav.write(struct.pack("<I", WHISPER_SAMPLE_RATE * 2))  # byte rate
    wav.write(struct.pack("<H", 2))  # block align
    wav.write(struct.pack("<H", 16))  # bits per sample
    # data chunk
    wav.write(b"data")
    wav.write(struct.pack("<I", data_size))
    wav.write(samples)

    wav.seek(0)
    return wav.read()
