#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-}"

if [ -z "$BASE_URL" ]; then
  echo "Usage: $0 https://your-render-service.onrender.com"
  exit 2
fi

BASE_URL="${BASE_URL%/}"

echo "===== TRAVELER DEV RENDER INTERROGATION ====="
echo "Target: $BASE_URL"
echo

request() {
  local method="$1"
  local path="$2"

  echo "----- $method $path -----"

  curl \
    --fail-with-body \
    --silent \
    --show-error \
    --location \
    --connect-timeout 15 \
    --max-time 60 \
    -X "$method" \
    -H 'Accept: application/json' \
    "$BASE_URL$path"

  echo
  echo
}

request GET "/health"

if curl \
  --fail-with-body \
  --silent \
  --show-error \
  --location \
  --connect-timeout 15 \
  --max-time 30 \
  "$BASE_URL/openapi.json" >/tmp/traveler-openapi.json
then
  echo "OpenAPI: PASS"

  python3 - <<'PY'
import json

with open("/tmp/traveler-openapi.json", "r", encoding="utf-8") as f:
    data = json.load(f)

paths = data.get("paths", {})

print("Registered production API routes:")

for path, methods in sorted(paths.items()):
    for method in sorted(methods):
        print(f"{method.upper():8} {path}")

required = ["/health"]

missing = [path for path in required if path not in paths]

if missing:
    raise SystemExit(
        "ERROR: required routes missing: " + ", ".join(missing)
    )

print("Required API contract: PASS")
PY
else
  echo "ERROR: Render OpenAPI endpoint unavailable"
  exit 1
fi

echo "===== RENDER INTERROGATION COMPLETE ====="
