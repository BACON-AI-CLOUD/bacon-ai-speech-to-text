"""
Faster-Whisper STT Engine for BACON-AI Voice Backend

Provides speech-to-text transcription using Faster-Whisper with:
- Automatic GPU detection (CUDA/ROCm/CPU)
- Lazy model loading and model switching
- Model download with progress callback support
- Structured transcription results
- File and numpy-array transcription

Adapted from bacon-ai-voice-mcp whisper_engine.py for the FastAPI backend.
"""

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from ..config import STT_MODELS, detect_gpu, get_model_cache_dir

logger = logging.getLogger(__name__)


# =============================================================================
# Data Structures
# =============================================================================


@dataclass
class TranscriptionResult:
    """Structured result from a transcription operation."""

    text: str
    confidence: float
    language: str
    duration: float
    segments: List[Dict[str, Any]]
    model_used: Optional[str] = None
    processing_time: float = 0.0


@dataclass
class ModelInfo:
    """Information about a loaded or available model."""

    name: str
    size_mb: int
    accuracy_est: str
    loaded: bool = False
    downloading: bool = False
    download_progress: float = 0.0


# =============================================================================
# Whisper Engine
# =============================================================================


class WhisperEngine:
    """
    Faster-Whisper based Speech-to-Text engine.

    Features:
    - Automatic GPU detection (CUDA/ROCm/CPU)
    - Model auto-selection based on hardware
    - Lazy model loading
    - Model switching (unload current, load new)
    - Model download with progress callbacks
    - Segment-level confidence scores
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
        download_root: Optional[Path] = None,
    ):
        """
        Initialize the Whisper STT engine.

        Args:
            model_name: Model name or None for auto-detect.
            device: "cuda", "cpu", or None for auto-detect.
            compute_type: "float16", "int8", etc. or None for auto.
            download_root: Directory for model downloads.
        """
        self._model: Any = None
        self._model_name: Optional[str] = None
        self._device: Optional[str] = None
        self._compute_type: Optional[str] = None
        self._gpu_info: Dict[str, Any] = {}
        self._download_root = download_root or get_model_cache_dir()
        self._downloading: bool = False
        self._download_progress: float = 0.0

        # Detect hardware and configure
        self._gpu_info = detect_gpu()

        # Set device
        if device:
            self._device = device
        elif self._gpu_info["gpu_available"]:
            self._device = self._gpu_info["gpu_type"]
        else:
            self._device = "cpu"

        # Set compute type
        if compute_type:
            self._compute_type = compute_type
        else:
            self._compute_type = self._gpu_info["compute_type"]

        # Set target model
        if model_name and model_name in STT_MODELS:
            self._target_model = model_name
        else:
            self._target_model = self._gpu_info["recommended_model"]

        logger.info(
            "WhisperEngine configured: device=%s, compute_type=%s, target_model=%s",
            self._device,
            self._compute_type,
            self._target_model,
        )

    # -------------------------------------------------------------------------
    # Model Management
    # -------------------------------------------------------------------------

    def load_model(
        self,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> bool:
        """
        Load the target Whisper model (lazy).

        Args:
            progress_callback: Optional callback receiving download progress 0.0-1.0.

        Returns:
            True if model loaded successfully.
        """
        if self._model is not None and self._model_name == self._target_model:
            return True

        try:
            from faster_whisper import WhisperModel

            logger.info("Loading Whisper model: %s", self._target_model)
            self._downloading = True
            self._download_progress = 0.0
            start_time = time.time()

            if progress_callback:
                progress_callback(0.0)

            # Unload existing model if any
            if self._model is not None:
                logger.info("Unloading current model: %s", self._model_name)
                del self._model
                self._model = None
                self._model_name = None

            self._model = WhisperModel(
                self._target_model,
                device=self._device,
                compute_type=self._compute_type,
                download_root=str(self._download_root),
            )

            self._model_name = self._target_model
            self._downloading = False
            self._download_progress = 1.0
            load_time = time.time() - start_time

            if progress_callback:
                progress_callback(1.0)

            logger.info("Model '%s' loaded in %.2fs", self._model_name, load_time)
            return True

        except ImportError as e:
            logger.error("faster-whisper not installed: %s", e)
            self._downloading = False
            return False
        except Exception as e:
            logger.error("Failed to load model '%s': %s", self._target_model, e)
            self._downloading = False
            return False

    def switch_model(self, model_name: str) -> bool:
        """
        Switch to a different model (unload current, load new).

        Args:
            model_name: Model name from STT_MODELS (tiny/base/small/medium/large-v3).

        Returns:
            True if switch was successful.
        """
        if model_name not in STT_MODELS:
            logger.error("Unknown model: %s. Available: %s", model_name, list(STT_MODELS.keys()))
            return False

        self._target_model = model_name
        # Force reload by clearing current model
        self._model = None
        self._model_name = None

        return self.load_model()

    def unload_model(self) -> None:
        """Unload the current model to free memory."""
        if self._model is not None:
            logger.info("Unloading model: %s", self._model_name)
            del self._model
            self._model = None
            self._model_name = None

    # -------------------------------------------------------------------------
    # Transcription
    # -------------------------------------------------------------------------

    def transcribe_file(
        self,
        file_path: Path,
        language: Optional[str] = "en",
    ) -> TranscriptionResult:
        """
        Transcribe an audio file.

        Faster-Whisper handles format conversion internally via ffmpeg,
        so WebM, WAV, MP3, OGG, FLAC, etc. are all accepted.

        Args:
            file_path: Path to the audio file.
            language: Language code or None for auto-detect.

        Returns:
            TranscriptionResult with text, confidence, segments, etc.
        """
        if not self.load_model():
            return TranscriptionResult(
                text="",
                confidence=0.0,
                language="unknown",
                duration=0.0,
                segments=[],
                model_used=self._target_model,
                processing_time=0.0,
            )

        file_path = Path(file_path)
        if not file_path.exists():
            logger.error("File not found: %s", file_path)
            return TranscriptionResult(
                text="",
                confidence=0.0,
                language="unknown",
                duration=0.0,
                segments=[{"error": f"File not found: {file_path}"}],
                model_used=self._target_model,
                processing_time=0.0,
            )

        start_time = time.time()

        try:
            segments_gen, info = self._model.transcribe(
                str(file_path),
                language=language,
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=400,
                ),
            )

            return self._collect_segments(
                segments_gen, info, start_time, self._model_name
            )

        except Exception as e:
            logger.error("File transcription failed: %s", e)
            return TranscriptionResult(
                text="",
                confidence=0.0,
                language="unknown",
                duration=0.0,
                segments=[{"error": str(e)}],
                model_used=self._target_model,
                processing_time=time.time() - start_time,
            )

    def transcribe_audio(
        self,
        audio_data: Any,  # numpy ndarray
        sample_rate: int = 16000,
        language: Optional[str] = "en",
    ) -> TranscriptionResult:
        """
        Transcribe raw audio data (numpy array).

        Args:
            audio_data: Numpy array of audio samples (float32, mono).
            sample_rate: Sample rate in Hz.
            language: Language code or None for auto-detect.

        Returns:
            TranscriptionResult.
        """
        import numpy as np

        if not self.load_model():
            return TranscriptionResult(
                text="",
                confidence=0.0,
                language="unknown",
                duration=0.0,
                segments=[],
                model_used=self._target_model,
                processing_time=0.0,
            )

        start_time = time.time()

        # Ensure float32 and normalized
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)

        max_val = np.abs(audio_data).max()
        if max_val > 1.0:
            audio_data = audio_data / max_val

        # Resample to 16kHz if needed
        if sample_rate != 16000:
            try:
                from scipy import signal

                num_samples = int(len(audio_data) * 16000 / sample_rate)
                audio_data = signal.resample(audio_data, num_samples)
            except ImportError:
                logger.warning("scipy not available for resampling; proceeding with original sample rate")

        duration = len(audio_data) / 16000

        try:
            segments_gen, info = self._model.transcribe(
                audio_data,
                language=language,
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=400,
                ),
            )

            return self._collect_segments(
                segments_gen, info, start_time, self._model_name
            )

        except Exception as e:
            logger.error("Audio transcription failed: %s", e)
            return TranscriptionResult(
                text="",
                confidence=0.0,
                language="unknown",
                duration=duration,
                segments=[{"error": str(e)}],
                model_used=self._target_model,
                processing_time=time.time() - start_time,
            )

    # -------------------------------------------------------------------------
    # Status & Info
    # -------------------------------------------------------------------------

    def get_status(self) -> Dict[str, Any]:
        """Get engine status and configuration."""
        return {
            "engine": "faster-whisper",
            "model_loaded": self._model is not None,
            "current_model": self._model_name,
            "target_model": self._target_model,
            "device": self._device,
            "compute_type": self._compute_type,
            "gpu_available": self._gpu_info.get("gpu_available", False),
            "gpu_type": self._gpu_info.get("gpu_type"),
            "gpu_name": self._gpu_info.get("gpu_name"),
            "vram_mb": self._gpu_info.get("vram_mb", 0),
            "models_dir": str(self._download_root),
            "available_models": list(STT_MODELS.keys()),
            "downloading": self._downloading,
            "download_progress": self._download_progress,
        }

    def get_models_info(self) -> List[ModelInfo]:
        """Get information about all available models."""
        models = []
        for name, cfg in STT_MODELS.items():
            models.append(
                ModelInfo(
                    name=name,
                    size_mb=cfg["size_mb"],
                    accuracy_est=cfg["accuracy_est"],
                    loaded=(self._model_name == name and self._model is not None),
                    downloading=(self._downloading and self._target_model == name),
                    download_progress=(
                        self._download_progress
                        if self._target_model == name
                        else 0.0
                    ),
                )
            )
        return models

    def get_gpu_info(self) -> Dict[str, Any]:
        """Get GPU detection results."""
        return dict(self._gpu_info)

    def is_ready(self) -> bool:
        """Check if engine has a model loaded and is ready to transcribe."""
        return self._model is not None

    @property
    def current_model(self) -> Optional[str]:
        """Name of the currently loaded model, or None."""
        return self._model_name

    @property
    def target_model(self) -> str:
        """Name of the target model (may not be loaded yet)."""
        return self._target_model

    # -------------------------------------------------------------------------
    # Internal Helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def _collect_segments(
        segments_gen: Any,
        info: Any,
        start_time: float,
        model_name: Optional[str],
    ) -> TranscriptionResult:
        """Collect segments from Faster-Whisper generator into a TranscriptionResult."""
        segments: List[Dict[str, Any]] = []
        full_text_parts: List[str] = []
        total_confidence = 0.0
        segment_count = 0

        for segment in segments_gen:
            seg_dict = {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "avg_logprob": segment.avg_logprob,
                "no_speech_prob": segment.no_speech_prob,
            }
            segments.append(seg_dict)
            full_text_parts.append(segment.text.strip())

            # Confidence from log probability: avg_logprob is typically -0.5 to 0
            segment_conf = min(1.0, max(0.0, 1.0 + segment.avg_logprob))
            total_confidence += segment_conf
            segment_count += 1

        full_text = " ".join(full_text_parts)
        avg_confidence = total_confidence / segment_count if segment_count > 0 else 0.0
        processing_time = time.time() - start_time

        return TranscriptionResult(
            text=full_text,
            confidence=avg_confidence,
            language=info.language if info.language else "en",
            duration=info.duration if info.duration else 0.0,
            segments=segments,
            model_used=model_name,
            processing_time=processing_time,
        )


# =============================================================================
# Singleton Factory
# =============================================================================

_engine_instance: Optional[WhisperEngine] = None


def get_engine(
    model_name: Optional[str] = None,
    force_new: bool = False,
) -> WhisperEngine:
    """
    Get or create the WhisperEngine singleton.

    Args:
        model_name: Model name or None for auto-detect.
        force_new: Force creation of a new engine instance.

    Returns:
        WhisperEngine instance.
    """
    global _engine_instance

    if _engine_instance is None or force_new:
        _engine_instance = WhisperEngine(model_name=model_name)

    return _engine_instance
