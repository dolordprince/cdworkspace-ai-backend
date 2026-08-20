#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "===== traveler_dev BUILD REPAIR ====="

echo
echo "===== NODE MEMORY CONFIGURATION ====="

export NODE_OPTIONS="--max-old-space-size=4096"

node -e '
const v = require("v8").getHeapStatistics();
console.log("[PASS] Node executable:", process.execPath);
console.log("[PASS] Node version:", process.version);
console.log("[PASS] Heap limit:", Math.round(v.heap_size_limit / 1024 / 1024), "MB");
'

echo
echo "===== TAILWIND CONFIGURATION AUDIT ====="

TAILWIND_FILE="packages/local-web/tailwind.config.js"

if [ -f "$TAILWIND_FILE" ]; then
  cp "$TAILWIND_FILE" "$TAILWIND_FILE.bak.$(date +%Y%m%d%H%M%S)"

  node <<'NODE'
const fs = require("fs");

const file = "packages/local-web/tailwind.config.js";
let s = fs.readFileSync(file, "utf8");

const sources = [
  "./index.html",
  "./src/**/*.{js,ts,jsx,tsx}",
  "../web-core/**/*.{js,ts,jsx,tsx}",
  "../ui/**/*.{js,ts,jsx,tsx}"
];

if (/content\s*:\s*\[\s*\]/.test(s)) {
  s = s.replace(
    /content\s*:\s*\[\s*\]/,
    `content: ${JSON.stringify(sources, null, 2)}`
  );
} else if (!/content\s*:/.test(s)) {
  s = s.replace(
    /module\.exports\s*=\s*\{/,
    `module.exports = {\n  content: ${JSON.stringify(sources, null, 2)},`
  );
}

fs.writeFileSync(file, s);
console.log("[PASS] Tailwind content sources configured");
NODE
else
  echo "[INFO] No packages/local-web/tailwind.config.js found"
fi

echo
echo "===== TYPESCRIPT CHECK ====="

pnpm --filter local-web exec tsc --noEmit

echo
echo "===== VITE PRODUCTION BUILD ====="

NODE_OPTIONS="--max-old-space-size=4096" \
pnpm --filter local-web build

echo
echo "===== BUILD ARTIFACT AUDIT ====="

if [ ! -d packages/local-web/dist ]; then
  echo "[FAIL] Production dist directory was not created"
  exit 1
fi

if [ ! -f packages/local-web/dist/index.html ]; then
  echo "[FAIL] Production index.html was not created"
  exit 1
fi

if ! find packages/local-web/dist -type f \
  \( -name '*.js' -o -name '*.css' \) -print -quit | grep -q .; then
  echo "[FAIL] No JavaScript/CSS production assets found"
  exit 1
fi

echo "[PASS] Production dist exists"
echo "[PASS] Production index.html exists"
echo "[PASS] Production assets exist"

echo
echo "===== traveler_dev BUILD PASS ====="
