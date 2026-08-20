#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/packages/local-web"
SRC="$WEB/src"
PUBLIC="$WEB/public"
ENV="$WEB/.env.local"

RENDER_API="https://cdworkspace-ai-backend.onrender.com"
APP_NAME="traveler_dev"

cd "$ROOT"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION PWA FINALIZATION"
echo "============================================================"
echo

if [ ! -d "$WEB" ]; then
  echo "[FAIL] packages/local-web does not exist"
  exit 1
fi

mkdir -p "$PUBLIC" "$SRC/styles"

echo "===== 1. PRODUCTION ENVIRONMENT ====="

cat > "$ENV" <<EOF
VITE_WORKSPACE_API_URL=$RENDER_API
VITE_WORKSPACE_NAME=$APP_NAME
VITE_WORKSPACE_PROJECT=$APP_NAME
NEXT_PUBLIC_WORKSPACE_API_URL=$RENDER_API
NEXT_PUBLIC_WORKSPACE_NAME=$APP_NAME
NEXT_PUBLIC_WORKSPACE_PROJECT=$APP_NAME
EOF

echo "[PASS] Render API configured"
echo

echo "===== 2. PWA MANIFEST ====="

cat > "$PUBLIC/manifest.webmanifest" <<'EOF'
{
  "name": "traveler_dev",
  "short_name": "traveler_dev",
  "description": "Production AI developer workspace powered by Traveler Dev.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#070b14",
  "theme_color": "#0b1220",
  "prefer_related_applications": false,
  "categories": [
    "development",
    "productivity",
    "utilities"
  ],
  "icons": [
    {
      "src": "/icons/traveler-dev-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/traveler-dev-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
EOF

mkdir -p "$PUBLIC/icons"

echo "[PASS] manifest.webmanifest"

echo
echo "===== 3. PWA ICONS ====="

python3 - <<'PY'
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path("packages/local-web/public/icons")
out.mkdir(parents=True, exist_ok=True)

def create_icon(size, filename):
    img = Image.new("RGBA", (size, size), (7, 11, 20, 255))
    draw = ImageDraw.Draw(img)

    # Glass panel
    margin = size * 0.10
    draw.rounded_rectangle(
        (
            margin,
            margin,
            size - margin,
            size - margin,
        ),
        radius=int(size * 0.22),
        fill=(18, 28, 48, 255),
        outline=(116, 150, 255, 180),
        width=max(2, size // 80),
    )

    # Traveler "T"
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            int(size * 0.48),
        )
    except Exception:
        font = ImageFont.load_default()

    text = "T"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    draw.text(
        (
            (size - tw) / 2,
            (size - th) / 2 - size * 0.03,
        ),
        text,
        font=font,
        fill=(235, 242, 255, 255),
    )

    img.save(out / filename, "PNG", optimize=True)

create_icon(192, "traveler-dev-192.png")
create_icon(512, "traveler-dev-512.png")
PY

echo "[PASS] 192x192 icon"
echo "[PASS] 512x512 icon"

echo
echo "===== 4. INDEX.HTML PWA HEAD ====="

INDEX="$WEB/index.html"

if [ ! -f "$INDEX" ]; then
  echo "[FAIL] $INDEX not found"
  exit 1
fi

python3 - "$INDEX" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

if 'rel="manifest"' not in s:
    marker = "<head>"
    if marker not in s:
        raise SystemExit("Could not locate <head> in index.html")

    injection = """<head>
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="theme-color" content="#0b1220">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="traveler_dev">
"""
    s = s.replace(marker, injection, 1)

if 'traveler-dev-192.png' not in s:
    s = s.replace(
        "</head>",
        '    <link rel="apple-touch-icon" href="/icons/traveler-dev-192.png">\n'
        "</head>",
        1,
    )

p.write_text(s)
PY

echo "[PASS] manifest linked"
echo "[PASS] mobile installation metadata linked"

echo
echo "===== 5. PRODUCTION SERVICE WORKER ====="

cat > "$PUBLIC/sw.js" <<'EOF'
const CACHE_NAME = "traveler-dev-shell-v1";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/traveler-dev-192.png",
  "/icons/traveler-dev-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
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

          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});

        }

        return response;
      })
      .catch(() =>
        caches.match(request)
          .then((cached) => cached || caches.match("/"))
      )
  );
});
EOF

echo "[PASS] production service worker"

echo
echo "===== 6. SERVICE WORKER REGISTRATION ====="

cat > "$SRC/register-service-worker.ts" <<'EOF'
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
      })
      .catch((error) => {
        console.error(
          "[traveler_dev] Service worker registration failed:",
          error,
        );
      });
  });
}
EOF

echo "[PASS] service worker registration module"

echo
echo "===== 7. LOCATE APPLICATION ENTRY ====="

ENTRY=""

for candidate in \
  "$SRC/main.tsx" \
  "$SRC/main.ts" \
  "$SRC/main.jsx" \
  "$SRC/main.js" \
  "$SRC/index.tsx" \
  "$SRC/index.ts" \
  "$SRC/index.jsx" \
  "$SRC/index.js"
