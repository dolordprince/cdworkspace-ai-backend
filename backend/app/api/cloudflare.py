from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.cloudflare import (
    CloudflareDeploymentError,
    CloudflarePagesService,
)


router = APIRouter(
    prefix="/api/cloudflare",
    tags=["cloudflare"],
)


class CloudflareDeployRequest(BaseModel):
    directory: str = Field(min_length=1)
    project: str | None = Field(default=None, min_length=1)


class CloudflareVerifyResponse(BaseModel):
    status: str
    account: Any


@router.get("/status")
async def cloudflare_status() -> dict[str, Any]:
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


@router.get("/projects")
async def cloudflare_projects() -> dict[str, Any]:
    service = CloudflarePagesService()

    try:
        settings = get_settings()

        url = (
            f"{settings.cloudflare_api_base_url.rstrip('/')}"
            f"/accounts/{settings.cloudflare_account_id}/pages/projects"
        )

        import httpx

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                url,
                headers=service._headers(),
            )

        if response.status_code >= 400:
            raise CloudflareDeploymentError(
                f"Cloudflare project listing failed with "
                f"HTTP {response.status_code}: "
                f"{response.text[:2000]}"
            )

        data = response.json()

        if data.get("success") is not True:
            raise CloudflareDeploymentError(
                f"Cloudflare project listing failed: {data}"
            )

        return {
            "projects": data.get("result") or [],
        }

    except CloudflareDeploymentError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@router.post(
    "/verify",
    response_model=CloudflareVerifyResponse,
)
async def verify_cloudflare() -> CloudflareVerifyResponse:
    try:
        data = await CloudflarePagesService().verify()
    except CloudflareDeploymentError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    return CloudflareVerifyResponse(
        status="verified",
        account=data.get("result"),
    )


@router.post("/deploy")
async def deploy_cloudflare(
    request: CloudflareDeployRequest,
) -> dict[str, Any]:
    directory = Path(request.directory).expanduser().resolve()

    if not directory.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Deployment directory does not exist: {directory}",
        )

    try:
        result = await CloudflarePagesService().deploy_directory(
            directory=directory,
            project_name=request.project,
        )

        return result

    except CloudflareDeploymentError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc
