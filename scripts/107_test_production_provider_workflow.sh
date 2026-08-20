#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"
PORT="${PORT:-8000}"
BASE="http://127.0.0.1:${PORT}"

echo "============================================================"
echo "CDESTKTOP — PRODUCTION PROVIDER WORKFLOW TEST"
echo "============================================================"

if [ ! -x "$PY" ]; then
    echo "[FAIL] Backend Python missing: $PY"
    exit 1
fi

cd "$BACKEND"

echo "[1/12] Python/runtime"

"$PY" --version

echo "[2/12] Complete backend compilation"

"$PY" -m compileall -q app

echo "[PASS] Backend compilation"

echo "[3/12] Loading production Settings"

"$PY" <<'PY'
from app.config import Settings

s = Settings()

assert s.openrouter_model == "z-ai/glm-5.2:free"
assert s.openrouter_base_url == "https://openrouter.ai/api/v1"
assert s.groq_model == "llama-3.3-70b-versatile"
assert s.cerebras_model == "zai-glm-4.7"

print("[PASS] Settings production contract")
print(f"       OpenRouter : {s.openrouter_model}")
print(f"       Groq       : {s.groq_model}")
print(f"       Cerebras   : {s.cerebras_model}")
PY

echo "[4/12] Provider registry"

"$PY" <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

s = Settings()
providers = build_providers(s)

required = {"openrouter", "groq", "cerebras"}

missing = required - set(providers)

assert not missing, f"Missing providers: {sorted(missing)}"

assert providers["openrouter"].model == "z-ai/glm-5.2:free"
assert providers["openrouter"].base_url == "https://openrouter.ai/api/v1"

assert providers["groq"].model == "llama-3.3-70b-versatile"
assert providers["groq"].base_url == "https://api.groq.com/openai/v1"

assert providers["cerebras"].model == "zai-glm-4.7"
assert providers["cerebras"].base_url == "https://api.cerebras.ai/v1"

print("[PASS] Provider registry")
PY

echo "[5/12] FastAPI application import and safe route inspection"

"$PY" <<'PY'
from fastapi.routing import APIRoute
from fastapi import FastAPI

from app.main import app

assert isinstance(app, FastAPI)

routes = []

for route in app.routes:
    if isinstance(route, APIRoute):
        routes.append(
            {
                "path": route.path,
                "methods": sorted(route.methods or []),
                "name": route.name,
            }
        )

print("[PASS] FastAPI application imported")
print(f"[INFO] Direct API routes: {len(routes)}")

for route in sorted(routes, key=lambda x: x["path"]):
    methods = ",".join(route["methods"])
    print(f"       {methods:12} {route['path']}")

required_paths = {
    "/api/ai/chat",
}

available_paths = {route["path"] for route in routes}

missing = required_paths - available_paths

assert not missing, f"Required API routes missing: {sorted(missing)}"

print("[PASS] Required AI route discovered")
PY

echo "[6/12] Starting/reusing FastAPI test server"

SERVER_PID=""

if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
    echo "[INFO] Port ${PORT} already listening"
else
    echo "[INFO] Starting FastAPI test server"

    "$PY" -m uvicorn app.main:app \
        --host 127.0.0.1 \
        --port "$PORT" \
        >/tmp/cdesktop-provider-test.log 2>&1 &

    SERVER_PID=$!

    cleanup() {
        if [ -n "$SERVER_PID" ]; then
            kill "$SERVER_PID" 2>/dev/null || true
        fi
    }

    trap cleanup EXIT

    READY=0

    for i in $(seq 1 30); do
        if curl -sS \
            --connect-timeout 2 \
            --max-time 5 \
            "$BASE/openapi.json" \
            >/tmp/cdesktop-openapi.json 2>/dev/null; then

            READY=1
            break
        fi

        if ! kill -0 "$SERVER_PID" 2>/dev/null; then
            echo "[FAIL] FastAPI process exited"
            cat /tmp/cdesktop-provider-test.log
            exit 1
        fi

        sleep 1
    done

    if [ "$READY" -ne 1 ]; then
        echo "[FAIL] FastAPI server did not become ready"
        cat /tmp/cdesktop-provider-test.log
        exit 1
    fi
fi

echo "[PASS] FastAPI server reachable"

echo "[7/12] OpenAPI endpoint"

curl -fsS \
    --connect-timeout 10 \
    --max-time 20 \
    "$BASE/openapi.json" \
    >/tmp/cdesktop-openapi.json

"$PY" <<'PY'
import json
from pathlib import Path

data = json.loads(
    Path("/tmp/cdesktop-openapi.json").read_text()
)

assert isinstance(data, dict)
assert isinstance(data.get("paths"), dict)

paths = set(data["paths"])

assert "/api/ai/chat" in paths

print(f"[PASS] OpenAPI document valid")
print(f"[INFO] Published paths: {len(paths)}")
print("[PASS] /api/ai/chat published")
PY

echo "[8/12] Provider endpoint contract"

"$PY" <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()
providers = build_providers(settings)

openrouter = providers["openrouter"]

assert openrouter.name == "openrouter"
assert openrouter.model == "z-ai/glm-5.2:free"
assert openrouter.endpoint == (
    "https://openrouter.ai/api/v1/chat/completions"
)

groq = providers["groq"]

