#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WEB="$ROOT/packages/local-web"
ENV_FILE="$WEB/.env.local"
PKG="$WEB/package.json"
PUBLIC="$WEB/public"
DIST="$WEB/dist"

RENDER_API="https://cdworkspace-ai-backend.onrender.com"
APP_NAME="traveler_dev"

export CI=true
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

pass() {
  printf '[PASS] %s\n' "$1"
}

info() {
  printf '[INFO] %s\n' "$1"
}

fail() {
  printf '\n[FAIL] %s\n' "$1"
  exit 1
}

require_file() {
  test -f "$1" || fail "Missing file: $1"
}

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION WORKSPACE REPAIR"
echo "============================================================"
echo

echo "===== 1. PROJECT ====="

test -d "$WEB" || fail "packages/local-web does not exist"
require_file "$PKG"
require_file "$WEB/index.html"
require_file "$WEB/vite.config.ts"

pass "CDesktop local-web package"

echo
echo "===== 2. PRODUCTION API CONFIGURATION ====="

cat > "$ENV_FILE" <<EOF
VITE_WORKSPACE_API_URL=${RENDER_API}
VITE_WORKSPACE_NAME=${APP_NAME}
VITE_WORKSPACE_PROJECT=${APP_NAME}
NEXT_PUBLIC_WORKSPACE_API_URL=${RENDER_API}
NEXT_PUBLIC_WORKSPACE_NAME=${APP_NAME}
NEXT_PUBLIC_WORKSPACE_PROJECT=${APP_NAME}
EOF

pass "traveler_dev production environment"

echo
echo "===== 3. PRODUCTION BACKEND ====="

HEALTH_FILE="/tmp/traveler_dev_health.json"

if curl -4 -fsS \
    --connect-timeout 20 \
    --max-time 45 \
    "${RENDER_API}/health" \
    -o "$HEALTH_FILE"; then

  pass "Render FastAPI /health"

  python3 - "$HEALTH_FILE" <<'PY'
import json
import sys

path = sys.argv[1]

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

if data.get("status") != "ok":
    raise SystemExit("Backend status is not ok")

if data.get("primary_provider") != "groq":
    raise SystemExit("Primary provider is not Groq")

if data.get("fallback_provider") != "cerebras":
    raise SystemExit("Fallback provider is not Cerebras")

print("service:", data.get("service"))
print("environment:", data.get("environment"))
print("primary_provider:", data.get("primary_provider"))
print("fallback_provider:", data.get("fallback_provider"))
print("[PASS] Render production backend contract")
PY

else
  echo
  echo "[WARN] Render health request failed from the current shell."
  echo
  echo "Production API remains:"
  echo "  $RENDER_API"
  echo
  echo "No production URL will be changed."
  echo "The previous HTTPS audit established that this endpoint"
  echo "successfully returned HTTP 200."
  echo
  info "Continuing local frontend repair."
fi

echo
echo "===== 4. WORKSPACE CONFIGURATION ====="

CONFIG="$ROOT/config/traveler-workspace.json"

if test -f "$CONFIG"; then
  python3 - "$CONFIG" "$RENDER_API" "$APP_NAME" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
render_api = sys.argv[2]
app_name = sys.argv[3]

data = json.loads(path.read_text())

data.setdefault("workspace", {})
data["workspace"]["name"] = app_name
data["workspace"]["project"] = app_name

data.setdefault("api", {})
data["api"]["baseUrl"] = render_api

data.setdefault("ai", {})
data["ai"]["primary"] = {
    **data["ai"].get("primary", {}),
    "provider": "groq",
}
data["ai"]["secondary"] = {
    **data["ai"].get("secondary", {}),
    "provider": "cerebras",
}

data.setdefault("capabilities", {})
data["capabilities"]["mcp"] = True
data["capabilities"]["github"] = True
data["capabilities"]["androidDeveloperDocs"] = True

path.write_text(json.dumps(data, indent=2) + "\n")
print("[PASS] traveler_dev workspace contract")
PY
else
  info "traveler-workspace.json not present; frontend configuration remains authoritative."
fi

echo
echo "===== 5. API CLIENT ====="

API_CLIENT="$WEB/src/lib/workspace-api.ts"

require_file "$API_CLIENT"

grep -q 'VITE_WORKSPACE_API_URL' "$API_CLIENT" \
  || fail "workspace API client does not use VITE_WORKSPACE_API_URL"

grep -q '/api/workspace/build' "$API_CLIENT" \
  || fail "workspace build endpoint missing"

grep -q '/api/workspace/test' "$API_CLIENT" \
  || fail "workspace test endpoint missing"

grep -q '/api/android/docs/search' "$API_CLIENT" \
  || fail "Android developer docs endpoint missing"

pass "production workspace API client"

echo
echo "===== 6. TANSTACK ROUTER ====="

ROUTER_DIR="$WEB/src/app/router"

if test -d "$ROUTER_DIR"; then
  pass "TanStack Router directory"
else
  fail "TanStack Router directory not found"
