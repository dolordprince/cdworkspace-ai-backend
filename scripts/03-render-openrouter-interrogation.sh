#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-}"

if [ -z "$BASE_URL" ]; then
  echo "Usage: $0 https://your-render-service.onrender.com"
  exit 2
fi

BASE_URL="${BASE_URL%/}"

echo "===== OPENROUTER / CLAUDE PRODUCTION INTERROGATION ====="

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --location \
  --connect-timeout 15 \
  --max-time 180 \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data '{
    "message": "Return exactly: TRAVELER DEV OPENROUTER OK"
  }' \
  "$BASE_URL/api/agent/run"

echo
echo
echo "OpenRouter/Claude interrogation completed."
