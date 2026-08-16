#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.production-backup/$STAMP"

echo "===== TRAVELER DEV PRODUCTION MIGRATION ====="
echo "ROOT: $ROOT"
echo "BACKUP: $BACKUP"

mkdir -p "$BACKUP"

git status --short > "$BACKUP/git-status.txt" || true
git rev-parse HEAD > "$BACKUP/git-head.txt"

cp -a backend "$BACKUP/backend"
cp -a render.yaml "$BACKUP/render.yaml" 2>/dev/null || true

mkdir -p \
  backend/app/providers \
  backend/app/api \
  backend/app/services \
  backend/app/mcp \
  scripts

cat > backend/app/config.py <<'PY'
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Traveler Dev"
    environment: str = "production"

    openrouter_api_key: str
    openrouter_model: str = "anthropic/claude-sonnet-4.5"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_http_referer: str = ""
    openrouter_x_title: str = "Traveler Dev"

    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_api_base_url: str = "https://api.cloudflare.com/client/v4"
    cloudflare_default_project: str = "traveler-dev"

    request_timeout: float = 180.0
    max_request_body_bytes: int = 15_000_000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
PY

cat > backend/app/providers/openrouter.py <<'PY'
from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings


class OpenRouterError(RuntimeError):
    pass


class OpenRouterProvider:
    name = "openrouter"

    def __init__(self) -> None:
        self.settings = get_settings()

    async def chat(
        self,
        *,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }

        if self.settings.openrouter_http_referer:
            headers["HTTP-Referer"] = self.settings.openrouter_http_referer

        if self.settings.openrouter_x_title:
            headers["X-Title"] = self.settings.openrouter_x_title

        payload: dict[str, Any] = {
            "model": model or self.settings.openrouter_model,
            "messages": messages,
            "temperature": temperature,
        }

        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        try:
            async with httpx.AsyncClient(
                base_url=self.settings.openrouter_base_url,
                timeout=httpx.Timeout(
                    self.settings.request_timeout,
                    connect=30.0,
                ),
            ) as client:
                response = await client.post(
                    "/chat/completions",
                    headers=headers,
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise OpenRouterError(
                f"OpenRouter network failure: {exc}"
            ) from exc

        if response.status_code >= 400:
            try:
                detail = response.json()
            except ValueError:
                detail = response.text

            raise OpenRouterError(
                f"OpenRouter HTTP {response.status_code}: {detail}"
            )

        try:
            data = response.json()
            message = data["choices"][0]["message"]
            content = message.get("content")

            if not isinstance(content, str) or not content.strip():
                raise OpenRouterError(
                    "OpenRouter returned an empty assistant message"
                )

            return content
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise OpenRouterError(
                f"Invalid OpenRouter response: {response.text[:2000]}"
            ) from exc
PY

cat > backend/app/providers/registry.py <<'PY'
from __future__ import annotations

from app.providers.openrouter import OpenRouterProvider


def build_providers(settings) -> dict[str, object]:
    providers: dict[str, object] = {}

    if settings.openrouter_api_key:
        providers["openrouter"] = OpenRouterProvider()

    return providers
PY

cat > backend/app/api/health.py <<'PY'
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
        "service": "Traveler Dev",
        "environment": settings.environment,
        "providers": sorted(providers.keys()),
        "model": settings.openrouter_model,
        "cloudflare_configured": bool(
            settings.cloudflare_account_id
            and settings.cloudflare_api_token
        ),
    }
PY

cat > backend/app/api/provider.py <<'PY'
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.providers.openrouter import OpenRouterError, OpenRouterProvider


router = APIRouter(prefix="/api/provider", tags=["provider"])


class ProviderTestRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=10000)


@router.get("/status")
async def provider_status() -> dict:
    settings = get_settings()

    return {
        "provider": "openrouter",
        "model": settings.openrouter_model,
        "configured": bool(settings.openrouter_api_key),
        "base_url": settings.openrouter_base_url,
    }


@router.post("/test")
async def provider_test(request: ProviderTestRequest) -> dict:
    settings = get_settings()

    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured",
        )

    provider = OpenRouterProvider()

    try:
        result = await provider.chat(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Traveler Dev production agent. "
                        "Return only the answer required by the user."
                    ),
                },
                {
                    "role": "user",
                    "content": request.prompt,
                },
            ],
        )
    except OpenRouterError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    return {
        "provider": "openrouter",
        "model": settings.openrouter_model,
        "content": result,
    }
PY

cat > backend/app/services/cloudflare.py <<'PY'
from __future__ import annotations

import httpx

from app.config import get_settings


class CloudflareDeploymentError(RuntimeError):
    pass


class CloudflarePagesService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.settings.cloudflare_api_token}",
            "Content-Type": "application/json",
        }

    def _require_credentials(self) -> None:
        if not self.settings.cloudflare_account_id:
            raise CloudflareDeploymentError(
                "CLOUDFLARE_ACCOUNT_ID is not configured"
            )

        if not self.settings.cloudflare_api_token:
            raise CloudflareDeploymentError(
                "CLOUDFLARE_API_TOKEN is not configured"
            )

    async def verify(self) -> dict:
        self._require_credentials()

        url = (
            f"{self.settings.cloudflare_api_base_url}"
            f"/accounts/{self.settings.cloudflare_account_id}"
        )

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                url,
                headers=self._headers(),
            )

        if response.status_code >= 400:
            raise CloudflareDeploymentError(
                f"Cloudflare credential verification failed "
                f"with HTTP {response.status_code}: {response.text[:2000]}"
            )

        data = response.json()

        if data.get("success") is not True:
            raise CloudflareDeploymentError(
                f"Cloudflare rejected credentials: {data}"
            )

        return data
