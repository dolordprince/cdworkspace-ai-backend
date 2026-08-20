#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/cdesktop"
BACKEND="$ROOT/backend"
PYTHON="$BACKEND/.venv/bin/python"

EXPECTED_SOURCE_MODEL="z-ai/glm-5.2:free"
EXPECTED_RENDER_MODEL="anthropic/claude-sonnet-4.5"

EXPECTED_OPENROUTER_URL="https://openrouter.ai/api/v1"
EXPECTED_GROQ_URL="https://api.groq.com/openai/v1"
EXPECTED_CEREBRAS_URL="https://api.cerebras.ai/v1"

EXPECTED_GROQ_MODEL="llama-3.3-70b-versatile"
EXPECTED_CEREBRAS_MODEL="zai-glm-4.7"

echo "============================================================"
echo "CDESTKTOP — PROVIDER REGISTRY RELEASE-GATE REPAIR"
echo "============================================================"

echo "[1/6] Verifying backend"

[[ -d "$BACKEND" ]] || {
    echo "[FAIL] Backend missing: $BACKEND"
    exit 1
}

[[ -x "$PYTHON" ]] || {
    echo "[FAIL] Python missing: $PYTHON"
    exit 1
}

echo "[PASS] Backend: $BACKEND"
echo "[PASS] Python: $PYTHON"

echo "[2/6] Compiling provider architecture"

cd "$BACKEND"

"$PYTHON" -m compileall -q app

echo "[PASS] Provider architecture compiles"

echo "[3/6] Inspecting actual provider registry contract"

"$PYTHON" - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()
providers = build_providers(settings)

required = {"openrouter", "groq", "cerebras"}

missing = required - set(providers)

assert not missing, f"Missing providers: {sorted(missing)}"

for name in sorted(providers):
    provider = providers[name]

    print(f"[INFO] Provider: {name}")
    print(f"[INFO]   class    = {type(provider).__name__}")
    print(f"[INFO]   model    = {getattr(provider, 'model', None)!r}")
    print(f"[INFO]   base_url = {getattr(provider, 'base_url', None)!r}")
    print(f"[INFO]   endpoint = {getattr(provider, 'endpoint', None)!r}")

print("[PASS] All required providers are registered")
PY

echo "[4/6] Validating provider models and real endpoints"

"$PYTHON" - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()
providers = build_providers(settings)

expected = {
    "openrouter": {
        "model": "z-ai/glm-5.2:free",
        "base_url": "https://openrouter.ai/api/v1",
        "endpoint": "https://openrouter.ai/api/v1/chat/completions",
    },
    "groq": {
        "model": "llama-3.3-70b-versatile",
        "base_url": "https://api.groq.com/openai/v1",
        "endpoint": "https://api.groq.com/openai/v1/chat/completions",
    },
    "cerebras": {
        "model": "zai-glm-4.7",
        "base_url": "https://api.cerebras.ai/v1",
        "endpoint": "https://api.cerebras.ai/v1/chat/completions",
    },
}

for name, contract in expected.items():
    provider = providers[name]

    actual_model = getattr(provider, "model", None)
    actual_base = getattr(provider, "base_url", None)
    actual_endpoint = getattr(provider, "endpoint", None)

    assert actual_model == contract["model"], (
        f"{name}: model mismatch: "
        f"expected {contract['model']!r}, got {actual_model!r}"
    )

    assert actual_endpoint == contract["endpoint"], (
        f"{name}: endpoint mismatch: "
        f"expected {contract['endpoint']!r}, got {actual_endpoint!r}"
    )

    if actual_base is not None:
        assert actual_base == contract["base_url"], (
            f"{name}: base_url mismatch: "
            f"expected {contract['base_url']!r}, got {actual_base!r}"
        )

    print(
        f"[PASS] {name}: "
        f"model={actual_model} "
        f"endpoint={actual_endpoint}"
    )

print("[PASS] Provider endpoint contracts are valid")
PY

echo "[5/6] Verifying Render override independently"

OPENROUTER_MODEL="$EXPECTED_RENDER_MODEL" \
"$PYTHON" - <<'PY'
from app.config import Settings
from app.providers.registry import build_providers

settings = Settings()

assert settings.openrouter_model == "anthropic/claude-sonnet-4.5", (
    f"Render model override failed: {settings.openrouter_model!r}"
)

assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"

providers = build_providers(settings)

provider = providers["openrouter"]

assert provider.model == "anthropic/claude-sonnet-4.5"

assert provider.endpoint == (
    "https://openrouter.ai/api/v1/chat/completions"
)

print("[PASS] Render Settings override = anthropic/claude-sonnet-4.5")
print("[PASS] Render OpenRouter provider receives overridden model")
print(f"[PASS] Render endpoint = {provider.endpoint}")
PY

echo "[6/6] Final registry decision"

echo "============================================================"
echo "PROVIDER REGISTRY CONTRACT PASSED"
echo "============================================================"
echo "Source default : $EXPECTED_SOURCE_MODEL"
echo "Render override: $EXPECTED_RENDER_MODEL"
echo "OpenRouter     : $EXPECTED_OPENROUTER_URL"
echo "Groq           : $EXPECTED_GROQ_URL"
echo "Cerebras       : $EXPECTED_CEREBRAS_URL"
echo "============================================================"
