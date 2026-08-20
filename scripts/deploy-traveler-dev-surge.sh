#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API="${VITE_WORKSPACE_API_URL:-https://cdworkspace-ai-backend.onrender.com}"
PROJECT="${1:-}"

if [[ -z "$PROJECT" ]]; then
  echo "Usage: $0 <generated-project-directory>"
  exit 2
fi

PROJECT="$(realpath "$PROJECT")"

[[ -d "$PROJECT" ]] || {
  echo "[FAIL] Project directory does not exist: $PROJECT"
  exit 1
}

command -v curl >/dev/null || {
  echo "[FAIL] curl is required"
  exit 1
}

command -v npx >/dev/null || {
  echo "[FAIL] npx is required"
  exit 1
}

echo "============================================================"
echo " traveler_dev — SURGE PRODUCTION DEPLOYMENT"
echo "============================================================"
echo
echo "Backend: $API"
echo "Project: $PROJECT"
echo

if [[ -z "${SURGE_LOGIN:-}" || -z "${SURGE_TOKEN:-}" ]]; then
  echo "[FAIL] SURGE_LOGIN and SURGE_TOKEN must be configured."
  echo
  echo "Configure these as Render/server environment secrets."
  exit 1
fi

echo "===== PROJECT VALIDATION ====="

[[ -f "$PROJECT/index.html" ]] || {
  echo "[FAIL] Generated website has no index.html"
  exit 1
}

echo "[PASS] index.html"

if [[ -f "$PROJECT/package.json" ]]; then
  echo "[INFO] package.json detected"
fi

echo
echo "===== SURGE CLI ====="

npx --yes surge --version

echo
echo "===== DEPLOYMENT ====="

DOMAIN="${SURGE_DOMAIN:-}"

if [[ -z "$DOMAIN" ]]; then
  DOMAIN="traveler-dev-$(date +%s).surge.sh"
fi

export SURGE_LOGIN
export SURGE_TOKEN

npx --yes surge "$PROJECT" "$DOMAIN"

URL="https://${DOMAIN}"

echo
echo "===== DEPLOYMENT VERIFICATION ====="

HTTP_CODE="$(
  curl -4 -L \
    --connect-timeout 15 \
    --max-time 45 \
    -sS \
    -o /dev/null \
    -w '%{http_code}' \
    "$URL/"
)"

case "$HTTP_CODE" in
  2*|3*)
    echo "[PASS] Website deployed"
    ;;
  *)
    echo "[FAIL] Surge deployment returned HTTP $HTTP_CODE"
    exit 1
    ;;
esac

mkdir -p "$ROOT/.traveler-dev"

cat > "$ROOT/.traveler-dev/latest-deployment.json" <<JSON
{
  "project": "traveler_dev",
  "provider": "surge",
  "url": "$URL",
  "domain": "$DOMAIN",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo
echo "============================================================"
echo " SURGE DEPLOYMENT COMPLETE"
echo "============================================================"
echo
echo "Live URL:"
echo "$URL"
echo
