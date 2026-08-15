from __future__ import annotations

from typing import Any

from app.config import Settings, get_settings
from app.providers.openai_compatible import OpenAICompatibleProvider


def build_providers(
    settings: Settings | None = None,
) -> dict[str, OpenAICompatibleProvider]:
    settings = settings or get_settings()

    if not settings.groq_api_key.strip():
        return {}

    return {
        "groq": OpenAICompatibleProvider(
            name="groq",
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            model=settings.groq_model,
            timeout=settings.request_timeout,
        )
    }


def get_provider(
    name: str = "groq",
    settings: Settings | None = None,
) -> OpenAICompatibleProvider:
    providers = build_providers(settings)
    provider = providers.get(name.strip().lower())

    if provider is None:
        raise ValueError("Groq provider is not configured.")

    return provider


def provider_status(
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    configured = bool(settings.groq_api_key.strip())

    return {
        "configured": ["groq"] if configured else [],
        "groq": configured,
    }
