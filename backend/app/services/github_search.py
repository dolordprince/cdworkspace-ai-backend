from __future__ import annotations

import os

import httpx


GITHUB_API = "https://api.github.com"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)


def _headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Traveler-Dev-API/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    token = os.getenv("GITHUB_TOKEN", "").strip()

    if token:
        headers["Authorization"] = f"Bearer {token}"

    return headers


async def search_github(
    query: str,
    page: int = 1,
    per_page: int = 10,
) -> dict:
    query = query.strip()

    if not query:
        raise ValueError("query is required")

    page = max(1, min(page, 100))
    per_page = max(1, min(per_page, 30))

    params = {
        "q": query,
        "page": page,
        "per_page": per_page,
    }

    async with httpx.AsyncClient(
        timeout=TIMEOUT,
        follow_redirects=True,
        headers=_headers(),
    ) as client:
        response = await client.get(
            f"{GITHUB_API}/search/repositories",
            params=params,
        )
        response.raise_for_status()

    data = response.json()

    repositories = []

    for repo in data.get("items", []):
        repositories.append({
            "name": repo.get("full_name"),
            "description": repo.get("description"),
            "url": repo.get("html_url"),
            "clone_url": repo.get("clone_url"),
            "stars": repo.get("stargazers_count", 0),
            "forks": repo.get("forks_count", 0),
            "language": repo.get("language"),
            "license": (
                repo.get("license") or {}
            ).get("spdx_id"),
            "default_branch": repo.get("default_branch"),
            "updated_at": repo.get("updated_at"),
        })

    return {
        "query": query,
        "total_count": data.get("total_count", 0),
        "page": page,
        "per_page": per_page,
        "repositories": repositories,
    }
