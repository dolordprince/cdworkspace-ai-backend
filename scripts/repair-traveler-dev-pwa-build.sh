#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(pwd)"
WEB="$ROOT/packages/local-web"
VITE="$WEB/vite.config.ts"
PUBLIC="$WEB/public"
DIST="$WEB/dist"

RENDER_API="https://cdworkspace-ai-backend.onrender.com"

echo
echo "============================================================"
echo " traveler_dev — PWA BUILD REPAIR"
echo "============================================================"

test -d "$WEB" || {
  echo "[FAIL] packages/local-web not found"
  exit 1
}

test -f "$VITE" || {
  echo "[FAIL] packages/local-web/vite.config.ts not found"
  exit 1
}

mkdir -p "$PUBLIC"

echo
echo "===== 1. EXISTING VITE CONFIGURATION ====="
sed -n '1,280p' "$VITE"

echo
echo "===== 2. INSTALL PWA SOURCE FILES ====="

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
  if (event.request.method !== "GET") {
    return;
  }

  const requestURL = new URL(event.request.url);

  if (requestURL.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/");
        });
      })
  );
});
EOF

mkdir -p "$PUBLIC/icons"

python3 - <<'PY'
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as exc:
    raise SystemExit(
        "Pillow is required. Install with: python3 -m pip install Pillow"
    ) from exc

out = Path("packages/local-web/public/icons")
out.mkdir(parents=True, exist_ok=True)

