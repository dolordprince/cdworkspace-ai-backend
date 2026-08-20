from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.providers.registry import (
    SUPPORTED_PROVIDERS,
    build_providers,
    provider_status,
)
from app.providers.openai_compatible import ProviderError


router = APIRouter(
    prefix="/api/provider",
    tags=["provider"],
)


class ProviderRunRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    provider: str | None = None
    history: list[dict[str, str]] = Field(default_factory=list)


@router.get("/status")
async def provider_status_endpoint():
    settings = get_settings()

    return {
        "primary_provider": "openrouter",
        "fallback_provider": "groq",
        "providers": provider_status(settings),
    }


@router.post("/run")
async def provider_run(request: ProviderRunRequest):
    settings = get_settings()
    providers = build_providers(settings)

    requested = (
        request.provider or "openrouter"
    ).strip().lower()

    if requested not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported provider. "
                "Use 'openrouter', 'groq', or 'cerebras'."
            ),
        )

    provider = providers.get(requested)

    if provider is None:
        raise HTTPException(
            status_code=503,
            detail=f"{requested} provider is not configured.",
        )

    try:
        content = await provider.complete(
            request.prompt,
            request.history,
        )

        return {
            "status": "success",
            "provider": provider.name,
            "model": provider.model,
            "content": content,
        }

    except ProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"{requested} provider execution failed: {exc}",
        ) from exc
