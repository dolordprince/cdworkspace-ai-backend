#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/packages/local-web"
ROUTER="$WEB/src/app/router/index.ts"

cd "$ROOT"

echo
echo "============================================================"
echo " traveler_dev — PWA REGISTRATION REPAIR"
echo "============================================================"

test -d "$WEB" || {
  echo "[FAIL] packages/local-web not found"
  exit 1
}

test -f "$ROUTER" || {
  echo "[FAIL] router entry not found: $ROUTER"
  exit 1
}

echo
echo "===== 1. INSPECT CURRENT REGISTRATION ====="

grep -nE \
  'registerServiceWorker|register-service-worker|register-sw' \
  "$ROUTER" \
  || true

echo
echo "===== 2. REMOVE DUPLICATE REGISTRATION IMPORTS ====="

python3 - "$ROUTER" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

lines = text.splitlines()

result = []
seen_import = False
seen_call = False

for line in lines:
    stripped = line.strip()

    # Remove every service-worker import. We will install exactly
    # one canonical import below.
    if (
        "registerServiceWorker" in stripped
        and stripped.startswith("import ")
    ):
        if not seen_import:
            result.append(
                'import { registerServiceWorker } from "../../register-sw";'
            )
            seen_import = True
        continue

    # Remove every existing invocation. We will install exactly one.
    if stripped == "registerServiceWorker();":
        if not seen_call:
            result.append(line)
            seen_call = True
        continue

    result.append(line)

if not seen_import:
    result.insert(
        0,
        'import { registerServiceWorker } from "../../register-sw";'
    )

if not seen_call:
    result.append("")
    result.append("registerServiceWorker();")

path.write_text("\n".join(result) + "\n")
PY

echo "[PASS] duplicate service-worker imports removed"

echo
echo "===== 3. VERIFY CANONICAL REGISTRATION ====="

IMPORT_COUNT="$(
  grep -c \
    'import { registerServiceWorker } from "../../register-sw";' \
    "$ROUTER" \
    || true
)"

CALL_COUNT="$(
  grep -c \
    '^registerServiceWorker();$' \
    "$ROUTER" \
    || true
)"

if [ "$IMPORT_COUNT" -ne 1 ]; then
  echo "[FAIL] expected exactly one canonical service-worker import; found $IMPORT_COUNT"
  exit 1
fi

if [ "$CALL_COUNT" -ne 1 ]; then
  echo "[FAIL] expected exactly one service-worker registration call; found $CALL_COUNT"
  exit 1
fi

if grep -q \
  'from "../../pwa/register-service-worker"' \
  "$ROUTER"; then
  echo "[FAIL] obsolete pwa/register-service-worker import remains"
  exit 1
fi

echo "[PASS] exactly one service-worker registration"

echo
echo "===== 4. VERIFY REGISTRATION MODULE ====="

test -f "$WEB/src/register-sw.ts" || {
  echo "[FAIL] canonical register-sw.ts missing"
  exit 1
}

grep -q \
  'navigator.serviceWorker.register("/sw.js"' \
  "$WEB/src/register-sw.ts" || {
    echo "[FAIL] canonical service-worker registration implementation missing"
    exit 1
  }

echo "[PASS] canonical registration module"

echo
echo "===== 5. TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

echo "[PASS] TypeScript"

echo
echo "===== 6. PRODUCTION BUILD ====="

rm -rf "$WEB/dist"

NODE_OPTIONS="--max-old-space-size=3072" \
  pnpm --filter local-web build

echo "[PASS] production build"

echo
echo "===== 7. PWA BUILD ARTIFACTS ====="

test -f "$WEB/dist/index.html" || {
  echo "[FAIL] dist/index.html missing"
  exit 1
}

test -f "$WEB/dist/manifest.json" || {
  echo "[FAIL] dist/manifest.json missing"
  exit 1
}

test -f "$WEB/dist/sw.js" || {
  echo "[FAIL] dist/sw.js missing"
  exit 1
}

test -f "$WEB/dist/icons/icon-192.png" || {
  echo "[FAIL] 192px PWA icon missing"
  exit 1
}

test -f "$WEB/dist/icons/icon-512.png" || {
  echo "[FAIL] 512px PWA icon missing"
  exit 1
}

echo "[PASS] PWA production artifacts"

echo
echo "===== 8. GENERATED HTML ====="

grep -q \
  'manifest.json' \
  "$WEB/dist/index.html" || {
    echo "[FAIL] generated HTML does not reference manifest"
    exit 1
  }

grep -q \
  'traveler_dev' \
  "$WEB/dist/index.html" || {
    echo "[FAIL] generated HTML does not contain traveler_dev"
    exit 1
  }

echo "[PASS] generated PWA HTML"

echo
echo "===== 9. FINAL REGISTRATION AUDIT ====="

grep -RInE \
  'registerServiceWorker|register-service-worker|register-sw' \
  "$WEB/src/app/router/index.ts" \
  "$WEB/src/register-sw.ts"

echo
echo "============================================================"
echo " traveler_dev — PWA REGISTRATION REPAIR COMPLETE"
echo "============================================================"
echo
echo "TypeScript: PASS"
echo "Production build: PASS"
echo "PWA artifacts: PASS"
echo "Service-worker registration: PASS"
echo
echo "Distribution:"
echo "  $WEB/dist"
echo
