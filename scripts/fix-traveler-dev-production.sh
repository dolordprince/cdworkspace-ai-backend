#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/packages/local-web"
ENV_FILE="$WEB/.env.local"

RENDER_API="https://cdworkspace-ai-backend.onrender.com"
APP_NAME="traveler_dev"

cd "$ROOT"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION FAILURE REPAIR"
echo "============================================================"

fail() {
    echo "[FAIL] $*" >&2
    exit 1
}

pass() {
    echo "[PASS] $*"
}

warn() {
    echo "[WARN] $*"
}

echo
echo "===== 1. PROJECT INTEGRITY ====="

test -d "$WEB" || fail "packages/local-web does not exist"
test -f "$WEB/package.json" || fail "package.json missing"
test -f "$WEB/index.html" || fail "index.html missing"
test -f "$WEB/vite.config.ts" || fail "vite.config.ts missing"

pass "CDesktop local-web project"

echo
echo "===== 2. PRODUCTION ENVIRONMENT ====="

cat > "$ENV_FILE" <<EOF
VITE_WORKSPACE_API_URL=$RENDER_API
VITE_WORKSPACE_NAME=$APP_NAME
VITE_WORKSPACE_PROJECT=$APP_NAME
NEXT_PUBLIC_WORKSPACE_API_URL=$RENDER_API
NEXT_PUBLIC_WORKSPACE_NAME=$APP_NAME
NEXT_PUBLIC_WORKSPACE_PROJECT=$APP_NAME
EOF

grep -Fxq "VITE_WORKSPACE_API_URL=$RENDER_API" "$ENV_FILE" \
    || fail "Vite API URL was not written correctly"

grep -Fxq "NEXT_PUBLIC_WORKSPACE_API_URL=$RENDER_API" "$ENV_FILE" \
    || fail "public API URL was not written correctly"

pass "traveler_dev production API target"

echo
echo "===== 3. RENDER CONNECTIVITY DIAGNOSTIC ====="

RENDER_OK=0

if getent hosts cdworkspace-ai-backend.onrender.com >/tmp/traveler-render-dns 2>/dev/null; then
    echo "[PASS] system DNS"
    cat /tmp/traveler-render-dns
else
    warn "system resolver cannot currently resolve Render"
fi

if command -v nslookup >/dev/null 2>&1; then
    if nslookup cdworkspace-ai-backend.onrender.com 1.1.1.1 \
        >/tmp/traveler-render-nslookup 2>&1; then

        echo "[PASS] Cloudflare DNS resolver"
        cat /tmp/traveler-render-nslookup
    else
        warn "Cloudflare DNS query failed"
    fi
fi

if command -v dig >/dev/null 2>&1; then
    if dig +short @1.1.1.1 \
        cdworkspace-ai-backend.onrender.com \
        >/tmp/traveler-render-dig 2>/dev/null; then

        if grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' \
            /tmp/traveler-render-dig
        then
            echo "[PASS] authoritative public DNS lookup"
            cat /tmp/traveler-render-dig
        fi
    fi
fi

if curl -4 -fsS \
    --connect-timeout 15 \
    --max-time 30 \
    "$RENDER_API/health" \
    >/tmp/traveler-render-health.json 2>/tmp/traveler-render-curl.err
then
    RENDER_OK=1

    cat /tmp/traveler-render-health.json

    grep -q '"status":"ok"' \
        /tmp/traveler-render-health.json \
        || fail "Render /health did not report status=ok"

    grep -q '"primary_provider":"groq"' \
        /tmp/traveler-render-health.json \
        || fail "Render primary provider is not Groq"

    grep -q '"fallback_provider":"cerebras"' \
        /tmp/traveler-render-health.json \
        || fail "Render fallback provider is not Cerebras"

    pass "Render FastAPI health"
    pass "Groq primary"
    pass "Cerebras fallback"
else
    warn "Local shell cannot currently reach Render."
    cat /tmp/traveler-render-curl.err 2>/dev/null || true
    echo
    echo "Production API remains:"
    echo "  $RENDER_API"
    echo
    echo "This does NOT change the frontend back to localhost."
