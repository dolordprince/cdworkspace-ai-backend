#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RENDER_API="https://cdworkspace-ai-backend.onrender.com"
APP_NAME="traveler_dev"

echo
echo "============================================================"
echo " traveler_dev — FINAL PRODUCTION RELEASE"
echo "============================================================"

fail() {
  echo
  echo "[FAIL] $1"
  exit 1
}

pass() {
  echo "[PASS] $1"
}

echo
echo "===== 1. PROJECT ====="

test -f packages/local-web/package.json || fail "local-web package missing"
test -f packages/local-web/index.html || fail "Vite index.html missing"
test -f packages/local-web/vite.config.ts || fail "Vite configuration missing"

pass "CDesktop local-web workspace"

echo
echo "===== 2. PRODUCTION IDENTITY ====="

ENV_FILE="packages/local-web/.env.local"

cat > "$ENV_FILE" <<EOF
VITE_WORKSPACE_API_URL=$RENDER_API
VITE_WORKSPACE_NAME=$APP_NAME
VITE_WORKSPACE_PROJECT=$APP_NAME
NEXT_PUBLIC_WORKSPACE_API_URL=$RENDER_API
NEXT_PUBLIC_WORKSPACE_NAME=$APP_NAME
NEXT_PUBLIC_WORKSPACE_PROJECT=$APP_NAME
EOF

pass "traveler_dev identity"
pass "Render API target"

echo
echo "===== 3. PRODUCTION API HEALTH ====="

HEALTH_OK=0

for attempt in 1 2 3 4 5; do
  echo "[INFO] Render health attempt $attempt/5"

  if BODY="$(curl -4 -fsS \
      --connect-timeout 15 \
      --max-time 30 \
      "$RENDER_API/health" 2>/dev/null)"; then

    echo "$BODY" | python3 -c '
import json,sys
x=json.load(sys.stdin)

if x.get("status") != "ok":
    raise SystemExit("health status is not ok")

if x.get("primary_provider") != "groq":
    raise SystemExit("primary provider is not Groq")

if x.get("fallback_provider") != "cerebras":
    raise SystemExit("fallback provider is not Cerebras")
'

    echo "$BODY"
    HEALTH_OK=1
    pass "Render FastAPI /health"
    break
  fi

  sleep 3
done

if [ "$HEALTH_OK" -ne 1 ]; then
  fail "Render FastAPI health check failed after retries"
fi

echo
echo "===== 4. PWA MANIFEST ====="

mkdir -p packages/local-web/public

cat > packages/local-web/public/manifest.webmanifest <<'JSON'
{
  "name": "traveler_dev",
  "short_name": "traveler_dev",
  "description": "Traveler Dev AI development workspace",
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
JSON

mkdir -p packages/local-web/public/icons

if [ ! -s packages/local-web/public/icons/icon-192.png ] || \
   [ ! -s packages/local-web/public/icons/icon-512.png ]; then
  echo "[INFO] Existing PWA icons are required."
  echo "[INFO] Checking repository icon assets..."

  FOUND_ICON="$(
    find packages/local-web/public packages/local-web/src \
      -type f \
      \( -iname '*.png' -o -iname '*.webp' -o -iname '*.jpg' -o -iname '*.jpeg' \) \
      2>/dev/null |
    head -n 1
  )"

  if [ -n "$FOUND_ICON" ]; then
    cp "$FOUND_ICON" packages/local-web/public/icons/icon-192.png
    cp "$FOUND_ICON" packages/local-web/public/icons/icon-512.png
    pass "PWA icon assets installed"
  else
    fail "No production icon asset exists"
  fi
else
  pass "PWA icons already present"
fi

echo
echo "===== 5. SERVICE WORKER ====="

cat > packages/local-web/public/sw.js <<'JS'
const CACHE_NAME = "traveler-dev-shell-v1";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy))
            .catch(() => {});

        }

        return response;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => cached || caches.match("/"))
      )
  );
});
JS

pass "production service worker"

echo
echo "===== 6. PWA REGISTRATION ====="

python3 - <<'PY'
from pathlib import Path

p = Path("packages/local-web/index.html")
s = p.read_text()

manifest = '<link rel="manifest" href="/manifest.webmanifest">'
theme = '<meta name="theme-color" content="#07111f">'
apple = '<meta name="mobile-web-app-capable" content="yes">'
apple2 = '<meta name="apple-mobile-web-app-capable" content="yes">'
apple3 = '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
registration = '''
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .catch(error => console.error("Service worker registration failed:", error));
  });
}
</script>
'''

if manifest not in s:
    s = s.replace("</head>", f"  {manifest}\n</head>")

for tag in (theme, apple, apple2, apple3):
    if tag not in s:
        s = s.replace("</head>", f"  {tag}\n</head>")

if 'navigator.serviceWorker.register("/sw.js"' not in s:
    s = s.replace("</body>", f"{registration}\n</body>")

