from __future__ import annotations

from typing import Any

from app.config import Settings
from app.providers.openai_compatible import OpenAICompatibleProvider


SUPPORTED_PROVIDERS = frozenset(
    {
        "openrouter",
        "groq",
        "cerebras",
    }
)


def build_providers(
    settings: Settings,
) -> dict[str, OpenAICompatibleProvider]:
    providers: dict[str, OpenAICompatibleProvider] = {}

    if settings.openrouter_api_key.strip():
        providers["openrouter"] = OpenAICompatibleProvider(
            name="openrouter",
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            model=settings.openrouter_model,
            timeout=settings.request_timeout,
        )

    if settings.groq_api_key.strip():
        providers["groq"] = OpenAICompatibleProvider(
            name="groq",
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            model=settings.groq_model,
            timeout=settings.request_timeout,
        )

    if settings.cerebras_api_key.strip():
        providers["cerebras"] = OpenAICompatibleProvider(
            name="cerebras",
            api_key=settings.cerebras_api_key,
            base_url=settings.cerebras_base_url,
            model=settings.cerebras_model,
            timeout=settings.request_timeout,
        )

    return providers


def get_provider(
    name: str,
    settings: Settings,
) -> OpenAICompatibleProvider:
    provider_name = name.strip().lower()

    if provider_name not in SUPPORTED_PROVIDERS:
        raise ValueError(
            "Unsupported provider. "
            "Use 'openrouter', 'groq', or 'cerebras'."
        )

    provider = build_providers(settings).get(provider_name)

    if provider is None:
        raise RuntimeError(
            f"{provider_name} is not configured. "
            f"Set {provider_name.upper()}_API_KEY."
        )

    return provider


def provider_status(
    settings: Settings,
) -> list[dict[str, Any]]:
    return [
        {
            "provider": "openrouter",
            "model": settings.openrouter_model,
            "configured": bool(settings.openrouter_api_key.strip()),
            "base_url": settings.openrouter_base_url,
        },
        {
            "provider": "groq",
            "model": settings.groq_model,
            "configured": bool(settings.groq_api_key.strip()),
            "base_url": settings.groq_base_url,
        },
        {
            "provider": "cerebras",
            "model": settings.cerebras_model,
            "configured": bool(settings.cerebras_api_key.strip()),
            "base_url": settings.cerebras_base_url,
        },
    ]
