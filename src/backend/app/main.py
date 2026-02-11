"""
BACON-AI Voice Backend - FastAPI Application

Provides REST and WebSocket endpoints for speech-to-text transcription
using Faster-Whisper with GPU acceleration, plus integration backends
for routing transcribed text to Claude API, Claude Code, or MCP tools.

Endpoints:
    GET  /health              - Server health and status
    GET  /models              - Available Whisper models
    POST /models/{name}/load  - Load/switch Whisper model
    POST /transcribe          - Transcribe uploaded audio file
    POST /chat                - Send message to Claude API (FEAT-006)
    GET  /integrations        - List available integration backends
    POST /integrations/send   - Send text to selected backend
    WS   /ws/audio            - WebSocket for real-time audio streaming
"""

import asyncio
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .audio.converter import (
    concatenate_webm_to_wav,
    get_format_from_filename,
    save_temp_audio,
)
from .config import (
    SERVER_HOST,
    SERVER_PORT,
    SERVER_VERSION,
    STT_MODELS,
    detect_gpu,
    load_settings,
)
from .integrations.router import get_router
from .stt.whisper_engine import WhisperEngine, get_engine

logger = logging.getLogger(__name__)


# =============================================================================
# Request / Response Models for Integration Endpoints
# =============================================================================


class ChatRequest(BaseModel):
    """Request body for the /chat endpoint."""

    text: str
    system_prompt: Optional[str] = None
    model: Optional[str] = None


class IntegrationSendRequest(BaseModel):
    """Request body for the /integrations/send endpoint."""

    text: str
    backend: Optional[str] = None
    options: Optional[Dict[str, Any]] = None


# =============================================================================
# Application Lifecycle
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    gpu_info = detect_gpu()
    logger.info("BACON-AI Voice Backend v%s starting", SERVER_VERSION)
    logger.info(
        "GPU: %s (type=%s, vram=%dMB)",
        gpu_info.get("gpu_name", "None"),
        gpu_info.get("gpu_type", "cpu"),
        gpu_info.get("vram_mb", 0),
    )
    logger.info("Available models: %s", list(STT_MODELS.keys()))

    settings = load_settings()
    logger.info("Server configured on %s:%s", settings["host"], settings["port"])

    yield

    # Shutdown
    engine = get_engine()
    engine.unload_model()
    logger.info("BACON-AI Voice Backend shut down")


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="BACON-AI Voice Backend",
    description="Speech-to-Text service with Faster-Whisper and GPU acceleration",
    version=SERVER_VERSION,
    lifespan=lifespan,
)

# CORS middleware for localhost development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# REST Endpoints
# =============================================================================


@app.get("/health")
async def health() -> Dict[str, Any]:
    """
    Health check endpoint.

    Returns server status, GPU info, model info, and version.
    """
    engine = get_engine()
    gpu_info = engine.get_gpu_info()
    status = engine.get_status()

    return {
        "status": "ok",
        "gpu_info": {
            "available": gpu_info.get("gpu_available", False),
            "type": gpu_info.get("gpu_type"),
            "name": gpu_info.get("gpu_name"),
            "vram_mb": gpu_info.get("vram_mb", 0),
        },
        "model_info": {
            "loaded": status["model_loaded"],
            "current": status["current_model"],
            "target": status["target_model"],
            "device": status["device"],
            "compute_type": status["compute_type"],
        },
        "server_version": SERVER_VERSION,
    }


@app.get("/models")
async def list_models() -> Dict[str, Any]:
    """
    List all available Whisper models with their status.

    Returns model list, current model, and GPU info.
    """
    engine = get_engine()
    models_info = engine.get_models_info()
    gpu_info = engine.get_gpu_info()

    models_list = []
    for m in models_info:
        models_list.append({
            "name": m.name,
            "size_mb": m.size_mb,
            "loaded": m.loaded,
            "accuracy_est": m.accuracy_est,
            "downloading": m.downloading,
            "download_progress": m.download_progress,
        })

    return {
        "models": models_list,
        "current": engine.current_model,
        "gpu": {
            "available": gpu_info.get("gpu_available", False),
            "type": gpu_info.get("gpu_type"),
            "name": gpu_info.get("gpu_name"),
            "vram_mb": gpu_info.get("vram_mb", 0),
        },
    }


