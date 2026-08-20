from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import quote, urljoin

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field
from app.routes.developer_tools import router as developer_tools_router


import asyncio
APP_NAME = "Traveler Dev API"
APP_VERSION = "1.0.0"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv(
    "OPENROUTER_MODEL",
    "z-ai/glm-5.2:free",
)

ANDROID_BASE = "https://developer.android.com/"
ANDROID_SEARCH = "https://developer.android.com/s/results"

GITHUB_API = "https://api.github.com"

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173",
    ).split(",")
    if origin.strip()
]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=100000)
    model: str | None = None
    system: str | None = None
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, ge=1, le=32768)


class AgentRequest(BaseModel):
    message: str = Field(min_length=1, max_length=100000)
    model: str | None = None
    system: str | None = None
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, ge=1, le=32768)


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Traveler Dev production AI, GitHub and Android documentation API.",
)



TRUSTED_HOSTS = [
    host.strip()
    for host in __import__("os").getenv(
        "TRUSTED_HOSTS",
        "localhost,127.0.0.1,testserver,*.hf.space,*.onrender.com",
    ).split(",")
    if host.strip()
] + ["testserver"]


app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=TRUSTED_HOSTS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOWED_ORIGINS != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def openrouter_headers() -> dict[str, str]:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured.",
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    site_url = os.getenv("OPENROUTER_SITE_URL", "").strip()
    app_name = os.getenv(
        "OPENROUTER_APP_NAME",
        "Traveler Dev",
    ).strip()

    if site_url:
        headers["HTTP-Referer"] = site_url

    if app_name:
        headers["X-Title"] = app_name

    return headers