do
  if [ -f "$candidate" ]; then
    ENTRY="$candidate"
    break
  fi
done

if [ -z "$ENTRY" ]; then
  ENTRY="$(find "$SRC" -type f \
    \( -name '*.tsx' -o -name '*.ts' \) \
    -print0 | xargs -0 grep -Il \
    'createRoot\|ReactDOM\|RouterProvider' 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$ENTRY" ]; then
  echo "[FAIL] Could not locate React application entry"
  echo
  echo "Existing application entry candidates:"
  find "$SRC" -maxdepth 4 -type f \
    \( -name '*.tsx' -o -name '*.ts' \) \
    | head -100
  exit 1
fi

echo "[PASS] Application entry: ${ENTRY#$ROOT/}"

echo
echo "===== 8. REGISTER SERVICE WORKER IN APPLICATION ====="

python3 - "$ENTRY" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

import_line = 'import { registerServiceWorker } from "./register-service-worker";\n'

if "register-service-worker" not in s:
    lines = s.splitlines(True)

    index = 0
    while index < len(lines) and (
        lines[index].startswith("import ") or
        lines[index].strip() == ""
    ):
        index += 1

    lines.insert(index, import_line)
    s = "".join(lines)

if "registerServiceWorker();" not in s:
    s += '\nregisterServiceWorker();\n'

p.write_text(s)
PY

echo "[PASS] service worker registration wired"

echo
echo "===== 9. GLASS WORKSPACE UI ====="

cat > "$SRC/styles/traveler-dev-glass.css" <<'EOF'
:root {
  --traveler-bg: #070b14;
  --traveler-surface: rgba(17, 25, 40, 0.72);
  --traveler-surface-strong: rgba(22, 32, 52, 0.84);
  --traveler-border: rgba(255, 255, 255, 0.10);
  --traveler-border-strong: rgba(255, 255, 255, 0.16);
  --traveler-text: #eef4ff;
  --traveler-muted: #94a3b8;
  --traveler-accent: #8b9cff;
  --traveler-accent-strong: #6478ff;
  --traveler-radius: 18px;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background:
    radial-gradient(
      circle at 12% 8%,
      rgba(99, 102, 241, 0.16),
      transparent 30%
    ),
    radial-gradient(
      circle at 88% 15%,
      rgba(56, 189, 248, 0.10),
      transparent 28%
    ),
    radial-gradient(
      circle at 55% 100%,
      rgba(139, 92, 246, 0.12),
      transparent 34%
    ),
    var(--traveler-bg);
  color: var(--traveler-text);
}

#root {
  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.018),
      transparent 20%
    );
}

.glass,
.glass-panel,
.workspace-panel,
.workspace-sidebar,
.workspace-toolbar,
.workspace-card,
.workspace-modal {
  background: var(--traveler-surface);
  border: 1px solid var(--traveler-border);
  border-radius: var(--traveler-radius);
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255,255,255,0.055);
  backdrop-filter: blur(22px) saturate(135%);
  -webkit-backdrop-filter: blur(22px) saturate(135%);
}

.glass-strong {
  background: var(--traveler-surface-strong);
  border: 1px solid var(--traveler-border-strong);
  box-shadow:
    0 20px 70px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255,255,255,0.07);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background 140ms ease,
    box-shadow 140ms ease;
}

button:hover {
  border-color: var(--traveler-border-strong);
}

button:active {
  transform: translateY(1px);
}

input,
textarea,
select {
  background: rgba(5, 10, 20, 0.48);
  border: 1px solid var(--traveler-border);
  color: var(--traveler-text);
  border-radius: 12px;
  outline: none;
}

input:focus,
textarea:focus,
select:focus {
  border-color: rgba(139, 156, 255, 0.55);
  box-shadow: 0 0 0 3px rgba(100, 120, 255, 0.10);
}

@media (max-width: 900px) {
  .workspace-sidebar {
    border-radius: 14px;
  }

  .workspace-panel,
  .workspace-card {
    border-radius: 14px;
  }
}

@media (max-width: 640px) {
  body {
    background:
      radial-gradient(
        circle at 50% 0%,
        rgba(99, 102, 241, 0.16),
        transparent 36%
      ),
      var(--traveler-bg);
  }

  .glass,
  .glass-panel,
  .workspace-panel,
  .workspace-sidebar,
  .workspace-toolbar,
  .workspace-card,
  .workspace-modal {
    backdrop-filter: blur(18px) saturate(130%);
    -webkit-backdrop-filter: blur(18px) saturate(130%);
  }
}
EOF

echo "[PASS] traveler_dev glass UI stylesheet"

echo
echo "===== 10. LOAD GLASS UI STYLES ====="

CSS_IMPORT_FOUND=""

