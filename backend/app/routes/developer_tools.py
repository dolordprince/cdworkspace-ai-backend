from fastapi import APIRouter

router = APIRouter(prefix="/api/dev-tools", tags=["developer-tools"])

@router.get("/health")
async def dev_tools_health():
    return {"status": "ok", "service": "developer-tools"}
