from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.agent import WorkspaceAgent


router = APIRouter(prefix="/mcp", tags=["mcp"])


class AgentRunRequest(BaseModel):
    prompt: str = Field(min_length=1)
    provider: str | None = None
    history: list[dict[str, str]] = Field(default_factory=list)


class ToolCallRequest(BaseModel):
    name: str = Field(min_length=1)
    arguments: dict[str, Any] = Field(default_factory=dict)


def workspace_agent_tool() -> dict[str, Any]:
    return {
        "name": "workspace_agent_run",
        "description": "Run the production Workspace AI agent through Groq.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string"},
                "provider": {
                    "type": "string",
                    "enum": ["groq"],
                },
                "history": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "role": {"type": "string"},
                            "content": {"type": "string"},
                        },
                        "required": ["role", "content"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["prompt"],
            "additionalProperties": False,
        },
    }


@router.get("/initialize")
async def initialize() -> dict[str, Any]:
    return {
        "protocolVersion": "2025-06-18",
        "serverInfo": {
            "name": "Workspace AI",
            "version": "0.1.0",
        },
        "capabilities": {
            "tools": {},
            "resources": {},
            "prompts": {},
        },
    }


@router.get("/tools")
async def tools() -> dict[str, Any]:
    return {
        "tools": [workspace_agent_tool()]
    }


async def execute_workspace_agent(
    request: AgentRunRequest,
) -> str:
    agent = WorkspaceAgent()

    response = await agent.run(
        prompt=request.prompt,
        provider=request.provider,
        history=request.history,
    )

    return response.content


@router.post("/tools/call")
async def call_tool(
    request: ToolCallRequest,
) -> dict[str, Any]:

    if request.name != "workspace_agent_run":
        raise HTTPException(
            status_code=404,
            detail=f"Unknown MCP tool: {request.name}",
        )

    agent_request = AgentRunRequest.model_validate(
        request.arguments
    )

    try:
        result = await execute_workspace_agent(agent_request)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"workspace_agent_run failed: {exc}",
        ) from exc

    return {
        "content": [
            {
                "type": "text",
                "text": result,
            }
        ],
        "isError": False,
    }


@router.post("/tools/workspace_agent_run")
async def workspace_agent_run(
    request: AgentRunRequest,
) -> dict[str, Any]:

    try:
        result = await execute_workspace_agent(request)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"workspace_agent_run failed: {exc}",
        ) from exc

    return {
        "content": [
            {
                "type": "text",
                "text": result,
            }
        ],
        "isError": False,
    }
