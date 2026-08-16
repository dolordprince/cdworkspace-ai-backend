from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.agent import run_agent
from app.config import get_settings
from app.providers.openai_compatible import ProviderError


router = APIRouter(prefix="/mcp", tags=["mcp"])


class AgentRunRequest(BaseModel):
    prompt: str = Field(min_length=1)
    provider: str | None = None
    model: str | None = None
    history: list[dict[str, str]] = Field(default_factory=list)


class ToolCallRequest(BaseModel):
    name: str = Field(min_length=1)
    arguments: dict[str, Any] = Field(default_factory=dict)


def workspace_agent_tool() -> dict[str, Any]:
    settings = get_settings()

    return {
        "name": "workspace_agent_run",
        "description": (
            "Run the production Traveler Dev workspace agent "
            "using Groq as primary inference and Cerebras as fallback."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "minLength": 1,
                },
                "provider": {
                    "type": "string",
                    "enum": ["groq", "cerebras"],
                },
                "model": {
                    "type": "string",
                    "description": (
                        "Optional model override. The configured provider "
                        "model is used when omitted."
                    ),
                },
                "history": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "role": {
                                "type": "string",
                                "enum": ["system", "user", "assistant"],
                            },
                            "content": {
                                "type": "string",
                            },
                        },
                        "required": ["role", "content"],
                    },
                },
            },
            "required": ["prompt"],
        },
        "metadata": {
            "primary_provider": "groq",
            "primary_model": settings.groq_model,
            "fallback_provider": "cerebras",
            "fallback_model": settings.cerebras_model,
        },
    }


async def execute_workspace_agent(
    request: AgentRunRequest,
) -> dict[str, Any]:
    return await run_agent(
        prompt=request.prompt,
        provider=request.provider,
        history=request.history,
    )


def initialize_response() -> dict[str, Any]:
    return {
        "protocolVersion": "2025-06-18",
        "serverInfo": {
            "name": "Traveler Dev",
            "version": "1.0.0",
        },
        "capabilities": {
            "tools": {},
            "resources": {},
            "prompts": {},
        },
    }


@router.get("/initialize")
async def initialize_get() -> dict[str, Any]:
    return initialize_response()


@router.post("/initialize")
async def initialize_post() -> dict[str, Any]:
    return initialize_response()


@router.get("/tools")
async def tools() -> dict[str, Any]:
    return {
        "tools": [
            workspace_agent_tool(),
        ],
    }


@router.post("/tools/call")
async def call_tool(
    request: ToolCallRequest,
) -> dict[str, Any]:
    if request.name != "workspace_agent_run":
        raise HTTPException(
            status_code=404,
            detail=f"Unknown MCP tool: {request.name}",
        )

    try:
        agent_request = AgentRunRequest.model_validate(
            request.arguments
        )

        result = await execute_workspace_agent(agent_request)

        return {
            "content": [
                {
                    "type": "text",
                    "text": result["content"],
                }
            ],
            "isError": False,
            "provider": result["provider"],
            "model": result["model"],
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except ProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"workspace_agent_run failed: {exc}",
        ) from exc


@router.post("/tools/workspace_agent_run")
async def workspace_agent_run(
    request: AgentRunRequest,
) -> dict[str, Any]:
    try:
        result = await execute_workspace_agent(request)

        return {
            "content": [
                {
                    "type": "text",
                    "text": result["content"],
                }
            ],
            "isError": False,
            "provider": result["provider"],
            "model": result["model"],
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except ProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"workspace_agent_run failed: {exc}",
        ) from exc
