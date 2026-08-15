from fastapi import APIRouter

from app.config import get_settings
from app.providers.registry import build_providers


router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    providers = build_providers(settings)

    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "providers": sorted(providers.keys()),
        "model": settings.groq_model,
    }