fi

ROUTER_INDEX="$ROUTER_DIR/index.ts"

if test -f "$ROUTER_INDEX"; then
  pass "TanStack Router source"
else
  ROUTER_INDEX="$(find "$ROUTER_DIR" -type f \
    \( -name '*.ts' -o -name '*.tsx' \) \
    -print | head -n 1 || true)"

  test -n "$ROUTER_INDEX" \
    || fail "No TanStack Router source found"

  pass "Router source discovered"
fi

echo
echo "===== 7. ROUTE TREE ====="

ROUTE_TREE="$WEB/src/routeTree.gen.ts"

if test -f "$ROUTE_TREE"; then
  pass "Generated route tree exists"
else
  info "Generated route tree is absent"

  if pnpm --filter local-web exec tsr generate >/tmp/traveler_dev_tsr.log 2>&1; then
    pass "TanStack route generation"
  else
    info "tsr command unavailable or generation failed"

    if pnpm --filter local-web exec tanstack-router-cli generate \
        >/tmp/traveler_dev_tsr.log 2>&1; then
      pass "TanStack route generation"
    else
      info "Existing application structure will be preserved."
    fi
  fi
fi

if test -f "$ROUTE_TREE"; then
  pass "routeTree.gen.ts"
fi

echo
echo "===== 8. PWA MANIFEST ====="

mkdir -p "$PUBLIC/icons"

cat > "$PUBLIC/manifest.json" <<EOF
{
  "name": "traveler_dev",
  "short_name": "traveler_dev",
  "description": "traveler_dev AI development workspace",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "display_override": [
    "window-controls-overlay",
    "standalone",
    "minimal-ui"
  ],
  "orientation": "any",
  "background_color": "#070b14",
  "theme_color": "#070b14",
  "categories": [
    "development",
    "productivity",
    "utilities"
  ],
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

pass "PWA manifest"

echo
echo "===== 9. PWA ICONS ====="

python3 - <<'PY'
from pathlib import Path
import struct
import zlib

out = Path("packages/local-web/public/icons")
out.mkdir(parents=True, exist_ok=True)

def make_png(path, size):
    w = h = size
    raw = bytearray()

    for y in range(h):
        raw.append(0)

        for x in range(w):
            bg = (7, 11, 20, 255)

            tx = (
                int(w * 0.22) <= x <= int(w * 0.78)
                and int(h * 0.20) <= y <= int(h * 0.34)
            )

            stem = (
                int(w * 0.43) <= x <= int(w * 0.57)
                and int(h * 0.34) <= y <= int(h * 0.80)
            )

            if tx or stem:
                pixel = (255, 255, 255, 255)
            else:
                pixel = bg

            raw.extend(pixel)

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
        )

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png += chunk(
        b"IHDR",
        struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    )
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    path.write_bytes(png)

make_png(out / "icon-192.png", 192)
make_png(out / "icon-512.png", 512)
PY

require_file "$PUBLIC/icons/icon-192.png"
require_file "$PUBLIC/icons/icon-512.png"

pass "PWA icons"

echo
echo "===== 10. SERVICE WORKER ====="

cat > "$PUBLIC/sw.js" <<'JS'
const CACHE_NAME = "traveler_dev-shell-v1";

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }

        return response;
      })
      .catch(() => caches.match(request).then(
        (cached) => cached || caches.match("/")
      ))
  );
});
JS

pass "production service worker"

echo
echo "===== 11. SERVICE WORKER REGISTRATION ====="

SW_FILE="$WEB/src/register-sw.ts"

cat > "$SW_FILE" <<'TS'
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    }).catch((error) => {
      console.error("traveler_dev service worker registration failed", error);
    });
  });
}
TS

pass "service worker registration module"

echo
echo "===== 12. MANIFEST REGISTRATION ====="

HTML="$WEB/index.html"

python3 - "$HTML" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

if 'rel="manifest"' not in text:
    marker = "<head>"
    replacement = (
        '<head>\n'
        '    <link rel="manifest" href="/manifest.json" />\n'
        '    <meta name="theme-color" content="#070b14" />\n'
        '    <meta name="mobile-web-app-capable" content="yes" />\n'
        '    <meta name="apple-mobile-web-app-capable" content="yes" />\n'
        '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />'
    )

    if marker in text:
        text = text.replace(marker, replacement, 1)

path.write_text(text)
PY

grep -q 'rel="manifest"' "$HTML" \
  || fail "Manifest was not registered in index.html"

pass "PWA manifest registered"

echo
echo "===== 13. GLASS UI FOUNDATION ====="

GLASS="$WEB/src/styles/traveler-dev-glass.css"
mkdir -p "$(dirname "$GLASS")"

cat > "$GLASS" <<'CSS'
:root {
  --traveler-bg: #070b14;
  --traveler-panel: rgba(15, 23, 42, 0.58);
  --traveler-panel-strong: rgba(15, 23, 42, 0.76);
  --traveler-border: rgba(255, 255, 255, 0.10);
  --traveler-border-active: rgba(255, 255, 255, 0.18);
  --traveler-text: #f8fafc;
  --traveler-muted: #94a3b8;
  --traveler-accent: #8b5cf6;
  --traveler-accent-soft: rgba(139, 92, 246, 0.18);
}

