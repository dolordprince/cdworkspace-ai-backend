from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.config import Settings, get_settings
from app.providers.openai_compatible import ProviderError
from app.providers.registry import get_provider


@dataclass(frozen=True)
class AgentResult:
    provider: str
    model: str
    content: str


class WorkspaceAgent:
    PRIMARY_PROVIDER = "groq"
    FALLBACK_PROVIDER = "cerebras"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def _run_provider(
        self,
        provider_name: str,
        prompt: str,
        history: list[dict[str, str]] | None,
    ) -> AgentResult:
        provider = get_provider(provider_name, self.settings)

        content = await provider.complete(
            prompt=prompt,
            history=history,
        )

        return AgentResult(
            provider=provider.name,
            model=provider.model,
            content=content,
        )

    async def run(
        self,
        prompt: str,
        provider: str | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> AgentResult:
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("prompt must be a non-empty string")

        requested = provider.strip().lower() if provider else None

        if requested and requested not in {"groq", "cerebras"}:
            raise ValueError(
                "Unsupported provider. Use 'groq' or 'cerebras'."
            )

        if requested:
            return await self._run_provider(
                requested,
                prompt,
                history,
            )

        try:
            return await self._run_provider(
                self.PRIMARY_PROVIDER,
                prompt,
                history,
            )
        except ProviderError as primary_error:
            try:
                return await self._run_provider(
                    self.FALLBACK_PROVIDER,
                    prompt,
                    history,
                )
            except Exception as fallback_error:
                raise ProviderError(
                    "Groq failed and Cerebras fallback failed. "
                    f"Groq: {primary_error}; "
                    f"Cerebras: {fallback_error}",
                    provider="groq,cerebras",
                ) from fallback_error


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
        "model": result.model,
        "content": result.content,
    }
