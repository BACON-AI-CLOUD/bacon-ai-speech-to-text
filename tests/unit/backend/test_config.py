"""
Tests for app.config module - settings, GPU detection, model configs.
"""

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure backend source is on path
backend_src = Path(__file__).resolve().parents[3] / "src" / "backend"
if str(backend_src) not in sys.path:
    sys.path.insert(0, str(backend_src))

from app.config import (
    STT_MODELS,
    SERVER_HOST,
    SERVER_PORT,
    SERVER_VERSION,
    detect_gpu,
    get_default_model,
    get_model_cache_dir,
    load_settings,
    save_settings,
)


class TestSTTModels:
    """Tests for STT model configurations."""

    def test_all_models_present(self):
        """All five standard models should be defined."""
        expected = {"tiny", "base", "small", "medium", "large-v3"}
        assert set(STT_MODELS.keys()) == expected

    def test_model_has_required_fields(self):
        """Each model config should have name, size_mb, accuracy_est, vram_mb."""
        for name, cfg in STT_MODELS.items():
            assert "name" in cfg, f"{name} missing 'name'"
            assert "size_mb" in cfg, f"{name} missing 'size_mb'"
            assert "accuracy_est" in cfg, f"{name} missing 'accuracy_est'"
            assert "vram_mb" in cfg, f"{name} missing 'vram_mb'"

    def test_model_sizes_ascending(self):
        """Model sizes should generally increase from tiny to large-v3."""
        order = ["tiny", "base", "small", "medium", "large-v3"]
        sizes = [STT_MODELS[m]["size_mb"] for m in order]
        for i in range(len(sizes) - 1):
            assert sizes[i] < sizes[i + 1], (
                f"{order[i]} ({sizes[i]}MB) should be smaller than "
                f"{order[i+1]} ({sizes[i+1]}MB)"
            )


class TestGPUDetection:
    """Tests for GPU detection (mocked to avoid hardware dependency)."""

    def test_detect_gpu_returns_dict(self):
        """detect_gpu should return a dict with expected keys."""
        # Use real detect_gpu but it will find no GPU in CI
        result = detect_gpu()
        assert isinstance(result, dict)
        assert "gpu_available" in result
        assert "gpu_type" in result
        assert "compute_type" in result
        assert "recommended_model" in result

    def test_cpu_fallback(self):
        """When no GPU found, should use CPU with int8."""
        with patch("app.config.subprocess.check_output", side_effect=FileNotFoundError):
            result = detect_gpu()
            assert result["gpu_available"] is False
            assert result["compute_type"] == "int8"
            assert result["recommended_model"] == "base"

    def test_nvidia_gpu_detected(self):
        """When nvidia-smi returns data, should detect CUDA GPU."""
        nvidia_output = "NVIDIA GeForce RTX 3080, 10240"

        with patch("app.config.subprocess.check_output", return_value=nvidia_output):
            result = detect_gpu()
            assert result["gpu_available"] is True
            assert result["gpu_type"] == "cuda"
            assert result["gpu_name"] == "NVIDIA GeForce RTX 3080"
            assert result["vram_mb"] == 10240
            assert result["compute_type"] == "float16"
            assert result["recommended_model"] == "large-v3"

    def test_small_gpu_recommends_base(self):
        """A GPU with <2GB VRAM should recommend base model."""
        nvidia_output = "NVIDIA GeForce GT 1030, 1500"

        with patch("app.config.subprocess.check_output", return_value=nvidia_output):
            result = detect_gpu()
            assert result["recommended_model"] == "base"


class TestGetDefaultModel:
    """Tests for get_default_model."""

    def test_returns_string(self):
        """get_default_model should return a model name string."""
        with patch("app.config.detect_gpu") as mock_gpu:
            mock_gpu.return_value = {
                "gpu_available": False,
                "gpu_type": None,
                "gpu_name": None,
                "vram_mb": 0,
                "compute_type": "int8",
                "recommended_model": "base",
            }
            result = get_default_model()
            assert result == "base"
            assert result in STT_MODELS


class TestModelCacheDir:
    """Tests for model cache directory."""

    def test_returns_path(self):
        """get_model_cache_dir should return a Path."""
        result = get_model_cache_dir()
        assert isinstance(result, Path)

    def test_env_var_override(self, tmp_path, monkeypatch):
        """BACON_VOICE_MODELS_DIR env var should override default."""
        custom_dir = str(tmp_path / "custom_models")
        monkeypatch.setenv("BACON_VOICE_MODELS_DIR", custom_dir)
        result = get_model_cache_dir()
        assert result == Path(custom_dir)


class TestSettings:
    """Tests for settings load/save."""

    def test_load_defaults(self, monkeypatch, tmp_path):
        """load_settings should return defaults when no config file exists."""
        # Point config file to non-existent location
        monkeypatch.setattr("app.config._CONFIG_FILE", tmp_path / "nonexistent.json")
        settings = load_settings()
        assert settings["host"] == SERVER_HOST
        assert settings["port"] == SERVER_PORT
        assert settings["language"] == "en"

    def test_save_and_load(self, monkeypatch, tmp_path):
        """Settings should survive save/load round-trip."""
        config_dir = tmp_path / "config"
        config_file = config_dir / "config.json"
        monkeypatch.setattr("app.config._CONFIG_DIR", config_dir)
        monkeypatch.setattr("app.config._CONFIG_FILE", config_file)

        settings = {"host": "0.0.0.0", "port": 9999, "model": "small"}
        assert save_settings(settings) is True
        assert config_file.exists()

        loaded = load_settings()
        assert loaded["host"] == "0.0.0.0"
        assert loaded["port"] == 9999
        assert loaded["model"] == "small"


class TestServerConstants:
    """Tests for server constant values."""

    def test_host_is_localhost(self):
        assert SERVER_HOST == "127.0.0.1"

    def test_port_is_version_based(self):
        from app.config import APP_VERSION
        assert SERVER_PORT == 8700 + APP_VERSION

    def test_version_format(self):
        """Version should be a semver-like string."""
        parts = SERVER_VERSION.split(".")
        assert len(parts) >= 2