fi

echo
echo "===== 4. DISCOVER REAL VITE ENTRYPOINT ====="

ENTRY=""

# First priority: the actual module referenced by index.html.
SCRIPT_SRC="$(
    python3 - "$WEB/index.html" <<'PY'
from html.parser import HTMLParser
from pathlib import Path
import sys

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.src = None

    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return

        attrs = dict(attrs)

        if attrs.get("type") != "module":
            return

        src = attrs.get("src")

        if src and src.startswith("/src/"):
            self.src = src[1:]
            return

        if src and src.startswith("./src/"):
            self.src = src[2:]
            return

parser = Parser()
parser.feed(Path(sys.argv[1]).read_text())

if parser.src:
    print(parser.src)
PY
)"

if [ -n "$SCRIPT_SRC" ] && [ -f "$WEB/$SCRIPT_SRC" ]; then
    ENTRY="$WEB/$SCRIPT_SRC"
fi

# Fallback: inspect package source only if index.html did not expose one.
if [ -z "$ENTRY" ]; then
    ENTRY="$(
        grep -RIl \
            --include='*.ts' \
            --include='*.tsx' \
            --include='*.js' \
            --include='*.jsx' \
            'createRoot(' \
            "$WEB/src" 2>/dev/null |
        head -n 1 || true
    )"
fi

test -n "$ENTRY" || fail "Real Vite application entrypoint could not be discovered"

test -f "$ENTRY" || fail "Discovered entrypoint does not exist: $ENTRY"

echo "[PASS] real application entry:"
echo "       ${ENTRY#$ROOT/}"

echo
echo "===== 5. PWA FILES ====="

mkdir -p "$WEB/public/icons"
mkdir -p "$WEB/src/pwa"

cat > "$WEB/public/manifest.json" <<EOF
{
  "name": "traveler_dev",
  "short_name": "traveler_dev",
  "description": "Production AI development workspace",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
EOF

cat > "$WEB/public/sw.js" <<'JS'
const CACHE_NAME = "traveler-dev-shell-v1";

const SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const cached = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cached);
          });
        }

        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached || caches.match("/")
        )
      )
  );
});
JS

cat > "$WEB/src/pwa/register-service-worker.ts" <<'TS'
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error) => {
        console.error(
          "traveler_dev service worker registration failed",
          error,
        );
      });
  });
}
TS

pass "manifest"
pass "service worker"
pass "registration module"

echo
echo "===== 6. INTEGRATE SERVICE WORKER INTO REAL ENTRY ====="

python3 - "$ENTRY" "$WEB/src/pwa/register-service-worker.ts" <<'PY'
from pathlib import Path
import sys
import os

entry = Path(sys.argv[1]).resolve()
module = Path(sys.argv[2]).resolve()

text = entry.read_text()

relative = os.path.relpath(module, entry.parent)
relative = relative.replace(os.sep, "/")

if not relative.startswith("."):
    relative = "./" + relative

statement = (
    f'import {{ registerServiceWorker }} '
    f'from "{relative}";'
)

# Remove previous incorrect registrations/imports generated by
# earlier scripts.
lines = text.splitlines()

clean = []

for line in lines:
    stripped = line.strip()

    if "register-service-worker" in stripped:
        continue

    if stripped == "registerServiceWorker();":
        continue

    clean.append(line)

text = "\n".join(clean)

if text and not text.endswith("\n"):
    text += "\n"

# Insert after the existing import block.
lines = text.splitlines()

insert_at = 0

while insert_at < len(lines):
    stripped = lines[insert_at].strip()

    if stripped.startswith("import "):
        insert_at += 1
    elif stripped == "" or stripped.startswith("//"):
        insert_at += 1
    else:
        break

lines.insert(insert_at, statement)
lines.append("")
lines.append("registerServiceWorker();")

entry.write_text("\n".join(lines) + "\n")

print(f"[PASS] service worker import: {relative}")
print("[PASS] service worker bootstrap registration")
PY

