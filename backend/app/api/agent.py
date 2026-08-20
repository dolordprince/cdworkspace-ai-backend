from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings
from app.providers.registry import build_providers


router = APIRouter(
    prefix="/api",
    tags=["agent"],
)


SYSTEM_PROMPT = """You are TRAVELER DEV, an expert AI engineer.

When asked to build a website:
generate complete, production-ready HTML/CSS/JS.

When asked to build an Android app:
generate complete Kotlin/Java code with proper structure.

Always output clean, working code.
No placeholders.
No TODOs.

For websites, output ONLY the complete HTML document
starting with <!DOCTYPE html>.

For apps, output complete source files with proper package structure.
"""


class AgentRequest(BaseModel):
    prompt: str
    intent: str = "agent"
    project: str = "traveler_dev"
    mode: str = "website"
    stream: bool = False


@router.post("/agent/run")
async def agent_run(
    req: AgentRequest,
) -> dict[str, Any]:

    settings = get_settings()
    providers = build_providers(settings)

    enriched = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Task: {req.prompt}\n"
        f"Mode: {req.mode}\n"
        f"Build complete {req.mode}."
    )

    provider_order = [
        "openrouter",
        "groq",
        "cerebras",
    ]

    errors: list[str] = []

    for provider_name in provider_order:
        provider = providers.get(provider_name)

        if provider is None:
            continue

        try:
            content = await provider.complete(enriched)

            is_html = (
                "<!DOCTYPE html" in content
                or "<html" in content.lower()
            )

            file_type = "html" if is_html else "code"

            filename = (
                "index.html"
                if is_html
                else "app/page.tsx"
            )

            return {
                "status": "success",
                "provider": provider.name,
                "model": provider.model,
                "content": content,
                "file_type": file_type,
                "filename": filename,
                "preview_url": None,
                "files": {
                    filename: content,
                },
                "tokens": len(content.split()),
            }

        except Exception as exc:
            errors.append(
                f"{provider_name}: {exc}"
            )

    return {
        "status": "error",
        "error": "All configured AI providers failed.",
        "provider_errors": errors,
        "content": "",
        "filename": "index.html",
        "file_type": "html",
        "files": {},
        "tokens": 0,
    }