async def run_openrouter(request: ChatRequest) -> dict[str, Any]:
    """Execute OpenRouter using the configured primary/fallback model chain."""

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured.",
        )

    primary_model = (
        request.model
        or os.getenv("OPENROUTER_MODEL", "").strip()
        or OPENROUTER_MODEL
    ).strip()

    fallback_models = [
        os.getenv("OPENROUTER_FALLBACK_MODEL", "").strip(),
        *[
            item.strip()
            for item in os.getenv(
                "OPENROUTER_FALLBACK_MODELS",
                "",
            ).split(",")
            if item.strip()
        ],
    ]

    model_chain: list[str] = []

    for candidate in [primary_model, *fallback_models]:
        if candidate and candidate not in model_chain:
            model_chain.append(candidate)

    if not model_chain:
        raise HTTPException(
            status_code=503,
            detail="No OpenRouter models are configured.",
        )

    retry_max = max(
        0,
        int(os.getenv("OPENROUTER_RETRY_MAX", "2")),
    )

    retry_default = max(
        1,
        int(
            os.getenv(
                "OPENROUTER_RETRY_DEFAULT_SECONDS",
                "5",
            )
        ),
    )

    retryable_statuses = {
        408,
        409,
        429,
        500,
        502,
        503,
        504,
    }

    messages = [
        {
            "role": "user",
            "content": request.message,
        }
    ]

    timeout = httpx.Timeout(
        connect=20.0,
        read=90.0,
        write=30.0,
        pool=20.0,
    )

    attempts: list[dict[str, Any]] = []
    last_status: int | None = None
    last_body: Any = None

    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
    ) as client:

        for model_index, model in enumerate(model_chain):

            has_fallback = (
                model_index < len(model_chain) - 1
            )

            for attempt in range(retry_max + 1):

                payload = {
                    "model": model,
                    "messages": messages,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                }

                try:
                    response = await client.post(
                        OPENROUTER_URL,
                        headers=openrouter_headers(),
                        json=payload,
                    )

                except httpx.TimeoutException as exc:

                    attempts.append(
                        {
                            "model": model,
                            "attempt": attempt + 1,
                            "error": "timeout",
                        }
                    )

                    if attempt < retry_max:
                        await asyncio.sleep(retry_default)
                        continue

                    if has_fallback:
                        break

                    raise HTTPException(
                        status_code=504,
                        detail="OpenRouter request timed out.",
                    ) from exc

                except httpx.HTTPError as exc:

                    attempts.append(
                        {
                            "model": model,
                            "attempt": attempt + 1,
                            "error": str(exc),
                        }
                    )

                    if attempt < retry_max:
                        await asyncio.sleep(retry_default)
                        continue

                    if has_fallback:
                        break

                    raise HTTPException(
                        status_code=502,
                        detail=f"OpenRouter network failure: {exc}",
                    ) from exc

                last_status = response.status_code

                try:
                    data = response.json()
                except ValueError:
                    data = {
                        "raw": response.text,
                    }

                last_body = data

                retry_after = None
                retry_after_header = response.headers.get(
                    "retry-after"
                )

                if retry_after_header:
                    try:
                        retry_after = max(
                            1,
                            int(float(retry_after_header)),
                        )
                    except ValueError:
                        retry_after = None

                attempts.append(
                    {
                        "model": model,
                        "attempt": attempt + 1,
                        "status": response.status_code,
                        "retry_after": retry_after,
                    }
                )

                if response.status_code == 200:

                    if not isinstance(data, dict):
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                "OpenRouter returned "
                                "invalid JSON."
                            ),
                        )

                    choices = data.get("choices")

                    if (
                        not isinstance(choices, list)
                        or not choices
                    ):
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                "OpenRouter returned "
                                "no choices."
                            ),
                        )

                    choice = choices[0]

                    if not isinstance(choice, dict):
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                "OpenRouter returned "
                                "an invalid choice."
                            ),
                        )

                    message = choice.get("message")

                    if not isinstance(message, dict):
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                "OpenRouter returned "
                                "an invalid message."
                            ),
                        )

                    content = message.get("content")

                    if content is None:
                        content = (
                            message.get("refusal")
                            or ""
                        )

                    if not isinstance(content, str):
                        content = str(content)

                    content = content.strip()

                    if not content:
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                "OpenRouter returned "
                                "an empty response."
                            ),
                        )

                    return {
                        "provider": "openrouter",
                        "model": (
                            data.get("model")
                            or model
                        ),
                        "message": content,
                        "content": content,
                        "usage": data.get("usage"),
                        "finish_reason": (
                            choice.get("finish_reason")
                        ),
                        "id": data.get("id"),
                    }

                if response.status_code in {401, 403}:
                    raise HTTPException(
                        status_code=502,
                        detail={
                            "message": (
                                "OpenRouter "
                                "authentication/authorization "
                                "failed."
                            ),
                            "upstream_status": (
                                response.status_code
                            ),
                        },
                    )

                if response.status_code in retryable_statuses:

                    if attempt < retry_max:
                        delay = (
                            retry_after
                            or retry_default
                        )
                        await asyncio.sleep(delay)
                        continue

                    # IMPORTANT:
                    # retry exhaustion on the current model
                    # exits this model loop and advances to the
                    # next configured model.
                    if has_fallback:
                        break

                    continue

                if response.status_code == 404:

                    if has_fallback:
                        break

                    continue

                # Any other upstream failure also advances to
                # the fallback when one is configured.
                if has_fallback:
                    break

            # IMPORTANT:
            # This is the actual model-chain transition.
            if model_index < len(model_chain) - 1:
                continue

    raise HTTPException(
        status_code=502,
        detail={
            "message": (
                "All configured OpenRouter "
                "models failed."
            ),
            "upstream_status": last_status,
            "models_tried": model_chain,
            "attempts": attempts,
            "upstream": (
                last_body
                if isinstance(last_body, dict)
                else None
            ),
        },
    )


