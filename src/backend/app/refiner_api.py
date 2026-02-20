"""
REST API routes for the text refiner.

Provides endpoints to process text, get/update configuration, and test
the refiner with sample text.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .refiner import get_refiner
from .refiner.providers import PROVIDER_REGISTRY

router = APIRouter()


# =============================================================================
# Request / Response Models
# =============================================================================


class RefineRequest(BaseModel):
    """Request body for the POST /refiner/process endpoint."""

    text: str
    provider: Optional[str] = None
    custom_prompt: Optional[str] = None


class RefinerConfigUpdate(BaseModel):
    """Request body for the PUT /refiner/config endpoint."""

    enabled: Optional[bool] = None
    active_provider: Optional[str] = None
    timeout: Optional[float] = None
    custom_prompt: Optional[str] = None
    provider_configs: Optional[Dict[str, Dict[str, Any]]] = None
    provider_models: Optional[Dict[str, list]] = None


class RefineTestRequest(BaseModel):
    """Request body for the POST /refiner/test endpoint."""

    text: Optional[str] = None
    provider: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/providers")
async def list_providers() -> list[dict]:
    """Return list of all providers with display name, API key requirement, and configured status."""
    refiner = get_refiner()
    result = []
    for name, cls in PROVIDER_REGISTRY.items():
        try:
            provider = refiner._get_provider(name)
            configured = provider.is_configured()
        except Exception:
            configured = False
        result.append({
            "id": name,
            "name": cls.PROVIDER_DISPLAY_NAME,
            "requires_api_key": cls.REQUIRES_API_KEY,
            "configured": configured,
        })
    return result


@router.get("/providers/{provider_name}/models")
async def list_provider_models(provider_name: str) -> list[dict]:
    """Return available models for a provider. For Groq/Ollama, queries live API."""
    if provider_name not in PROVIDER_REGISTRY:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Unknown provider: {provider_name}",
                "available": list(PROVIDER_REGISTRY.keys()),
            },
        )
    refiner = get_refiner()
    try:
        provider = refiner._get_provider(provider_name)
        custom_models = refiner.get_custom_models(provider_name)
        return await provider.list_models(custom_models=custom_models)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to list models: {e}"},
        )


@router.get("/providers/{provider_name}/test-connection")
async def test_provider_connection(provider_name: str) -> dict:
    """Test connectivity to a provider (API key validity, host reachability)."""
    if provider_name not in PROVIDER_REGISTRY:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Unknown provider: {provider_name}",
                "available": list(PROVIDER_REGISTRY.keys()),
            },
        )
    refiner = get_refiner()
    try:
        provider = refiner._get_provider(provider_name)
        return await provider.test_connection()
    except Exception as e:
        return {"ok": False, "latency_ms": 0, "message": str(e)}


@router.post("/process")
async def process_text(request: RefineRequest) -> Dict[str, Any]:
    """
    Refine raw transcribed text through the active LLM provider.

    Args:
        request: RefineRequest with text and optional provider override.

    Returns:
        Dict with refined_text, provider, model, processing_time_ms,
        and tokens_used.
    """
    if request.provider and request.provider not in PROVIDER_REGISTRY:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Unknown provider: {request.provider}",
                "available": list(PROVIDER_REGISTRY.keys()),
            },
        )

    refiner = get_refiner()
    result = await refiner.process(
        request.text,
        provider_override=request.provider,
        prompt_override=request.custom_prompt or None,
    )

    response = {
        "refined_text": result.refined_text,
        "provider": result.provider,
        "model": result.model,
        "processing_time_ms": result.processing_time_ms,
        "tokens_used": result.tokens_used,
    }
    if result.warning:
        response["warning"] = result.warning
    return response


@router.get("/config")
async def get_config() -> Dict[str, Any]:
    """
    Return current refiner configuration.

    API keys are never exposed; only a 'configured' boolean per provider.
    """
    refiner = get_refiner()
    return refiner.get_config()


@router.put("/config")
async def update_config(request: RefinerConfigUpdate) -> Dict[str, Any]:
    """
    Update refiner configuration.

    Accepts partial updates. Provider API keys are passed through
    provider_configs.
    """
    refiner = get_refiner()

    try:
        refiner.configure(
            enabled=request.enabled,
            provider=request.active_provider,
            prompt=request.custom_prompt,
            timeout=request.timeout,
            provider_configs=request.provider_configs,
            provider_models=request.provider_models,
        )
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"error": str(e)},
        )

    return refiner.get_config()


@router.post("/test")
async def test_refiner(request: RefineTestRequest) -> Dict[str, Any]:
    """
    Test the refiner with sample or provided text.

    Uses sample text if none is provided. Temporarily enables the refiner
    for this request if it is disabled.
    """
    sample = request.text or (
        "um so basically i was uh thinking that we should like "
        "you know maybe try a different approach to the problem"
    )

    refiner = get_refiner()

    # Temporarily enable for test
    was_enabled = refiner._enabled
    refiner._enabled = True

    try:
        result = await refiner.process(sample, provider_override=request.provider)
        response = {
            "original": sample,
            "refined_text": result.refined_text,
            "provider": result.provider,
            "model": result.model,
            "processing_time_ms": result.processing_time_ms,
            "tokens_used": result.tokens_used,
        }
        if result.warning:
            response["warning"] = result.warning
        return response
    finally:
        refiner._enabled = was_enabled
