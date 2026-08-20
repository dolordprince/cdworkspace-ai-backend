#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT="${CLOUDFLARE_PAGES_PROJECT:-traveler-dev}"
WEB_DIR="$ROOT/packages/local-web"
DIST="$WEB_DIR/dist"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION DEPLOYMENT"
echo "============================================================"

test -n "${CLOUDFLARE_ACCOUNT_ID:-}" || {
  echo "[FAIL] CLOUDFLARE_ACCOUNT_ID is not configured"
  exit 1
}

test -n "${CLOUDFLARE_API_TOKEN:-}" || {
  echo "[FAIL] CLOUDFLARE_API_TOKEN is not configured"
  exit 1
}

echo
echo "===== 1. FINALIZE APPLICATION ====="

./scripts/finalize-traveler-dev-production.sh

echo
echo "===== 2. CLOUDFLARE CLI ====="

if ! command -v wrangler >/dev/null 2>&1; then
  echo "[INFO] Wrangler not installed globally; using pnpm dlx."
  WRANGLER=(pnpm dlx wrangler)
else
  WRANGLER=(wrangler)
fi

echo
echo "===== 3. CLOUDFLARE PAGES DEPLOYMENT ====="

"${WRANGLER[@]}" pages deploy "$DIST" \
  --project-name "$PROJECT"

echo
echo "===== 4. DEPLOYMENT VERIFICATION ====="

DEPLOYMENTS=""

for attempt in $(seq 1 8); do
  if DEPLOYMENTS="$(
    curl -4 -fsS \
      --connect-timeout 15 \
      --max-time 30 \
      "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT}/deployments" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json"
  )"; then
    break
  fi

  echo "[WARN] Cloudflare API attempt $attempt/8 failed"
  sleep 3
done

echo "$DEPLOYMENTS" | grep -q '"success":true' || {
  echo "[FAIL] Cloudflare deployment verification failed"
  exit 1
}

echo "[PASS] Cloudflare Pages deployment verified"

echo
echo "===== 5. PRODUCTION URL ====="

echo "https://${PROJECT}.pages.dev"

echo
echo "============================================================"
echo " traveler_dev — DEPLOYMENT COMPLETE"
echo "============================================================"
echo
echo "Install:"
echo "  Android phone  -> Chrome -> Install app"
echo "  Android tablet -> Chrome -> Install app"
echo "  Windows        -> Edge/Chrome -> Install"
echo "  macOS          -> Safari/Chrome -> Add to Dock"
echo "  Linux          -> Chrome/Chromium -> Install"
echo
echo "[PASS] traveler_dev production deployment"
