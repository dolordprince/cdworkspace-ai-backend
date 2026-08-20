#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "============================================================"
echo "CDESTKTOP REAL FASTAPI — PRODUCTION CONTRACT GATE"
echo "============================================================"

if [[ ! -f ".venv/bin/activate" ]]; then
    echo "[FAIL] Backend virtual environment does not exist"
    echo "Run: python3 -m venv .venv"
    exit 1
fi

. .venv/bin/activate

if [[ "${VIRTUAL_ENV:-}" != "$ROOT/.venv" ]]; then
    echo "[FAIL] Incorrect Python environment"
    exit 1
fi

echo
echo "[1/6] Python environment"
python --version
python - <<'PY'
import sys
print("Executable:", sys.executable)

if ".venv" not in sys.executable:
    raise SystemExit("[FAIL] Python is not running from backend/.venv")
PY

echo
echo "[2/6] FastAPI dependency contract"
python - <<'PY'
import fastapi
import uvicorn
import pydantic
import httpx

print("FastAPI :", fastapi.__version__)
print("Uvicorn :", uvicorn.__version__)
print("Pydantic:", pydantic.__version__)
print("httpx   :", httpx.__version__)
print("[PASS] FastAPI/Uvicorn/Pydantic/httpx available")
PY

echo
echo "[3/6] Application import"

if [[ ! -f "app/main.py" ]]; then
    echo "[FAIL] app/main.py does not exist"
    exit 1
fi

python - <<'PY'
from app.main import app

print("[PASS] app.main imported")
print("Application:", app.title)
PY

echo
echo "[4/6] OpenAPI contract"

python - <<'PY'
from app.main import app

schema = app.openapi()

if not isinstance(schema, dict):
    raise SystemExit("[FAIL] OpenAPI schema is invalid")

paths = schema.get("paths", {})

print("OpenAPI paths:", len(paths))
print("[PASS] OpenAPI generation")
PY

echo
echo "[5/6] Health endpoint"

python - <<'PY'
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

response = client.get("/health")

print("HTTP:", response.status_code)
print("Body:", response.text)

if response.status_code != 200:
    raise SystemExit("[FAIL] /health")

print("[PASS] /health")
PY

echo
echo "[6/6] Uvicorn startup contract"

python - <<'PY'
import asyncio
import uvicorn

config = uvicorn.Config(
    "app.main:app",
    host="127.0.0.1",
    port=7860,
    log_level="error",
)

server = uvicorn.Server(config)

async def check():
    await asyncio.wait_for(server.serve(), timeout=0.5)

try:
    asyncio.run(check())
except asyncio.TimeoutError:
    print("[PASS] Uvicorn application startup")
except SystemExit:
    raise
except Exception as exc:
    print("[FAIL] Uvicorn startup:", repr(exc))
    raise SystemExit(1)
PY

echo
echo "============================================================"
echo "ALL FASTAPI CONTRACT CHECKS PASSED"
echo "============================================================"
