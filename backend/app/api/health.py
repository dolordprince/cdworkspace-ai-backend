from fastapi import APIRouter

from app.config import get_settings
from app.providers.registry import provider_status


router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()

    providers = provider_status(settings)

    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "primary_provider": "groq",
        "fallback_provider": "cerebras",
        "providers": providers,
    }