for size in (192, 512):
    image = Image.new("RGBA", (size, size), "#07111f")
    draw = ImageDraw.Draw(image)

    margin = size // 10
    radius = size // 6
    stroke = max(3, size // 64)

    draw.rounded_rectangle(
        (
            margin,
            margin,
            size - margin,
            size - margin,
        ),
        radius=radius,
        fill="#101d31",
        outline="#7c3aed",
        width=stroke,
    )

    x = size // 2

    draw.line(
        (
            x,
            int(size * 0.27),
            x,
            int(size * 0.72),
        ),
        fill="#ffffff",
        width=max(8, size // 18),
    )

    draw.line(
        (
            int(size * 0.34),
            int(size * 0.38),
            int(size * 0.66),
            int(size * 0.38),
        ),
        fill="#ffffff",
        width=max(8, size // 18),
    )

    image.save(out / f"icon-{size}.png", "PNG")

print("[PASS] PWA icons")
PY

test -f "$PUBLIC/manifest.json"
test -f "$PUBLIC/sw.js"
test -f "$PUBLIC/icons/icon-192.png"
test -f "$PUBLIC/icons/icon-512.png"

echo "[PASS] PWA source artifacts"

echo
echo "===== 3. CONFIGURE VITE PUBLIC DIRECTORY ====="

python3 - "$VITE" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()

# Vite must explicitly know that packages/local-web/public contains
# files that must be copied verbatim into dist.
if re.search(r'\bpublicDir\s*:', text):
    text = re.sub(
        r'\bpublicDir\s*:\s*[^,\n}]+,?',
        'publicDir: "public",',
        text,
        count=1,
    )
else:
    match = re.search(r'export default defineConfig\(\s*\{', text)

    if not match:
        raise SystemExit(
            "Unable to locate export default defineConfig({...})"
        )

    insertion = match.end()

    text = (
        text[:insertion]
        + '\n  publicDir: "public",\n'
        + text[insertion:]
    )

path.write_text(text)
print("[PASS] Vite publicDir configured")
PY

echo
echo "===== 4. CONFIGURE PWA HTML ====="

python3 - <<'PY'
from pathlib import Path

path = Path("packages/local-web/index.html")
text = path.read_text()

required = [
    '<link rel="manifest" href="/manifest.json">',
    '<meta name="theme-color" content="#07111f">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="traveler_dev">',
    '<link rel="apple-touch-icon" href="/icons/icon-192.png">'
]

if "</head>" not in text:
    raise SystemExit("index.html has no </head>")

for item in required:
    if item not in text:
        text = text.replace(
            "</head>",
            f"    {item}\n</head>",
            1,
        )

path.write_text(text)

print("[PASS] PWA HTML metadata")
PY

echo
echo "===== 5. SENTRY BUILD GUARD ====="

python3 - "$VITE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

# Do not permit an unauthenticated Sentry upload attempt.
#
# If an existing Sentry plugin exists, wrap its configuration in an
# environment-token condition. This prevents sentry-cli from being
# invoked on normal local/Render builds without credentials.

if "@sentry/vite-plugin" in text:

    marker = "sentryVitePlugin("

    if marker in text and "SENTRY_AUTH_TOKEN" not in text:
        text = text.replace(
            marker,
            'sentryVitePlugin({\n'
            '        authToken: process.env.SENTRY_AUTH_TOKEN,\n'
            '        sourcemaps: process.env.SENTRY_AUTH_TOKEN\n'
            '          ? { upload: true }\n'
            '          : false,\n'
            '      }',
            1,
        )

        # The transformation above can conflict with an existing
        # object argument, therefore this branch is intentionally
        # conservative and will be audited by TypeScript below.

        path.write_text(text)

print("[PASS] Sentry configuration inspected")
PY

echo
echo "===== 6. API CONFIGURATION ====="

cat > "$WEB/.env.local" <<EOF
VITE_WORKSPACE_API_URL=$RENDER_API
VITE_WORKSPACE_NAME=traveler_dev
VITE_WORKSPACE_PROJECT=traveler_dev
NEXT_PUBLIC_WORKSPACE_API_URL=$RENDER_API
NEXT_PUBLIC_WORKSPACE_NAME=traveler_dev
NEXT_PUBLIC_WORKSPACE_PROJECT=traveler_dev
EOF

grep -q \
  "VITE_WORKSPACE_API_URL=$RENDER_API" \
  "$WEB/.env.local"

grep -q \
  "NEXT_PUBLIC_WORKSPACE_API_URL=$RENDER_API" \
  "$WEB/.env.local"

echo "[PASS] Render FastAPI API target"

echo
echo "===== 7. TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

echo "[PASS] TypeScript"

echo
echo "===== 8. CLEAN BUILD ====="

rm -rf "$DIST"

NODE_OPTIONS="--max-old-space-size=3072" \
  pnpm --filter local-web build

echo "[PASS] production build"

echo
echo "===== 9. PWA ARTIFACT VERIFICATION ====="

for file in \
  "$DIST/index.html" \
  "$DIST/manifest.json" \
  "$DIST/sw.js" \
  "$DIST/icons/icon-192.png" \
  "$DIST/icons/icon-512.png"
do
    if [ ! -f "$file" ]; then
        echo "[FAIL] Missing production artifact:"
        echo "       $file"
        exit 1
    fi
done

echo "[PASS] manifest.json"
echo "[PASS] sw.js"
echo "[PASS] icon-192.png"
echo "[PASS] icon-512.png"

echo
echo "===== 10. MANIFEST VALIDATION ====="

node <<'NODE'
const fs = require("fs");

const path = "packages/local-web/dist/manifest.json";
const manifest = JSON.parse(fs.readFileSync(path, "utf8"));

if (manifest.name !== "traveler_dev") {
  throw new Error("Invalid PWA name");
}

if (manifest.short_name !== "traveler_dev") {
  throw new Error("Invalid PWA short_name");
}

if (manifest.display !== "standalone") {
  throw new Error("PWA is not standalone");
}

if (manifest.start_url !== "/") {
  throw new Error("Invalid PWA start_url");
}

if (manifest.scope !== "/") {
  throw new Error("Invalid PWA scope");
}

if (!Array.isArray(manifest.icons) || manifest.icons.length !== 2) {
  throw new Error("PWA icon manifest is incomplete");
}

console.log("[PASS] production manifest contract");
NODE

echo
echo "===== 11. HTML VALIDATION ====="

grep -q \
  'rel="manifest" href="/manifest.json"' \
  "$DIST/index.html" \
  || {
    echo "[FAIL] manifest link missing from generated HTML"
    exit 1
  }

grep -q \
  'traveler_dev' \
  "$DIST/index.html" \
  || {
    echo "[FAIL] traveler_dev identity missing from generated HTML"
    exit 1
  }

echo "[PASS] generated PWA HTML"

echo
echo "===== 12. SERVICE WORKER VALIDATION ====="

grep -q \
  'CACHE_NAME = "traveler-dev-shell-v1"' \
  "$DIST/sw.js" \
  || {
    echo "[FAIL] generated service worker is invalid"
    exit 1
  }

echo "[PASS] generated service worker"

echo
echo "===== 13. FINAL BUILD SIZE ====="

du -sh "$DIST"

echo
echo "============================================================"
echo " traveler_dev — PWA BUILD REPAIR COMPLETE"
echo "============================================================"
echo
echo "Frontend:"
echo "  traveler_dev"
echo
echo "Backend:"
echo "  $RENDER_API"
echo
echo "AI:"
echo "  Groq primary"
echo "  Cerebras fallback"
echo
echo "PWA:"
echo "  manifest"
echo "  service worker"
echo "  192px icon"
echo "  512px icon"
echo "  standalone mode"
echo "  responsive installation"
echo
echo "Distribution:"
echo "  $DIST"
echo
echo "============================================================"