async def github_search(
    query: str,
    limit: int,
) -> dict[str, Any]:
    query = query.strip()

    if not query:
        raise HTTPException(
            status_code=400,
            detail="query is required.",
        )

    limit = max(1, min(limit, 100))

    timeout = httpx.Timeout(
        connect=20.0,
        read=60.0,
        write=20.0,
        pool=20.0,
    )

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers=github_headers(),
        ) as client:
            response = await client.get(
                f"{GITHUB_API}/search/repositories",
                params={
                    "q": query,
                    "per_page": limit,
                },
                headers=github_headers(),
            )
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="GitHub API request timed out.",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"GitHub network failure: {exc}",
        ) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="GitHub API returned invalid JSON.",
        ) from exc

    if response.status_code == 401:
        raise HTTPException(
            status_code=502,
            detail="GitHub rejected the configured credentials.",
        )

    if response.status_code == 403:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "GitHub denied the API request.",
                "upstream_status": 403,
            },
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=502,
            detail="GitHub API endpoint was not found.",
        )

    if response.status_code >= 500:
        raise HTTPException(
            status_code=502,
            detail={
                "message": f"GitHub API server error ({response.status_code}).",
                "upstream_status": response.status_code,
            },
        )

    if response.is_error:
        if isinstance(payload, dict):
            message = str(
                payload.get(
                    "message",
                    "GitHub request failed.",
                )
            )
        else:
            message = "GitHub request failed."

        raise HTTPException(
            status_code=502,
            detail={
                "message": message,
                "upstream_status": response.status_code,
            },
        )

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=502,
            detail="GitHub API returned an invalid response.",
        )

    items = payload.get("items", [])

    if not isinstance(items, list):
        raise HTTPException(
            status_code=502,
            detail="GitHub API returned an invalid repository list.",
        )

    results: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue

        owner = item.get("owner")
        if not isinstance(owner, dict):
            owner = {}

        license_data = item.get("license")
        if not isinstance(license_data, dict):
            license_data = {}

        results.append(
            {
                "name": item.get("full_name"),
                "description": item.get("description"),
                "url": item.get("html_url"),
                "clone_url": item.get("clone_url"),
                "ssh_url": item.get("ssh_url"),
                "stars": item.get("stargazers_count", 0),
                "forks": item.get("forks_count", 0),
                "language": item.get("language"),
                "license": license_data.get("spdx_id"),
                "default_branch": item.get("default_branch"),
                "owner": owner.get("login"),
            }
        )

    return {
        "query": query,
        "total_count": payload.get(
            "total_count",
            len(results),
        ),
        "results": results,
    }


def clean_android_html(value: str) -> str:
    soup = BeautifulSoup(value, "html.parser")

    for tag in soup(
        [
            "script",
            "style",
            "noscript",
            "svg",
            "nav",
            "footer",
        ]
    ):
        tag.decompose()

    text = soup.get_text("\n")

    text = re.sub(
        r"[ \t]+",
        " ",
        text,
    )

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text,
    )

    return text.strip()


ANDROID_TOPICS = {
    "compose": "develop/ui/compose",
    "room": "training/data-storage/room",
    "hilt": "training/dependency-injection/hilt-android",
    "viewmodel": "topic/libraries/architecture/viewmodel",
    "navigation": "guide/navigation",
    "coroutines": "kotlin/coroutines",
    "architecture": "topic/architecture",
    "testing": "training/testing",
    "permissions": "training/permissions",
    "services": "guide/components/services",
    "activity": "guide/components/activities",
    "fragments": "guide/fragments",
    "workmanager": "topic/libraries/architecture/workmanager",
    "datastore": "topic/libraries/architecture/datastore",
    "app-bundle": "guide/app-bundle",
    "gradle": "build",
    "kotlin": "kotlin",
    "jetpack": "jetpack",
}


def android_topic_url(topic: str) -> str:
    normalized = topic.strip()

    if not normalized:
        raise HTTPException(
            status_code=400,
            detail="topic is required.",
        )

    key = normalized.lower()

    if key in ANDROID_TOPICS:
        return urljoin(
            ANDROID_BASE,
            ANDROID_TOPICS[key],
        )

    if normalized.startswith(
        (
            "https://",
            "http://",
        )
    ):
        if not normalized.startswith(
            "https://developer.android.com/"
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only developer.android.com URLs "
                    "are allowed."
                ),
            )

        return normalized

    return urljoin(
        ANDROID_BASE,
        normalized.lstrip("/"),
    )