CSS_IMPORT_FOUND="$(
  grep -RIl \
    --include='*.tsx' \
    --include='*.ts' \
    --include='*.jsx' \
    --include='*.js' \
    'global.css\|globals.css\|index.css' \
    "$SRC" 2>/dev/null | head -n 1 || true
)"

if [ -n "$CSS_IMPORT_FOUND" ]; then
  python3 - "$CSS_IMPORT_FOUND" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

line = 'import "./styles/traveler-dev-glass.css";\n'

if "traveler-dev-glass.css" not in s:
    s = line + s

p.write_text(s)
PY

  echo "[PASS] Glass UI stylesheet loaded through ${CSS_IMPORT_FOUND#$ROOT/}"
else
  python3 - "$ENTRY" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

line = 'import "./styles/traveler-dev-glass.css";\n'

if "traveler-dev-glass.css" not in s:
    s = line + s

p.write_text(s)
PY

  echo "[PASS] Glass UI stylesheet loaded through application entry"
fi

echo
echo "===== 11. TRAVELER DEV API CLIENT CONTRACT ====="

API_CLIENT="$SRC/lib/workspace-api.ts"

if [ ! -f "$API_CLIENT" ]; then
  echo "[FAIL] Missing workspace API client: $API_CLIENT"
  exit 1
fi

grep -q "VITE_WORKSPACE_API_URL" "$API_CLIENT" || {
  echo "[FAIL] API client does not use VITE_WORKSPACE_API_URL"
  exit 1
}

grep -q "/api/workspace/build" "$API_CLIENT" || {
  echo "[FAIL] workspace build endpoint missing"
  exit 1
}

grep -q "/api/workspace/test" "$API_CLIENT" || {
  echo "[FAIL] workspace test endpoint missing"
  exit 1
}

grep -q "/api/android/docs/search" "$API_CLIENT" || {
  echo "[FAIL] Android developer docs endpoint missing"
  exit 1
}

echo "[PASS] production workspace API client"

echo
echo "===== 12. BUILD ====="

rm -rf "$WEB/dist"

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

pnpm --filter local-web exec tsc --noEmit

echo "[PASS] TypeScript validation"

pnpm --filter local-web build

echo "[PASS] Vite production build"

echo
echo "===== 13. PRODUCTION PWA ARTIFACTS ====="

test -f "$WEB/dist/index.html" || {
  echo "[FAIL] dist/index.html missing"
  exit 1
}

test -f "$WEB/dist/manifest.webmanifest" || {
  echo "[FAIL] dist/manifest.webmanifest missing"
  exit 1
}

test -f "$WEB/dist/sw.js" || {
  echo "[FAIL] dist/sw.js missing"
  exit 1
}

test -f "$WEB/dist/icons/traveler-dev-192.png" || {
  echo "[FAIL] 192px PWA icon missing"
  exit 1
}

test -f "$WEB/dist/icons/traveler-dev-512.png" || {
  echo "[FAIL] 512px PWA icon missing"
  exit 1
}

grep -q 'manifest.webmanifest' "$WEB/dist/index.html" || {
  echo "[FAIL] Production index does not reference manifest.webmanifest"
  exit 1
}

grep -q '/sw.js' "$WEB/dist/index.html" || {
  echo "[WARN] Service worker registration is bundled rather than directly referenced"
}

echo "[PASS] manifest.webmanifest"
echo "[PASS] service worker"
echo "[PASS] PWA icons"
echo "[PASS] production index"

echo
echo "===== 14. MANIFEST VALIDATION ====="

node - "$WEB/dist/manifest.webmanifest" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));

const required = [
  "name",
  "short_name",
  "start_url",
  "scope",
  "display",
  "icons"
];

for (const key of required) {
  if (!(key in manifest)) {
    throw new Error(`Missing manifest field: ${key}`);
  }
}

if (manifest.name !== "traveler_dev") {
  throw new Error("Manifest name is not traveler_dev");
}

if (manifest.display !== "standalone") {
  throw new Error("PWA display mode is not standalone");
}

if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
  throw new Error("PWA icon configuration is incomplete");
}

console.log("[PASS] manifest schema");
console.log("[PASS] traveler_dev identity");
console.log("[PASS] standalone installation mode");
NODE

echo
echo "===== 15. API TARGET VALIDATION ====="

grep -q "$RENDER_API" "$ENV" || {
  echo "[FAIL] Render API missing from environment"
  exit 1
}

echo "[PASS] $RENDER_API"

echo
echo "============================================================"
echo " traveler_dev — PRODUCTION CONFIGURATION COMPLETE"
echo "============================================================"
echo
echo "Application:"
echo "  traveler_dev"
echo
echo "Backend:"
echo "  $RENDER_API"
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
echo "  standalone"
echo "  responsive"
echo "  HTTPS API"
echo "  offline application shell"
echo "  installable on Android"
echo "  installable on Windows"
echo "  installable on macOS"
echo "  installable on Linux"
echo
echo "Production artifact:"
echo "  $WEB/dist"
echo
echo "============================================================"
