from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services.android_docs import (
    fetch_android_docs,
    search_android_docs,
)

router = APIRouter(prefix="/api", tags=["developer-tools"])


@router.get("/android/docs")
async def android_docs(
    topic: str = Query(..., min_length=1, max_length=500),
):
    try:
        return await fetch_android_docs(topic)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Android Developer documentation unavailable: {exc}",
        ) from exc


@router.get("/android/docs/search")
async def android_docs_search(
    q: str = Query(..., min_length=1, max_length=300),
    limit: int = Query(10, ge=1, le=20),
):
    try:
        return await search_android_docs(q, limit)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Android Developer search unavailable: {exc}",
        ) from exc
