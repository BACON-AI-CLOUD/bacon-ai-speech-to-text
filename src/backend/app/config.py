"""
BACON-AI Voice Backend Configuration

GPU auto-detection, model configurations, and server settings.
Adapted from bacon-ai-voice-mcp config.py for the FastAPI backend.
"""

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# =============================================================================
# Server Settings
# =============================================================================

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8765
SERVER_VERSION = "0.1.0"

# =============================================================================
# STT Model Configuration
# =============================================================================

STT_MODELS: Dict[str, Dict[str, Any]] = {
    "tiny": {
        "name": "tiny",
        "size_mb": 75,
        "accuracy_est": "~85%",
        "speed": "fastest",
        "vram_mb": 1000,
        "description": "Smallest model, fastest but less accurate",
    },
    "base": {
        "name": "base",
        "size_mb": 150,
        "accuracy_est": "~90%",
        "speed": "very fast",
        "vram_mb": 1000,
        "description": "Good balance for CPU or limited GPU",
    },
    "small": {
        "name": "small",
        "size_mb": 500,
        "accuracy_est": "~93%",
        "speed": "fast",
        "vram_mb": 2000,
        "description": "Better accuracy, moderate resources",
    },
    "medium": {
        "name": "medium",
        "size_mb": 1500,
        "accuracy_est": "~95%",
        "speed": "moderate",
        "vram_mb": 5000,
        "description": "High accuracy, needs good GPU",
    },
    "large-v3": {
        "name": "large-v3",
        "size_mb": 3000,
        "accuracy_est": "~97%+",
        "speed": "slower",
        "vram_mb": 10000,
        "description": "Best accuracy, requires powerful GPU",
    },
}

# =============================================================================
# GPU Detection
# =============================================================================


def detect_gpu() -> Dict[str, Any]:
    """
    Detect available GPU for STT acceleration.

    Checks for NVIDIA (CUDA) and AMD (ROCm) GPUs in that order,
    falling back to CPU with int8 compute type.

    Returns:
        Dict with gpu_available, gpu_type, gpu_name, vram_mb,
        compute_type, and recommended_model.
    """
    result: Dict[str, Any] = {
        "gpu_available": False,
        "gpu_type": None,
        "gpu_name": None,
        "vram_mb": 0,
        "compute_type": "int8",  # CPU default
        "recommended_model": "base",
    }

    # Check for NVIDIA GPU (CUDA)
    try:
        nvidia_output = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total",
                "--format=csv,noheader,nounits",
            ],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()

        if nvidia_output:
            parts = nvidia_output.split(",")
            gpu_name = parts[0].strip()
            vram_mb = int(parts[1].strip())

            result["gpu_available"] = True
            result["gpu_type"] = "cuda"
            result["gpu_name"] = gpu_name
            result["vram_mb"] = vram_mb
            result["compute_type"] = "float16"

            # Recommend model based on VRAM
            if vram_mb >= 10000:
                result["recommended_model"] = "large-v3"
            elif vram_mb >= 5000:
                result["recommended_model"] = "medium"
            elif vram_mb >= 2000:
                result["recommended_model"] = "small"
            else:
                result["recommended_model"] = "base"

            return result
    except (subprocess.SubprocessError, FileNotFoundError, ValueError):
        pass

    # Check for AMD GPU (ROCm)
    try:
        rocm_output = subprocess.check_output(
            ["rocm-smi", "--showmeminfo", "vram"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()

        if "Total" in rocm_output:
            result["gpu_available"] = True
            result["gpu_type"] = "rocm"
            result["gpu_name"] = "AMD GPU"
            result["compute_type"] = "float16"
            result["recommended_model"] = "base"
            return result
    except (subprocess.SubprocessError, FileNotFoundError):
        pass

    # No GPU found - CPU mode
    logger.info("No GPU detected, using CPU with int8 compute type")
    return result


def get_default_model() -> str:
    """
    Get the recommended STT model based on available hardware.

    Returns:
        Model name string (e.g., "base", "large-v3").
    """
    gpu_info = detect_gpu()
    return gpu_info["recommended_model"]


# =============================================================================
# Paths Configuration
# =============================================================================


def get_model_cache_dir() -> Path:
    """
    Get the directory for caching Whisper models.

    Checks BACON_VOICE_MODELS_DIR env var first, then falls back
    to ~/.cache/whisper.
    """
    env_dir = os.environ.get("BACON_VOICE_MODELS_DIR")
    if env_dir:
        p = Path(env_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    cache_dir = Path.home() / ".cache" / "whisper"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


# =============================================================================
# Settings Persistence
# =============================================================================

_CONFIG_DIR = Path.home() / ".config" / "bacon-ai-voice"
_CONFIG_FILE = _CONFIG_DIR / "config.json"

_DEFAULT_SETTINGS: Dict[str, Any] = {
    "host": SERVER_HOST,
    "port": SERVER_PORT,
    "model": None,  # None = auto-detect
    "language": "en",
    "model_cache_dir": None,  # None = default
}


def load_settings() -> Dict[str, Any]:
    """
    Load settings from config.json, falling back to defaults.

    Returns:
        Settings dictionary.
    """
    settings = dict(_DEFAULT_SETTINGS)

    if _CONFIG_FILE.exists():
        try:
            with open(_CONFIG_FILE, "r") as f:
                saved = json.load(f)
            settings.update(saved)
            logger.info("Loaded settings from %s", _CONFIG_FILE)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to load settings: %s", e)

    return settings


def save_settings(settings: Dict[str, Any]) -> bool:
    """
    Save settings to config.json.

    Args:
        settings: Settings dictionary to persist.

    Returns:
        True if saved successfully.
    """
    try:
        _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(_CONFIG_FILE, "w") as f:
            json.dump(settings, f, indent=2)
        logger.info("Saved settings to %s", _CONFIG_FILE)
        return True
    except OSError as e:
        logger.error("Failed to save settings: %s", e)
        return False
