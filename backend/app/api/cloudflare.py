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
