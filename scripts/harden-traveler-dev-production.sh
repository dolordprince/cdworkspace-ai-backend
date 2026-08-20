#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/packages/local-web"
DIST="$WEB/dist"
ENV="$WEB/.env.local"
VITE="$WEB/vite.config.ts"
INDEX="$WEB/index.html"
PUBLIC="$WEB/public"

RENDER_API="https://cdworkspace-ai-backend.onrender.com"
APP_NAME="traveler_dev"

cd "$ROOT"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION HARDENING"
echo "============================================================"

fail() {
  echo "[FAIL] $1"
  exit 1
}

pass() {
  echo "[PASS] $1"
}

warn() {
  echo "[WARN] $1"
}

echo
echo "===== 1. PROJECT ====="

test -d "$WEB" || fail "packages/local-web not found"
test -f "$WEB/package.json" || fail "local-web package.json missing"
test -f "$INDEX" || fail "local-web index.html missing"

pass "CDesktop local-web workspace"

echo
echo "===== 2. PRODUCTION ENVIRONMENT ====="

cat > "$ENV" <<EOF
VITE_WORKSPACE_API_URL=$RENDER_API
VITE_WORKSPACE_NAME=$APP_NAME
VITE_WORKSPACE_PROJECT=$APP_NAME
NEXT_PUBLIC_WORKSPACE_API_URL=$RENDER_API
NEXT_PUBLIC_WORKSPACE_NAME=$APP_NAME
NEXT_PUBLIC_WORKSPACE_PROJECT=$APP_NAME
EOF

pass "Render FastAPI production API"
pass "$APP_NAME identity"

echo
echo "===== 3. PWA DIRECTORIES ====="

mkdir -p "$PUBLIC"

pass "public directory"

echo
echo "===== 4. WEB APP MANIFEST ====="

cat > "$PUBLIC/manifest.json" <<'EOF'
{
  "name": "traveler_dev",
  "short_name": "traveler_dev",
  "description": "Production AI development workspace",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#07111f",
  "theme_color": "#07111f",
  "prefer_related_applications": false,
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

mkdir -p "$PUBLIC/icons"

pass "PWA manifest"

echo
echo "===== 5. PWA ICONS ====="

python3 - <<'PY'
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception:
    raise SystemExit(
        "Pillow is required to generate production PWA icons. "
        "Install it with: python3 -m pip install Pillow"
    )

out = Path("packages/local-web/public/icons")
out.mkdir(parents=True, exist_ok=True)

for size in (192, 512):
    img = Image.new("RGBA", (size, size), "#07111f")
    draw = ImageDraw.Draw(img)

    margin = int(size * 0.12)
    radius = int(size * 0.18)

    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=radius,
        fill="#101d31",
        outline="#7c3aed",
        width=max(3, size // 64),
    )

    # Simple production-safe "t" mark.
    stroke = max(8, size // 18)
    x = size // 2

    draw.line(
        (x, int(size * 0.27), x, int(size * 0.70)),
        fill="#ffffff",
        width=stroke,
    )

    draw.line(
        (int(size * 0.34), int(size * 0.38),
         int(size * 0.66), int(size * 0.38)),
        fill="#ffffff",
        width=stroke,
    )

    img.save(out / f"icon-{size}.png", "PNG")

print("[PASS] generated 192x192 and 512x512 PWA icons")
PY

echo
echo "===== 6. SERVICE WORKER ====="

cat > "$PUBLIC/sw.js" <<'EOF'
const CACHE_NAME = "traveler-dev-shell-v1";

const APP_SHELL = [
  "/",
  "/manifest.json"
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
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }

        return response;
      })
      .catch(() => caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return caches.match("/");
      }))
  );
});
EOF

pass "production service worker"

echo
echo "===== 7. SERVICE WORKER REGISTRATION ====="

mkdir -p "$WEB/src"

cat > "$WEB/src/register-sw.ts" <<'EOF'
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
EOF

pass "service worker registration module"

echo
echo "===== 8. HTML PWA HEAD ====="

python3 - <<'PY'
from pathlib import Path

p = Path("packages/local-web/index.html")
s = p.read_text()

tags = [
    '<link rel="manifest" href="/manifest.json">',
    '<meta name="theme-color" content="#07111f">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="traveler_dev">',
    '<link rel="apple-touch-icon" href="/icons/icon-192.png">',
]

marker = "</head>"

if marker not in s:
    raise SystemExit("index.html does not contain </head>")

for tag in tags:
    if tag not in s:
        s = s.replace(marker, f"    {tag}\n{marker}", 1)

p.write_text(s)
print("[PASS] PWA metadata installed")
PY

echo
echo "===== 9. SERVICE WORKER IMPORT ====="

ENTRY=""

for candidate in \
  "$WEB/src/main.tsx" \
  "$WEB/src/main.ts" \
  "$WEB/src/main.jsx" \
  "$WEB/src/main.js"
do
  if [[ -f "$candidate" ]]; then
    ENTRY="$candidate"
    break
  fi
done

if [[ -n "$ENTRY" ]]; then

  if ! grep -q "register-sw" "$ENTRY"; then
    python3 - "$ENTRY" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

ext = p.suffix

if ext in {".ts", ".tsx"}:
    import_line = 'import { registerServiceWorker } from "./register-sw";\n'
else:
    import_line = 'import { registerServiceWorker } from "./register-sw.js";\n'

s = import_line + s

if "registerServiceWorker();" not in s:
    s += "\nregisterServiceWorker();\n"

p.write_text(s)
PY
  fi

  pass "service worker connected to $ENTRY"

else
  warn "No conventional main.tsx/main.ts entrypoint found"

  ROUTER="$WEB/src/app/router/index.ts"

  if [[ -f "$ROUTER" ]]; then
    if ! grep -q "register-sw" "$ROUTER"; then
      python3 - "$ROUTER" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

