#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/packages/local-web"
PACKAGE="$WEB/package.json"

echo "============================================================"
echo " traveler_dev — PRODUCTION BUILD MEMORY FIX"
echo "============================================================"

test -f "$PACKAGE" || {
  echo "[FAIL] $PACKAGE not found"
  exit 1
}

cd "$ROOT"

python3 - <<'PY'
from pathlib import Path
import json

p = Path("packages/local-web/package.json")
data = json.loads(p.read_text())

scripts = data.setdefault("scripts", {})

scripts["build"] = "NODE_OPTIONS=--max-old-space-size=4096 tsc && NODE_OPTIONS=--max-old-space-size=4096 vite build"
scripts["build:memory"] = "NODE_OPTIONS=--max-old-space-size=4096 tsc && NODE_OPTIONS=--max-old-space-size=4096 vite build"

p.write_text(json.dumps(data, indent=2) + "\n")

print("[PASS] Node build heap configured to 4096 MB")
print("[PASS] production build command updated")
PY

echo
echo "===== TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

echo
echo "===== PRODUCTION BUILD ====="

pnpm --filter local-web build

echo
echo "===== DIST VERIFICATION ====="

test -f "$WEB/dist/index.html" || {
  echo "[FAIL] dist/index.html was not generated"
  exit 1
}

test -f "$WEB/dist/manifest.json" || {
  echo "[FAIL] PWA manifest was not generated"
  exit 1
}

echo "[PASS] dist/index.html"
echo "[PASS] PWA manifest"

echo
echo "============================================================"
echo " traveler_dev — BUILD PASS"
echo "============================================================"