async def fetch_android(
    url: str,
) -> str:
    timeout = httpx.Timeout(
        connect=20.0,
        read=60.0,
        write=20.0,
        pool=20.0,
    )

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Traveler-Dev/1.0 "
                    "Android-Docs-Client"
                ),
                "Accept": (
                    "text/html,"
                    "application/xhtml+xml"
                ),
            },
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="Android Developer documentation timed out.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Android Developer documentation returned "
                f"HTTP {exc.response.status_code}."
            ),
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Android documentation network failure: {exc}",
        ) from exc


async def search_android(
    query: str,
    limit: int,
) -> list[dict[str, str]]:
    query = query.strip()

    if not query:
        raise HTTPException(
            status_code=400,
            detail="query is required.",
        )

    limit = max(1, min(limit, 25))

    url = (
        f"{ANDROID_SEARCH}"
        f"?q={quote(query)}"
    )

    html = await fetch_android(url)

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    results: list[dict[str, str]] = []
    seen: set[str] = set()

    for link in soup.find_all("a", href=True):
        href = str(link.get("href", "")).strip()

        if not href.startswith("/"):
            continue

        full_url = urljoin(
            ANDROID_BASE,
            href,
        )

        if not full_url.startswith(
            "https://developer.android.com/"
        ):
            continue

        title = clean_android_html(
            link.get_text(" ", strip=True)
        )

        if not title:
            continue

        key = full_url.lower()

        if key in seen:
            continue

        seen.add(key)

        results.append(
            {
                "title": title,
                "url": full_url,
                "source": "developer.android.com",
            }
        )

        if len(results) >= limit:
            break

    return results



@app.get("/")
async def root() -> dict[str, Any]:
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "ok",
        "service": "fastapi",
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": APP_NAME,
        "version": APP_VERSION,
    }


@app.get("/api/health")
async def api_health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": APP_NAME,
        "version": APP_VERSION,
        "openrouter_configured": bool(
            os.getenv("OPENROUTER_API_KEY", "").strip()
        ),
        "github_configured": bool(
            os.getenv("GITHUB_TOKEN", "").strip()
        ),
    }


@app.get("/api/config")
async def config() -> dict[str, Any]:
    return {
        "service": APP_NAME,
        "version": APP_VERSION,
        "providers": {
            "openrouter": {
                "configured": bool(
                    os.getenv(
                        "OPENROUTER_API_KEY",
                        "",
                    ).strip()
                ),
                "model": OPENROUTER_MODEL,
            },
            "github": {
                "configured": bool(
                    os.getenv(
                        "GITHUB_TOKEN",
                        "",
                    ).strip()
                ),
            },
        },
        "capabilities": [
            "ai",
            "github-search",
            "android-docs",
        ],
    }


@app.post("/api/ai/chat")
async def ai_chat(
    request: ChatRequest,
) -> dict[str, Any]:
    return await run_openrouter(request)


@app.post("/api/agent/run")
async def agent_run(
    request: AgentRequest,
) -> dict[str, Any]:
    return await run_openrouter(request)


@app.get("/api/github/search")
async def github_search_route(
    q: str = Query(min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    return await github_search(q, limit)

app.include_router(developer_tools_router)


@app.get("/api/android/docs")
async def android_docs(
    topic: str = Query(min_length=1),
) -> dict[str, Any]:
    url = android_topic_url(topic)
    html = await fetch_android(url)
    content = clean_android_html(html)

    if not content:
        raise HTTPException(
            status_code=502,
            detail=(
                "Android Developer documentation "
                "returned empty content."
            ),
        )

    return {
        "source": "developer.android.com",
        "topic": topic,
        "url": url,
        "format": "text",
        "content": content,
    }


@app.get("/api/android/docs/search")
async def android_docs_search(
    q: str = Query(min_length=1),
    limit: int = Query(default=10, ge=1, le=25),
) -> dict[str, Any]:
    return {
        "query": q,
        "results": await search_android(q, limit),
    }


@app.get("/api/android/docs/fetch")
async def android_docs_fetch(
    topic: str = Query(min_length=1),
) -> dict[str, Any]:
    return await android_docs(topic)


@app.get("/api/github")
async def github_compatibility_route(
    q: str = Query(min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    return await github_search(q, limit)
