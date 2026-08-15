from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.agent import router as agent_router
from app.api.health import router as health_router
from app.mcp.server import router as mcp_router


app = FastAPI(
    title="Workspace AI",
    version="1.0.0",
    description="Production Workspace AI backend powered by Groq.",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health_router)
app.include_router(agent_router)
app.include_router(mcp_router)
