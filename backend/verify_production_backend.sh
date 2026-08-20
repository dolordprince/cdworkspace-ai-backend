#!/usr/bin/env bash
set -Eeuo pipefail

HOST="127.0.0.1"
PORT="${PORT:-7860}"
BASE="http://${HOST}:${PORT}"

echo "============================================================"
echo "TRAVELER DEV — FASTAPI PRODUCTION BACKEND VERIFICATION"
echo "============================================================"

echo "[1/6] Starting FastAPI"

if pgrep -af "uvicorn.*backend|uvicorn.*app" >/dev/null 2>&1; then
    echo "Existing uvicorn process detected."
else
    nohup python -m uvicorn app.main:app \
        --host "$HOST" \
        --port "$PORT" \
        > /tmp/traveler-fastapi.log 2>&1 &
    echo $! > /tmp/traveler-fastapi.pid
fi

echo "[2/6] Waiting for health endpoint"

for i in $(seq 1 30); do
    if curl -fsS --max-time 3 "$BASE/health" >/tmp/traveler-health.json 2>/dev/null; then
        break
    fi
    sleep 1
done

test -s /tmp/traveler-health.json

echo "Health:"
cat /tmp/traveler-health.json
echo

echo "[3/6] Checking OpenAPI"

curl -fsS --max-time 10 \
    "$BASE/openapi.json" \
    >/tmp/traveler-openapi.json

python - <<'PY'
import json

p = "/tmp/traveler-openapi.json"

with open(p, encoding="utf-8") as f:
    data = json.load(f)

paths = data.get("paths", {})

required = [
    "/health",
    "/api/health",
    "/api/ai/chat",
    "/api/android/docs",
    "/api/android/docs/search",
    "/api/github/search",
]

missing = [x for x in required if x not in paths]

if missing:
    raise SystemExit(
        "Missing production routes: " + ", ".join(missing)
    )

print("OpenAPI routes: PASS")
for path in required:
    print(" ", path)
PY

echo
echo "[4/6] Android documentation endpoint"

curl -fsS --max-time 30 \
    "$BASE/api/android/docs?topic=compose" \
    >/tmp/traveler-android.json

python - <<'PY'
import json

with open("/tmp/traveler-android.json", encoding="utf-8") as f:
    data = json.load(f)

text = json.dumps(data)

if len(text) < 100:
    raise SystemExit("Android documentation response is unexpectedly empty")

print("Android docs: PASS")
print("Response bytes:", len(text))
PY

echo
echo "[5/6] GitHub search endpoint"

curl -fsS --max-time 30 \
    "$BASE/api/github/search?q=fastapi" \
    >/tmp/traveler-github.json

python - <<'PY'
import json

with open("/tmp/traveler-github.json", encoding="utf-8") as f:
    data = json.load(f)

text = json.dumps(data)

if len(text) < 50:
    raise SystemExit("GitHub search response is unexpectedly empty")

print("GitHub search: PASS")
print("Response bytes:", len(text))
PY

echo
echo "[6/6] Backend package integrity"

python -m compileall -q app

python - <<'PY'
from app.main import app

print("Application:", app.title)
print("Version:", app.version)

routes = {
    getattr(r, "path", None)
    for r in app.routes
}

required = {
    "/health",
    "/api/health",
    "/api/ai/chat",
    "/api/android/docs",
    "/api/android/docs/search",
    "/api/github/search",
}

missing = required - routes

if missing:
    raise SystemExit(
        "Application is missing: " + ", ".join(sorted(missing))
    )

print("Application integrity: PASS")
PY

echo
echo "============================================================"
echo "ALL PRODUCTION BACKEND CHECKS PASSED"
echo "============================================================"
echo
echo "Backend:"
echo "$BASE"
echo
echo "OpenAPI:"
echo "$BASE/openapi.json"
echo
echo "Health:"
echo "$BASE/health"
