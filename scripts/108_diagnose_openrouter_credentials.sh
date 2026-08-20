#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PY="$BACKEND/.venv/bin/python"

echo "============================================================"
echo "CDESTKTOP — OPENROUTER CREDENTIAL PRODUCTION DIAGNOSTIC"
echo "============================================================"

cd "$ROOT"

if [[ ! -x "$PY" ]]; then
    echo "[FAIL] Backend Python environment missing: $PY"
    exit 1
fi

echo "[1/8] Loading runtime configuration"

export CDESTKTOP_ROOT="$ROOT"

"$PY" - <<'PY'
import os
from pathlib import Path

root = Path(os.environ["CDESTKTOP_ROOT"])
env = root / "backend" / ".env"

print(f"[INFO] Environment file: {env}")

if not env.is_file():
    raise SystemExit("[FAIL] backend/.env does not exist")

values = {}

for raw in env.read_text(encoding="utf-8").splitlines():
    line = raw.strip()

    if not line or line.startswith("#") or "=" not in line:
        continue

    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip().strip('"').strip("'")

    if key in {
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODEL",
        "OPENROUTER_BASE_URL",
        "OPENROUTER_FALLBACK_MODEL",
        "OPENROUTER_FALLBACK_MODELS",
    }:
        values[key] = value

api_key = values.get("OPENROUTER_API_KEY", "").strip()

if not api_key:
    print("[FAIL] OPENROUTER_API_KEY is empty or absent")
    raise SystemExit(1)

print("[PASS] OPENROUTER_API_KEY is present")
print(f"[INFO] Key length: {len(api_key)}")
print(f"[INFO] Key prefix: {api_key[:10]}...")
print(f"[INFO] Key suffix: ...{api_key[-6:]}")

if not api_key.startswith("sk-or-v1-"):
    print("[WARN] Key does not use the expected OpenRouter key prefix")
else:
    print("[PASS] OpenRouter key prefix is valid")

model = values.get("OPENROUTER_MODEL", "")
base = values.get(
    "OPENROUTER_BASE_URL",
    "https://openrouter.ai/api/v1",
)

print(f"[INFO] Model: {model}")
print(f"[INFO] Base URL: {base}")

if model != "z-ai/glm-5.2:free":
    print("[FAIL] Runtime .env model is not z-ai/glm-5.2:free")
    raise SystemExit(1)

if base.rstrip("/") != "https://openrouter.ai/api/v1":
    print("[FAIL] Runtime OpenRouter URL is incorrect")
    raise SystemExit(1)

print("[PASS] Runtime model and URL are correct")
PY

echo "[2/8] Loading Settings through application configuration"

cd "$BACKEND"

"$PY" - <<'PY'
from app.config import get_settings

settings = get_settings()

key = settings.openrouter_api_key.strip()

if not key:
    raise SystemExit("[FAIL] Settings.openrouter_api_key is empty")

print("[PASS] Settings loaded OpenRouter credential")
print(f"[INFO] Credential length: {len(key)}")
print(f"[INFO] Credential prefix: {key[:10]}...")
print(f"[INFO] Credential suffix: ...{key[-6:]}")
print(f"[INFO] Model: {settings.openrouter_model}")
print(f"[INFO] Base URL: {settings.openrouter_base_url}")

assert settings.openrouter_model == "z-ai/glm-5.2:free"
assert settings.openrouter_base_url.rstrip("/") == "https://openrouter.ai/api/v1"

print("[PASS] Settings provider contract is correct")
PY

echo "[3/8] Verifying provider registry"

"$PY" - <<'PY'
from app.config import get_settings
from app.providers.registry import build_providers

settings = get_settings()
providers = build_providers(settings)

if "openrouter" not in providers:
    raise SystemExit("[FAIL] OpenRouter provider is not registered")

provider = providers["openrouter"]

print("[PASS] OpenRouter provider registered")
print(f"[INFO] Endpoint: {provider.endpoint}")
print(f"[INFO] Model: {provider.model}")

assert provider.model == "z-ai/glm-5.2:free"
assert provider.endpoint == (
    "https://openrouter.ai/api/v1/chat/completions"
)

print("[PASS] Provider endpoint contract is correct")
PY

echo "[4/8] Testing OpenRouter authentication endpoint"

"$PY" - <<'PY'
import asyncio
from app.config import get_settings
import httpx

async def main():
    settings = get_settings()

    key = settings.openrouter_api_key.strip()

    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }

    url = "https://openrouter.ai/api/v1/key"

    timeout = httpx.Timeout(
        connect=20.0,
        read=30.0,
        write=20.0,
        pool=20.0,
    )

    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
    ) as client:
        try:
            response = await client.get(
                url,
                headers=headers,
            )
        except httpx.HTTPError as exc:
            print(f"[FAIL] OpenRouter authentication request failed: {exc}")
            raise SystemExit(1)

    print(f"[INFO] HTTP status: {response.status_code}")

    if response.status_code == 200:
        print("[PASS] OpenRouter credential authenticated")
        return

    body = response.text[:1000]

    print(f"[FAIL] OpenRouter credential rejected")
    print(f"[INFO] Response: {body}")

    if response.status_code == 401:
        print("")
        print("[ACTION REQUIRED]")
        print("The OpenRouter API key currently stored in backend/.env")
        print("is invalid, revoked, expired, deleted, or belongs to an")
        print("account OpenRouter cannot resolve.")
        print("")
        print("Replace ONLY OPENROUTER_API_KEY in backend/.env with")
        print("a currently active OpenRouter API key.")
        print("")
        print("Do not change the model, provider registry, or FastAPI code.")

    raise SystemExit(2)

asyncio.run(main())
PY

echo "[5/8] Verifying no conflicting shell credential"

if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
    echo "[WARN] Shell exports OPENROUTER_API_KEY"
    echo "[INFO] Application .env remains the intended runtime source"
else
    echo "[PASS] Shell does not override OPENROUTER_API_KEY"
fi

echo "[6/8] Checking for accidental credential duplication"

matches="$(
    grep -RIl \
        --exclude='*.pyc' \
        --exclude-dir='__pycache__' \
        --exclude-dir='.git' \
        --exclude='*.bak' \
        --exclude='*.backup*' \
        'OPENROUTER_API_KEY=' \
        "$ROOT/backend" 2>/dev/null || true
)"

if [[ -n "$matches" ]]; then
    echo "[INFO] Files containing OPENROUTER_API_KEY:"
    while IFS= read -r file; do
        [[ -n "$file" ]] || continue
        echo "       $file"
    done <<< "$matches"
else
    echo "[WARN] No explicit OPENROUTER_API_KEY assignment found under backend"
fi

echo "[7/8] Python compilation"

"$PY" -m compileall -q "$BACKEND/app"

echo "[PASS] Backend Python compilation"

echo "[8/8] Final credential diagnostic"

echo "============================================================"
echo "OPENROUTER CREDENTIAL DIAGNOSTIC COMPLETE"
echo "============================================================"
echo "Model : z-ai/glm-5.2:free"
echo "URL   : https://openrouter.ai/api/v1"
echo ""
echo "If step [4/8] returns HTTP 200:"
echo "  The credential is valid and the provider workflow can continue."
echo ""
echo "If step [4/8] returns HTTP 401:"
echo "  Replace OPENROUTER_API_KEY in backend/.env."
echo "  No provider-code changes are required."
echo "============================================================"