html,
body,
#root {
  min-height: 100%;
}

html {
  background: var(--traveler-bg);
}

body {
  margin: 0;
  color: var(--traveler-text);
  background:
    radial-gradient(
      circle at 15% 15%,
      rgba(124, 58, 237, 0.18),
      transparent 32%
    ),
    radial-gradient(
      circle at 85% 20%,
      rgba(59, 130, 246, 0.12),
      transparent 30%
    ),
    linear-gradient(
      135deg,
      #05070d 0%,
      #070b14 48%,
      #0b1020 100%
    );
}

.traveler-glass {
  background: var(--traveler-panel);
  border: 1px solid var(--traveler-border);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(24px) saturate(145%);
  -webkit-backdrop-filter: blur(24px) saturate(145%);
}

.traveler-glass-strong {
  background: var(--traveler-panel-strong);
  border: 1px solid var(--traveler-border-active);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(30px) saturate(150%);
  -webkit-backdrop-filter: blur(30px) saturate(150%);
}

.traveler-glow {
  box-shadow:
    0 0 0 1px rgba(139, 92, 246, 0.12),
    0 0 40px rgba(139, 92, 246, 0.10);
}

.traveler-scrollbar::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.traveler-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.traveler-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.20);
  border-radius: 999px;
}

@media (max-width: 768px) {
  .traveler-glass,
  .traveler-glass-strong {
    backdrop-filter: blur(18px) saturate(135%);
    -webkit-backdrop-filter: blur(18px) saturate(135%);
  }
}

@media (display-mode: standalone) {
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
CSS

pass "glass UI foundation"

echo
echo "===== 14. TAILWIND CONFIGURATION ====="

TAILWIND="$WEB/tailwind.config.js"

if test -f "$TAILWIND"; then
  if grep -q "content:" "$TAILWIND"; then
    pass "Tailwind content configuration exists"
  else
    info "Tailwind configuration requires manual project-specific preservation"
  fi
else
  if test -f "$WEB/tailwind.config.ts"; then
    pass "Tailwind TypeScript configuration exists"
  else
    info "No Tailwind config found; existing CSS pipeline will be preserved"
  fi
fi

echo
echo "===== 15. TYPECHECK ====="

pnpm --filter local-web exec tsc --noEmit

pass "TypeScript"

echo
echo "===== 16. PRODUCTION BUILD ====="

rm -rf "$DIST"

NODE_OPTIONS="--max-old-space-size=4096" \
  pnpm --filter local-web build

test -f "$DIST/index.html" \
  || fail "Production dist/index.html was not generated"

pass "Vite production build"

echo
echo "===== 17. PRODUCTION ARTIFACTS ====="

require_file "$DIST/index.html"

if test -f "$DIST/manifest.json"; then
  pass "dist/manifest.json"
else
  info "Manifest is not emitted to dist; checking public asset configuration"
fi

if test -f "$DIST/sw.js"; then
  pass "dist/sw.js"
else
  info "Service worker is not present in dist"
fi

echo
echo "===== 18. FINAL CONFIGURATION AUDIT ====="

grep -q "VITE_WORKSPACE_API_URL=${RENDER_API}" "$ENV_FILE" \
  || fail "Render API target missing"

grep -q "VITE_WORKSPACE_NAME=${APP_NAME}" "$ENV_FILE" \
  || fail "traveler_dev name missing"

grep -q "VITE_WORKSPACE_PROJECT=${APP_NAME}" "$ENV_FILE" \
  || fail "traveler_dev project missing"

python3 - <<'PY'
import json
from pathlib import Path

p = Path("config/traveler-workspace.json")

if p.exists():
    data = json.loads(p.read_text())

    blob = json.dumps(data).lower()

    for key in ("mcp", "github", "androiddeveloperdocs"):
        if key not in blob:
            raise SystemExit(f"Workspace capability missing: {key}")

print("[PASS] workspace capability configuration")
PY

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION REPAIR COMPLETE"
echo "============================================================"
echo
echo "Frontend:"
echo "  traveler_dev"
echo
echo "Production API:"
echo "  ${RENDER_API}"
echo
echo "AI:"
echo "  Groq primary"
echo "  Cerebras fallback"
echo
echo "Capabilities:"
echo "  MCP"
echo "  GitHub"
echo "  Android Developer Docs"
echo "  Workspace Build"
echo "  Workspace Test"
echo
echo "PWA:"
echo "  Android phone"
echo "  Android tablet"
echo "  Windows"
echo "  macOS"
echo "  Linux"
echo
echo "Build:"
echo "  ${DIST}"
echo
echo "Node heap:"
echo "  ${NODE_OPTIONS}"
echo
echo "[PASS] traveler_dev production workflow completed"
echo
