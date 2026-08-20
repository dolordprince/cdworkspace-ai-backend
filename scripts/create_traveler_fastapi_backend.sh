#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"

echo "============================================================"
echo "TRAVELER DEV — FASTAPI COMPANION BACKEND"
echo "============================================================"

mkdir -p \
  "$BACKEND/app/routes" \
  "$BACKEND/app/services" \
  "$BACKEND/app/schemas" \
  "$BACKEND/app/knowledge/android"

touch \
  "$BACKEND/app/__init__.py" \
  "$BACKEND/app/routes/__init__.py" \
  "$BACKEND/app/services/__init__.py" \
  "$BACKEND/app/schemas/__init__.py"

cat > "$BACKEND/app/config.py" <<'PY'
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Traveler Dev Backend"
    environment: str = "production"

    host: str = "0.0.0.0"
    port: int = 7860

    cors_origins: str = "*"

    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "anthropic/claude-sonnet-4"

    github_token: str | None = None

    android_docs_base_url: str = "https://developer.android.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
PY

cat > "$BACKEND/app/services/github.py" <<'PY'
import httpx

from app.config import get_settings


class GitHubService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def search(self, query: str, page: int = 1, per_page: int = 10) -> dict:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "Traveler-Dev",
        }

        if self.settings.github_token:
            headers["Authorization"] = (
                f"Bearer {self.settings.github_token}"
            )

        params = {
            "q": query,
            "page": page,
            "per_page": min(max(per_page, 1), 100),
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://api.github.com/search/repositories",
                params=params,
                headers=headers,
            )

        response.raise_for_status()
        return response.json()
PY

cat > "$BACKEND/app/services/android_docs.py" <<'PY'
import re
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup

from app.config import get_settings


class AndroidDocsService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def fetch(self, path: str) -> dict:
        if not path.startswith("/"):
            path = "/" + path

        url = self.settings.android_docs_base_url.rstrip("/") + path

        async with httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
        ) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Traveler-Dev-Android-Docs/1.0",
                },
            )

        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        for element in soup(
            ["script", "style", "noscript", "nav", "footer"]
        ):
            element.decompose()

        main = (
            soup.find("main")
            or soup.find("article")
            or soup.body
        )

        if main is None:
            raise RuntimeError("Android documentation body was not found")

        title = soup.title.get_text(" ", strip=True) if soup.title else path

        text = main.get_text("\n", strip=True)
        text = re.sub(r"\n{3,}", "\n\n", text)

        markdown = f"# {title}\n\n{text}\n"

        return {
            "url": str(response.url),
            "title": title,
            "markdown": markdown,
        }

    async def search(self, query: str) -> dict:
        encoded = quote(query)
        url = (
            f"{self.settings.android_docs_base_url}"
            f"/s/results?q={encoded}"
        )

        async with httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
        ) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Traveler-Dev-Android-Docs/1.0",
                },
            )

        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        results = []

        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "")
            title = anchor.get_text(" ", strip=True)

            if (
                title
                and href.startswith("/")
                and "developer.android.com" not in href
            ):
                continue

            if title and href.startswith("/"):
                results.append(
                    {
                        "title": title,
                        "url": self.settings.android_docs_base_url + href,
                    }
                )

        return {
            "query": query,
            "results": results[:20],
        }
PY

cat > "$BACKEND/app/services/openrouter.py" <<'PY'
from collections.abc import AsyncIterator

import httpx

from app.config import get_settings


class OpenRouterService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _headers(self) -> dict[str, str]:
        if not self.settings.openrouter_api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")

        return {
            "Authorization": (
                f"Bearer {self.settings.openrouter_api_key}"
            ),
            "Content-Type": "application/json",
            "HTTP-Referer": "https://traveler.dev",
            "X-Title": "Traveler Dev",
        }

    async def chat(self, messages: list[dict], model: str | None = None) -> dict:
        payload = {
            "model": model or self.settings.openrouter_model,
            "messages": messages,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self.settings.openrouter_base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )

        response.raise_for_status()
        return response.json()
PY

cat > "$BACKEND/app/routes/health.py" <<'PY'
from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()

    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
    }
PY

cat > "$BACKEND/app/routes/github.py" <<'PY'
from fastapi import APIRouter, Query

from app.services.github import GitHubService

router = APIRouter(prefix="/api/github", tags=["github"])

service = GitHubService()


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
) -> dict:
    return await service.search(q, page, per_page)
PY

cat > "$BACKEND/app/routes/android.py" <<'PY'
from fastapi import APIRouter, Query

from app.services.android_docs import AndroidDocsService

router = APIRouter(prefix="/api/android/docs", tags=["android"])

service = AndroidDocsService()


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
) -> dict:
    return await service.search(q)


@router.get("/fetch")
async def fetch(
    path: str = Query(..., min_length=1),
) -> dict:
    return await service.fetch(path)
PY

cat > "$BACKEND/app/routes/ai.py" <<'PY'
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.openrouter import OpenRouterService

router = APIRouter(prefix="/api/ai", tags=["ai"])

service = OpenRouterService()


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)
    model: str | None = None


@router.post("/chat")
async def chat(request: ChatRequest) -> dict:
    try:
        return await service.chat(
            [message.model_dump() for message in request.messages],
            request.model,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
PY

cat > "$BACKEND/app/main.py" <<'PY'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import ai, android, github, health

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(ai.router)
app.include_router(github.router)
app.include_router(android.router)
PY

cat > "$BACKEND/requirements.txt" <<'REQ'
fastapi>=0.116,<1
uvicorn[standard]>=0.35,<1
httpx>=0.28,<1
beautifulsoup4>=4.13,<5
pydantic-settings>=2.10,<3
REQ

cat > "$BACKEND/.env.example" <<'ENV'
ENVIRONMENT=production
HOST=0.0.0.0
PORT=7860

CORS_ORIGINS=*

OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=anthropic/claude-sonnet-4

GITHUB_TOKEN=
ANDROID_DOCS_BASE_URL=https://developer.android.com
ENV

cat > "$BACKEND/Dockerfile" <<'DOCKER'
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
DOCKER

cat > "$BACKEND/.dockerignore" <<'EOF2'
.venv
__pycache__
*.pyc
.env
.git
EOF2

echo
echo "============================================================"
echo "FASTAPI BACKEND CREATED"
echo "============================================================"
find "$BACKEND/app" -type f | sort
echo
echo "Backend: $BACKEND"