PY

cat > backend/app/api/cloudflare.py <<'PY'
from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.services.cloudflare import (
    CloudflareDeploymentError,
    CloudflarePagesService,
)


router = APIRouter(
    prefix="/api/cloudflare",
    tags=["cloudflare"],
)


@router.get("/status")
async def cloudflare_status() -> dict:
    settings = get_settings()

    return {
        "configured": bool(
            settings.cloudflare_account_id
            and settings.cloudflare_api_token
        ),
        "account_id_configured": bool(
            settings.cloudflare_account_id
        ),
        "token_configured": bool(
            settings.cloudflare_api_token
        ),
        "project": settings.cloudflare_default_project,
    }


@router.post("/verify")
async def verify_cloudflare() -> dict:
    try:
        data = await CloudflarePagesService().verify()
    except CloudflareDeploymentError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    return {
        "status": "verified",
        "account": data.get("result"),
    }
PY

cat > backend/app/mcp/server.py <<'PY'
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.providers.openrouter import OpenRouterError, OpenRouterProvider


router = APIRouter(prefix="/mcp", tags=["mcp"])


class AgentRunRequest(BaseModel):
    prompt: str = Field(min_length=1)
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
            "Run the Traveler Dev workspace agent through "
            "Anthropic Claude via OpenRouter."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string"},
                "model": {
                    "type": "string",
                    "default": settings.openrouter_model,
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
                    },
                },
            },
            "required": ["prompt"],
        },
    }


@router.get("/initialize")
async def initialize() -> dict[str, Any]:
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


@router.get("/tools")
async def tools() -> dict[str, Any]:
    return {
        "tools": [
            workspace_agent_tool(),
        ]
    }


async def execute_workspace_agent(
    request: AgentRunRequest,
) -> str:
    settings = get_settings()

    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": (
                "You are the production Traveler Dev coding agent. "
                "Work precisely with the user's workspace request. "
                "Do not claim that code, builds, tests, or deployments "
                "occurred unless the backend actually performed them."
            ),
        }
    ]

    for item in request.history:
        role = item.get("role")
        content = item.get("content")

        if role in {"user", "assistant", "system"} and content:
            messages.append(
                {
                    "role": role,
                    "content": content,
                }
            )

    messages.append(
        {
            "role": "user",
            "content": request.prompt,
        }
    )

    provider = OpenRouterProvider()

    try:
        return await provider.chat(
            messages=messages,
            model=request.model or settings.openrouter_model,
        )
    except OpenRouterError as exc:
        raise RuntimeError(str(exc)) from exc


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
PY

cat > render.yaml <<'YAML'
services:
  - type: web
    name: traveler-dev-backend
    runtime: python
    rootDir: backend
    buildCommand: "pip install --upgrade pip && pip install --only-binary=:all: -r requirements.txt"
    startCommand: "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
    healthCheckPath: /health
    envVars:
      - key: OPENROUTER_API_KEY
        sync: false
      - key: OPENROUTER_MODEL
        value: anthropic/claude-sonnet-4.5
      - key: OPENROUTER_BASE_URL
        value: https://openrouter.ai/api/v1
      - key: OPENROUTER_X_TITLE
        value: Traveler Dev
      - key: ENVIRONMENT
        value: production
      - key: CLOUDFLARE_ACCOUNT_ID
        sync: false
      - key: CLOUDFLARE_API_TOKEN
        sync: false
      - key: CLOUDFLARE_DEFAULT_PROJECT
        value: traveler-dev
YAML

cat > scripts/02_test_traveler_dev_backend.sh <<'SCRIPT2'
#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://cdworkspace-ai-backend.onrender.com}"

echo "===== TRAVELER DEV REMOTE CONTRACT TEST ====="
echo "BASE: $BASE_URL"

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/health" | python3 -m json.tool

echo
echo "===== PROVIDER STATUS ====="

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/api/provider/status" | python3 -m json.tool

echo
echo "===== CLOUDFLARE STATUS ====="

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/api/cloudflare/status" | python3 -m json.tool

echo
echo "===== MCP INITIALIZE ====="

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/mcp/initialize" | python3 -m json.tool

echo
echo "===== MCP TOOLS ====="

curl -fsS --connect-timeout 15 --max-time 45 \
  "$BASE_URL/mcp/tools" | python3 -m json.tool

echo
echo "[PASS] Traveler Dev remote contract endpoints responded."
SCRIPT2

chmod +x \
  scripts/01_traveler_dev_production_migration.sh \
  scripts/02_test_traveler_dev_backend.sh

python3 -m compileall -q backend

git diff --check

echo
echo "===== MIGRATION COMPLETE ====="
echo "Backup: $BACKUP"
echo "Python compilation: PASS"
echo "Git whitespace audit: PASS"
echo
echo "Changed production contracts:"
echo "  OpenRouter -> Claude"
echo "  MCP -> OpenRouter Claude"
echo "  Cloudflare configuration"
echo "  Render environment contract"
echo "  Traveler Dev branding"
echo
echo "NEXT:"
echo "  git diff -- backend render.yaml"
echo "  git status --short"