@app.post("/models/{name}/load")
async def load_model(name: str) -> Dict[str, Any]:
    """
    Load or switch to a specific Whisper model.

    This may trigger a model download if not cached locally.

    Args:
        name: Model name (tiny, base, small, medium, large-v3).
    """
    if name not in STT_MODELS:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Unknown model: {name}",
                "available": list(STT_MODELS.keys()),
            },
        )

    engine = get_engine()

    # Run model loading in a thread to not block the event loop
    loop = asyncio.get_event_loop()
    success = await loop.run_in_executor(None, engine.switch_model, name)

    if success:
        return {
            "status": "loaded",
            "model": name,
            "device": engine.get_status()["device"],
            "compute_type": engine.get_status()["compute_type"],
        }
    else:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to load model: {name}"},
        )


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Transcribe an uploaded audio file.

    Accepts WAV, WebM, MP3, OGG, FLAC, and other ffmpeg-supported formats.

    Args:
        file: Uploaded audio file (multipart form data).
    """
    engine = get_engine()

    # Read uploaded file
    audio_bytes = await file.read()
    if not audio_bytes:
        return JSONResponse(
            status_code=400,
            content={"error": "Empty audio file"},
        )

    # Determine format from filename
    filename = file.filename or "audio.webm"
    fmt = get_format_from_filename(filename) or "webm"

    # Save to temp file for Faster-Whisper
    tmp_path = save_temp_audio(audio_bytes, suffix=f".{fmt}")

    try:
        # Run transcription in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, engine.transcribe_file, tmp_path, "en"
        )

        return {
            "text": result.text,
            "confidence": result.confidence,
            "language": result.language,
            "duration": result.duration,
            "segments": result.segments,
            "model_used": result.model_used,
            "processing_time": result.processing_time,
        }
    finally:
        # Clean up temp file
        try:
            tmp_path.unlink()
        except OSError:
            pass


# =============================================================================
# Integration Endpoints (FEAT-006 / 007 / 008)
# =============================================================================


@app.post("/chat")
async def chat(request: ChatRequest) -> Dict[str, Any]:
    """
    Send a message to Claude API and return the response.

    This is a convenience endpoint that always uses the claude-api backend.

    Args:
        request: ChatRequest with text, optional system_prompt and model.
    """
    router = get_router()
    metadata: Dict[str, Any] = {}
    if request.system_prompt:
        metadata["system_prompt"] = request.system_prompt
    if request.model:
        metadata["model"] = request.model

    result = await router.send(
        text=request.text, backend="claude-api", metadata=metadata
    )

    if not result.get("success"):
        return JSONResponse(
            status_code=502,
            content={
                "error": result.get("message", "Claude API error"),
                "response": result.get("response", ""),
                "model": result.get("model", ""),
                "usage": result.get("usage", {}),
            },
        )

    return {
        "response": result.get("response", ""),
        "model": result.get("model", ""),
        "usage": result.get("usage", {}),
    }


@app.get("/integrations")
async def list_integrations() -> Dict[str, Any]:
    """
    List all available integration backends and the currently active one.
    """
    router = get_router()
    return {
        "backends": router.list_backends(),
        "active": router.active_backend,
    }


@app.post("/integrations/send")
async def integrations_send(request: IntegrationSendRequest) -> Dict[str, Any]:
    """
    Send text to the specified (or active) integration backend.

    Args:
        request: IntegrationSendRequest with text, optional backend, and options.
    """
    router = get_router()
    metadata = request.options or {}

    result = await router.send(
        text=request.text,
        backend=request.backend,
        metadata=metadata,
    )

    if not result.get("success"):
        return JSONResponse(
            status_code=502,
            content={
                "error": result.get("message", "Integration error"),
                "response": result.get("response", ""),
                "backend": result.get("backend", ""),
            },
        )

    return {
        "response": result.get("response", ""),
        "backend": result.get("backend", ""),
    }


# =============================================================================
# WebSocket Endpoint
# =============================================================================


@app.websocket("/ws/audio")
async def websocket_audio(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio streaming.

    Protocol:
        Client sends:
            - Text frames (JSON): {"type": "start"}, {"type": "stop"}, {"type": "cancel"}
            - Binary frames: audio data chunks (WebM/Opus from MediaRecorder)

        Server sends:
            - {"type": "status", "state": "recording|processing|ready|error"}
            - {"type": "result", "text": "...", "confidence": ..., "language": "en", ...}
            - {"type": "error", "message": "..."}
    """
    await websocket.accept()
    engine = get_engine()

    audio_chunks: List[bytes] = []
    recording = False

    async def send_status(state: str):
        await websocket.send_json({"type": "status", "state": state})

    async def send_error(message: str):
        await websocket.send_json({"type": "error", "message": message})

    async def send_result(result):
        await websocket.send_json({
            "type": "result",
            "text": result.text,
            "confidence": result.confidence,
            "language": result.language,
            "duration": result.duration,
            "segments": result.segments,
            "model_used": result.model_used,
            "processing_time": result.processing_time,
        })

    try:
        await send_status("ready")

        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            # Handle text control frames
            if "text" in message:
                import json

                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    await send_error("Invalid JSON")
                    continue

                msg_type = data.get("type", "")

                if msg_type == "start":
                    audio_chunks = []
                    recording = True
                    await send_status("recording")

                elif msg_type == "stop":
                    recording = False
                    await send_status("processing")

                    if not audio_chunks:
                        await send_error("No audio data received")
                        await send_status("ready")
                        continue

                    # Concatenate and transcribe
                    try:
                        combined = b"".join(audio_chunks)
                        tmp_path = save_temp_audio(combined, suffix=".webm")

                        try:
                            loop = asyncio.get_event_loop()
                            result = await loop.run_in_executor(
                                None,
                                engine.transcribe_file,
                                tmp_path,
                                "en",
                            )
                            await send_result(result)
                        finally:
                            try:
                                tmp_path.unlink()
                            except OSError:
                                pass
                    except Exception as e:
                        logger.error("WebSocket transcription error: %s", e)
                        await send_error(f"Transcription failed: {e}")

                    audio_chunks = []
                    await send_status("ready")

                elif msg_type == "cancel":
                    audio_chunks = []
                    recording = False
                    await send_status("ready")

            # Handle binary audio frames
            elif "bytes" in message:
                if recording and message["bytes"]:
                    audio_chunks.append(message["bytes"])

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        try:
            await send_error(str(e))
        except Exception:
            pass


# =============================================================================
# Main Entry Point
# =============================================================================


def run_server():
    """Run the backend server with uvicorn."""
    import uvicorn

    settings = load_settings()
    host = settings.get("host", SERVER_HOST)
    port = settings.get("port", SERVER_PORT)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    run_server()
