from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.config import Settings, get_settings
from app.providers.openai_compatible import ProviderError
from app.providers.registry import get_provider


@dataclass
class AgentResult:
    provider: str
    content: str


class WorkspaceAgent:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

        if not self.settings.groq_api_key.strip():
            raise RuntimeError(
                "Groq is not configured. Set GROQ_API_KEY."
            )

        self.provider = get_provider(
            "groq",
            self.settings,
        )

    async def run(
        self,
        prompt: str,
        provider: str | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> AgentResult:

        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("prompt must be a non-empty string")

        if provider and provider.strip().lower() != "groq":
            raise ValueError(
                "Only the groq provider is configured."
            )

        try:
            content = await self.provider.complete(
                prompt=prompt,
                history=history,
            )
        except ProviderError:
            raise

        return AgentResult(
            provider="groq",
            content=content,
        )


async def run_agent(
    prompt: str,
    provider: str | None = None,
    history: list[dict[str, str]] | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:

    agent = WorkspaceAgent(settings=settings)

    result = await agent.run(
        prompt=prompt,
        provider=provider,
        history=history,
    )

    return {
        "provider": result.provider,
        "content": result.content,
    }