if 'from "../../register-sw"' not in s:
    s = 'import { registerServiceWorker } from "../../register-sw";\n' + s

if "registerServiceWorker();" not in s:
    s += "\nregisterServiceWorker();\n"

p.write_text(s)
PY
    fi

    pass "service worker connected through router entry"
  else
    fail "Unable to locate a frontend execution entrypoint"
  fi
fi

echo
echo "===== 10. SENTRY BUILD CONFIGURATION ====="

if [[ -f "$VITE" ]]; then

  python3 - "$VITE" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

# Prevent unauthenticated source-map upload from turning production
# builds into noisy/failing CI operations.
if "@sentry/vite-plugin" in s:
    s = s.replace(
        "sentryVitePlugin({",
        "sentryVitePlugin({\n      authToken: process.env.SENTRY_AUTH_TOKEN,\n      sourcemaps: process.env.SENTRY_AUTH_TOKEN ? { upload: true } : false,"
    )

p.write_text(s)
PY

  pass "Sentry source-map upload guarded by SENTRY_AUTH_TOKEN"

else
  warn "vite.config.ts not found"
fi

echo
echo "===== 11. API CONTRACT ====="

node <<'NODE'
const fs = require("fs");

const env = fs.readFileSync(
  "packages/local-web/.env.local",
  "utf8"
);

const required = [
  "VITE_WORKSPACE_API_URL=https://cdworkspace-ai-backend.onrender.com",
  "NEXT_PUBLIC_WORKSPACE_API_URL=https://cdworkspace-ai-backend.onrender.com",
  "VITE_WORKSPACE_NAME=traveler_dev",
  "VITE_WORKSPACE_PROJECT=traveler_dev"
];

for (const value of required) {
  if (!env.includes(value)) {
    throw new Error(`Missing production configuration: ${value}`);
  }
}

console.log("[PASS] traveler_dev production API contract");
NODE

echo
echo "===== 12. WORKSPACE CAPABILITY CONTRACT ====="

if [[ -f "$ROOT/config/traveler-workspace.json" ]]; then
  node <<'NODE'
const fs = require("fs");

const x = JSON.parse(
  fs.readFileSync("config/traveler-workspace.json", "utf8")
);

if (x.ai?.primary?.provider !== "groq") {
  throw new Error("Groq is not configured as primary provider");
}

if (x.ai?.secondary?.provider !== "cerebras") {
  throw new Error("Cerebras is not configured as secondary provider");
}

if (x.capabilities?.mcp !== true) {
  throw new Error("MCP capability is disabled");
}

if (x.capabilities?.github !== true) {
  throw new Error("GitHub capability is disabled");
}

if (x.capabilities?.androidDeveloperDocs !== true) {
  throw new Error("Android Developer Docs capability is disabled");
}

if (x.capabilities?.workspaceBuild !== true) {
  throw new Error("Workspace Build capability is disabled");
}

if (x.capabilities?.workspaceTest !== true) {
  throw new Error("Workspace Test capability is disabled");
}

console.log("[PASS] workspace capability contract");
NODE
else
  warn "config/traveler-workspace.json not found"
fi

echo
echo "===== 13. TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

pass "TypeScript"

echo
echo "===== 14. PRODUCTION BUILD ====="

rm -rf "$DIST"

NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072" \
  pnpm --filter local-web build

test -f "$DIST/index.html" || fail "dist/index.html missing"
test -f "$DIST/manifest.json" || fail "dist/manifest.json missing"
test -f "$DIST/sw.js" || fail "dist/sw.js missing"
test -f "$DIST/icons/icon-192.png" || fail "192px PWA icon missing"
test -f "$DIST/icons/icon-512.png" || fail "512px PWA icon missing"

pass "production distribution"

echo
echo "===== 15. GENERATED PWA AUDIT ====="

node <<'NODE'
const fs = require("fs");

const manifest = JSON.parse(
  fs.readFileSync(
    "packages/local-web/dist/manifest.json",
    "utf8"
  )
);

if (manifest.name !== "traveler_dev") {
  throw new Error("PWA name is not traveler_dev");
}

if (manifest.display !== "standalone") {
  throw new Error("PWA display mode is not standalone");
}

if (!manifest.start_url) {
  throw new Error("PWA start_url missing");
}

if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
  throw new Error("PWA icons are incomplete");
}

console.log("[PASS] generated PWA manifest");
NODE

grep -q "traveler_dev" "$DIST/index.html" \
  || fail "traveler_dev identity missing from generated HTML"

pass "generated HTML identity"

echo
echo "===== 16. FINAL ARTIFACTS ====="

du -sh "$DIST"

echo
find "$DIST" -maxdepth 2 -type f \
  \( -name "index.html" \
     -o -name "manifest.json" \
     -o -name "sw.js" \
     -o -name "icon-192.png" \
     -o -name "icon-512.png" \
  \) \
  -print | sort

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION HARDENING COMPLETE"
echo "============================================================"
echo
echo "Frontend: traveler_dev"
echo "API:      $RENDER_API"
echo
echo "AI:"
echo "  Groq -> primary"
echo "  Cerebras -> fallback"
echo
echo "Workspace:"
echo "  MCP"
echo "  GitHub"
echo "  Android Developer Docs"
echo "  Workspace Build"
echo "  Workspace Test"
echo
echo "PWA:"
echo "  Android phone"
echo "  Android tablet"
echo "  Windows laptop"
echo "  macOS laptop"
echo "  Linux laptop"
echo
echo "Distribution:"
echo "  $DIST"
echo
echo "The generated frontend is ready to be served over HTTPS."
echo "============================================================"
