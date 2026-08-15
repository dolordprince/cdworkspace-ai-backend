from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.agent import run_agent
from app.providers.openai_compatible import ProviderError


router = APIRouter()


class AgentRequest(BaseModel):
    prompt: str = Field(min_length=1)
    provider: str | None = None
    history: list[dict[str, str]] = Field(default_factory=list)


@router.post("/api/agent/run")
async def agent_run(request: AgentRequest):
    try:
        return await run_agent(
            prompt=request.prompt,
            provider=request.provider,
            history=request.history,
        )

    except ProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