p.write_text(s)
PY

pass "PWA registration"

echo
echo "===== 7. TRAVELER DEV CONFIGURATION ====="

python3 - <<'PY'
import json
from pathlib import Path

p = Path("config/traveler-workspace.json")

if p.exists():
    data = json.loads(p.read_text())

    data.setdefault("workspace", {})
    data["workspace"]["name"] = "traveler_dev"
    data["workspace"]["project"] = "traveler_dev"

    data.setdefault("ai", {})
    data["ai"].setdefault("primary", {})
    data["ai"].setdefault("secondary", {})

    data["ai"]["primary"]["provider"] = "groq"
    data["ai"]["secondary"]["provider"] = "cerebras"

    data.setdefault("capabilities", {})
    data["capabilities"]["mcp"] = True
    data["capabilities"]["github"] = True
    data["capabilities"]["androidDeveloperDocs"] = True
    data["capabilities"]["workspaceBuild"] = True
    data["capabilities"]["workspaceTest"] = True

    data["baseUrl"] = "https://cdworkspace-ai-backend.onrender.com"

    p.write_text(json.dumps(data, indent=2) + "\n")

    print("[PASS] traveler_dev workspace configuration")
else:
    print("[INFO] config/traveler-workspace.json not present; API configuration remains authoritative")
PY

echo
echo "===== 8. TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

pass "TypeScript"

echo
echo "===== 9. PRODUCTION BUILD ====="

rm -rf packages/local-web/dist

export NODE_OPTIONS="--max-old-space-size=4096"

pnpm --filter local-web build

test -f packages/local-web/dist/index.html || fail "Production dist/index.html missing"

pass "Vite production build"

echo
echo "===== 10. PWA BUILD ARTIFACTS ====="

test -f packages/local-web/dist/manifest.webmanifest || \
  fail "manifest.webmanifest missing from production build"

test -f packages/local-web/dist/sw.js || \
  fail "sw.js missing from production build"

test -f packages/local-web/dist/icons/icon-192.png || \
  fail "192px PWA icon missing"

test -f packages/local-web/dist/icons/icon-512.png || \
  fail "512px PWA icon missing"

pass "PWA production artifacts"

echo
echo "===== 11. GIT STATUS ====="

git status --short

echo
echo "===== 12. GITHUB AUTHENTICATION ====="

if ! command -v gh >/dev/null 2>&1; then
  fail "GitHub CLI is not installed"
fi

if ! gh auth status >/dev/null 2>&1; then
  echo
  echo "[ACTION REQUIRED]"
  echo "GitHub CLI is not authenticated."
  echo
  echo "Run:"
  echo "  gh auth login"
  echo
  echo "Choose:"
  echo "  GitHub.com"
  echo "  HTTPS"
  echo "  Login with a web browser"
  echo
  exit 20
fi

pass "GitHub CLI authentication"

echo
echo "===== 13. GIT REMOTE ====="

REMOTE="$(git remote get-url origin 2>/dev/null || true)"

if [ -z "$REMOTE" ]; then
  git remote add origin \
    "https://github.com/dolordprince/traveler-dev-workspace.git"
  REMOTE="$(git remote get-url origin)"
fi

echo "origin = $REMOTE"

case "$REMOTE" in
  *traveler-dev-workspace.git*)
    pass "traveler-dev-workspace origin"
    ;;
  *)
    fail "Unexpected GitHub origin: $REMOTE"
    ;;
esac

echo
echo "===== 14. COMMIT ====="

git add .

if ! git diff --cached --quiet; then
  git commit -m "release traveler_dev production workspace"
else
  echo "[INFO] No new changes to commit"
fi

echo
echo "===== 15. PUSH ====="

git branch -M main

if git push -u origin main; then
  pass "GitHub main branch pushed"
else
  echo
  echo "[FAIL] GitHub push failed."
  echo
  echo "Run:"
  echo "  gh auth login"
  echo "  gh auth setup-git"
  echo
  echo "Then rerun:"
  echo "  ./scripts/finalize-traveler-dev-release.sh"
  exit 21
fi

echo
echo "===== 16. FINAL COMMIT ====="

git log -1 --oneline

echo
echo "============================================================"
echo " traveler_dev — RELEASE COMPLETE"
echo "============================================================"
echo
echo "Workspace:"
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
echo "Installation:"
echo "  Android phone   -> Chrome/Edge -> Install"
echo "  Android tablet  -> Chrome/Edge -> Install"
echo "  Windows         -> Chrome/Edge -> Install"
echo "  macOS           -> Chrome/Safari -> Add to Dock"
echo "  Linux           -> Chrome/Chromium -> Install"
echo
echo "PWA:"
echo "  standalone"
echo "  responsive"
echo "  HTTPS"
echo "  service worker"
echo "  installable"
echo
echo "GitHub:"
echo "  main pushed successfully"
echo