echo
echo "===== 7. VERIFY ENTRYPOINT IMPORT ====="

grep -n "register-service-worker" "$ENTRY" \
    || fail "Service worker import was not inserted"

grep -n "registerServiceWorker();" "$ENTRY" \
    || fail "Service worker registration call was not inserted"

pass "PWA registration is attached to the real Vite entrypoint"

echo
echo "===== 8. HTML PWA METADATA ====="

python3 - "$WEB/index.html" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

metadata = [
    '<link rel="manifest" href="/manifest.json" />',
    '<meta name="theme-color" content="#09090b" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-title" content="traveler_dev" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />',
]

for item in metadata:
    if item not in text:
        text = text.replace(
            "</head>",
            f"  {item}\n</head>",
            1,
        )

path.write_text(text)
PY

pass "PWA metadata"

echo
echo "===== 9. WORKSPACE CONTRACT ====="

test -f "$ROOT/config/traveler-workspace.json" \
    || fail "traveler workspace configuration missing"

node - "$ROOT/config/traveler-workspace.json" <<'NODE'
const fs = require("fs");

const config = JSON.parse(
  fs.readFileSync(process.argv[2], "utf8")
);

if (config.ai?.primary?.provider !== "groq") {
  throw new Error("Groq primary provider contract failed");
}

if (config.ai?.secondary?.provider !== "cerebras") {
  throw new Error("Cerebras fallback contract failed");
}

if (config.capabilities?.mcp !== true) {
  throw new Error("MCP capability disabled");
}

if (config.capabilities?.github !== true) {
  throw new Error("GitHub capability disabled");
}

if (config.capabilities?.androidDeveloperDocs !== true) {
  throw new Error("Android Developer Docs capability disabled");
}

console.log("[PASS] workspace contract");
NODE

echo
echo "===== 10. TYPESCRIPT VALIDATION ====="

pnpm --filter local-web exec tsc --noEmit

pass "TypeScript"

echo
echo "===== 11. PRODUCTION BUILD MEMORY REPAIR ====="

# The previous Vite build exhausted Node's default heap.
# This affects the build process only.
export NODE_OPTIONS="--max-old-space-size=4096"

pnpm --filter local-web build

pass "production build"

echo
echo "===== 12. PWA OUTPUT ====="

for file in \
    "$WEB/dist/index.html" \
    "$WEB/dist/manifest.json" \
    "$WEB/dist/sw.js" \
    "$WEB/dist/icons/icon-192.png" \
    "$WEB/dist/icons/icon-512.png"
do
    test -f "$file" || fail "Missing production output: $file"
done

pass "PWA production output"

echo
echo "===== 13. PRODUCTION API TARGET ====="

grep -Fxq "VITE_WORKSPACE_API_URL=$RENDER_API" "$ENV_FILE" \
    || fail "Vite API target changed"

grep -Fxq "NEXT_PUBLIC_WORKSPACE_API_URL=$RENDER_API" "$ENV_FILE" \
    || fail "public API target changed"

pass "frontend remains connected to Render"

echo
echo "============================================================"
echo " traveler_dev — REPAIR COMPLETE"
echo "============================================================"
echo
echo "Frontend:"
echo "  traveler_dev"
echo
echo "Backend:"
echo "  $RENDER_API"
echo
echo "AI:"
echo "  Groq -> primary"
echo "  Cerebras -> fallback"
echo
echo "Workspace:"
echo "  MCP"
echo "  GitHub"
echo "  Android Developer Docs"
echo "  Build"
echo "  Test"
echo
echo "PWA:"
echo "  Android phone"
echo "  Android tablet"
echo "  Windows laptop"
echo "  macOS laptop"
echo "  Linux laptop"
echo
echo "Build output:"
echo "  $WEB/dist"
echo

if [ "$RENDER_OK" -eq 1 ]; then
    echo "[PASS] Render verified during this run"
else
    echo "[WARN] Render could not be verified from this local DNS/network session"
    echo "[PASS] Render production URL remains configured"
fi

echo