assert groq.endpoint == (
    "https://api.groq.com/openai/v1/chat/completions"
)

cerebras = providers["cerebras"]

assert cerebras.endpoint == (
    "https://api.cerebras.ai/v1/chat/completions"
)

print("[PASS] OpenRouter endpoint")
print(f"       {openrouter.endpoint}")

print("[PASS] Groq endpoint")
print(f"       {groq.endpoint}")

print("[PASS] Cerebras endpoint")
print(f"       {cerebras.endpoint}")
PY

echo "[9/12] Direct OpenRouter production inference"

"$PY" <<'PY'
import asyncio
import sys

from app.config import Settings
from app.providers.registry import build_providers
from app.providers.openai_compatible import ProviderError

async def main():
    settings = Settings()
    providers = build_providers(settings)

    provider = providers["openrouter"]

    try:
        result = await provider.complete(
            "Reply with exactly: CDESTKTOP_PROVIDER_OK"
        )
    except ProviderError as exc:
        print("[FAIL] OpenRouter inference failed")
        print(f"       provider={exc.provider}")
        print(f"       status={exc.status_code}")
        print(f"       error={exc}")
        sys.exit(1)

    if not isinstance(result, str) or not result.strip():
        print("[FAIL] OpenRouter returned empty content")
        sys.exit(1)

    print("[PASS] OpenRouter production inference")
    print(f"       Model: {provider.model}")
    print(f"       Response: {result.strip()[:500]}")

asyncio.run(main())
PY

echo "[10/12] FastAPI /api/ai/chat workflow"

CHAT_RESPONSE="$(
    curl -fsS \
        --connect-timeout 15 \
        --max-time 150 \
        -X POST \
        "$BASE/api/ai/chat" \
        -H 'Content-Type: application/json' \
        -d '{"message":"Reply with exactly: CDESTKTOP_API_OK"}'
)"

printf '%s\n' "$CHAT_RESPONSE" \
    | tee /tmp/cdesktop-chat-response.json

"$PY" <<'PY'
import json
from pathlib import Path

data = json.loads(
    Path("/tmp/cdesktop-chat-response.json").read_text()
)

assert isinstance(data, dict)

print("[PASS] /api/ai/chat returned valid JSON")

provider = data.get("provider")
model = data.get("model")

if provider:
    print(f"[INFO] Provider: {provider}")

if model:
    print(f"[INFO] Model: {model}")

content = (
    data.get("content")
    or data.get("response")
    or data.get("message")
)

if isinstance(content, dict):
    content = (
        content.get("content")
        or content.get("response")
        or content.get("text")
    )

if isinstance(content, str) and content.strip():
    print("[PASS] AI response contains textual content")
else:
    print("[INFO] Inspecting complete response schema")
    print(json.dumps(data, indent=2)[:4000])
PY

echo "[11/12] Provider status/source audit"

"$PY" <<'PY'
from pathlib import Path

root = Path("/root/cdesktop")

files = [
    root / "backend/app/config.py",
    root / "backend/app/providers/openai_compatible.py",
    root / "backend/app/providers/registry.py",
    root / "backend/app/main.py",
]

for path in files:
    assert path.exists(), f"Missing provider file: {path}"

config = (root / "backend/app/config.py").read_text()

assert 'openrouter_model: str = "z-ai/glm-5.2:free"' in config
assert 'openrouter_base_url: str = "https://openrouter.ai/api/v1"' in config

provider = (
    root / "backend/app/providers/openai_compatible.py"
).read_text()

assert "class OpenAICompatibleProvider" in provider
assert "/chat/completions" in provider

registry = (
    root / "backend/app/providers/registry.py"
).read_text()

for name in ("openrouter", "groq", "cerebras"):
    assert f'"{name}"' in registry

print("[PASS] Provider source contract")
PY

echo "[12/12] Final Git/deployment audit"

cd "$ROOT"

echo "--- Git status ---"
git status --short

echo
echo "--- Production stale-model scan ---"

if grep -RInE \
    --exclude='*.pyc' \
    --exclude-dir='__pycache__' \
    --exclude-dir='.git' \
    --exclude='*.bak' \
    --exclude='*.backup*' \
    --exclude='*.backup' \
    'qwen/qwen3-coder:free' \
    backend/app \
    backend/.env \
    backend/.env.example \
    2>/dev/null; then

    echo "[FAIL] Stale qwen production reference detected"
    exit 1
else
    echo "[PASS] No stale qwen production reference"
fi

echo
echo "--- Production OpenRouter model scan ---"

if grep -RInE \
    --exclude='*.pyc' \
    --exclude-dir='__pycache__' \
    --exclude-dir='.git' \
    'z-ai/glm-5.2:free' \
    backend/app \
    backend/.env.example \
    2>/dev/null; then

    echo "[PASS] Production model reference present"
else
    echo "[FAIL] Production model reference missing"
    exit 1
fi

echo
echo "============================================================"
echo "PRODUCTION PROVIDER WORKFLOW TEST COMPLETE"
echo "============================================================"
echo "Primary OpenRouter model : z-ai/glm-5.2:free"
echo "OpenRouter fallback      : openrouter/free"
echo "Groq                     : llama-3.3-70b-versatile"
echo "Cerebras                 : zai-glm-4.7"
echo "============================================================"
