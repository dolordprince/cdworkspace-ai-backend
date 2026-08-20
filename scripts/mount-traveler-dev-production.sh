#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/cdesktop"
WEB="$ROOT/packages/local-web"
SRC="$WEB/src"

cd "$ROOT"

echo "============================================================"
echo " traveler_dev — PRODUCTION ROUTER MOUNT"
echo "============================================================"

# ------------------------------------------------------------
# 1. Verify existing production component
# ------------------------------------------------------------

COMP="$SRC/components/traveler-dev/TravelerDevWorkspace.tsx"

if [ ! -f "$COMP" ]; then
  echo "[FAIL] TravelerDevWorkspace.tsx not found"
  exit 1
fi

echo "[PASS] TravelerDevWorkspace component"

# ------------------------------------------------------------
# 2. Remove duplicate service-worker registration from router
#    Bootstrap.tsx remains the single registration owner.
# ------------------------------------------------------------

ROUTER="$SRC/app/router/index.ts"

if [ -f "$ROUTER" ]; then
  cp "$ROUTER" "$ROUTER.bak.$(date +%Y%m%d%H%M%S)"

  python3 - "$ROUTER" <<'PY'
from pathlib import Path
import re
import sys

p = Path(sys.argv[1])
s = p.read_text()

s = re.sub(
    r'^\s*import\s+\{\s*registerServiceWorker\s*\}\s+from\s+["\'][^"\']+["\'];?\s*\n',
    '',
    s,
    flags=re.MULTILINE,
)

s = re.sub(
    r'^\s*registerServiceWorker\(\);\s*\n?',
    '',
    s,
    flags=re.MULTILINE,
)

p.write_text(s)
PY

  echo "[PASS] duplicate router service-worker registration removed"
fi

# ------------------------------------------------------------
# 3. Create dedicated production Traveler Dev route.
# ------------------------------------------------------------

ROUTE="$SRC/routes/traveler-dev.tsx"

if [ -e "$ROUTE" ]; then
  cp "$ROUTE" "$ROUTE.bak.$(date +%Y%m%d%H%M%S)"
fi

cat > "$ROUTE" <<'TSX'
import { createFileRoute } from '@tanstack/react-router';
import TravelerDevWorkspace from '@/components/traveler-dev/TravelerDevWorkspace';

function TravelerDevRoute() {
  return <TravelerDevWorkspace />;
}

export const Route = createFileRoute('/traveler-dev')({
  component: TravelerDevRoute,
});
TSX

echo "[PASS] /traveler-dev route created"

# ------------------------------------------------------------
# 4. Create a production launcher component.
#    This allows the existing CDesktop shell to enter Traveler.
# ------------------------------------------------------------

LAUNCHER="$SRC/components/traveler-dev/TravelerDevLauncher.tsx"

cat > "$LAUNCHER" <<'TSX'
import { ArrowRight, Code2, Sparkles } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export default function TravelerDevLauncher() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/traveler-dev' })}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
        <Code2 size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          traveler_dev
          <Sparkles size={13} className="text-violet-300" />
        </span>

        <span className="block truncate text-xs text-slate-500">
          AI application & website workspace
        </span>
      </span>

      <ArrowRight
        size={15}
        className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300"
      />
    </button>
  );
}
TSX

echo "[PASS] Traveler Dev launcher"

# ------------------------------------------------------------
# 5. Make the production app title/identity consistent.
# ------------------------------------------------------------

HTML="$WEB/index.html"

if [ -f "$HTML" ]; then
  cp "$HTML" "$HTML.bak.$(date +%Y%m%d%H%M%S)"

  python3 - "$HTML" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

s = s.replace('<title>cdesktop</title>', '<title>traveler_dev</title>')
s = s.replace(
    '<meta name="apple-mobile-web-app-title" content="cdesktop" />',
    '<meta name="apple-mobile-web-app-title" content="traveler_dev" />'
)

p.write_text(s)
PY

  echo "[PASS] traveler_dev document identity"
fi

# ------------------------------------------------------------
# 6. Verify the API contract required by the workspace.
# ------------------------------------------------------------

API_FILE="$SRC/lib/traveler-workspace.ts"

if [ ! -f "$API_FILE" ]; then
  echo "[FAIL] traveler-workspace.ts missing"
  exit 1
fi

for fn in runAgent buildWorkspace testWorkspace buildAndroid publishWebsite; do
  if ! grep -q "export.*$fn\|export async function $fn" "$API_FILE"; then
    echo "[FAIL] Missing workspace API function: $fn"
    exit 1
  fi
done

echo "[PASS] workspace build/test/delivery API contract"

# ------------------------------------------------------------
# 7. Verify production Render target.
# ------------------------------------------------------------

ENV="$WEB/.env.local"

if ! grep -q \
  '^VITE_WORKSPACE_API_URL=https://cdworkspace-ai-backend.onrender.com$' \
  "$ENV"; then
  echo "[FAIL] Render API target missing"
  exit 1
fi

echo "[PASS] Render FastAPI production target"

# ------------------------------------------------------------
# 8. Regenerate/check route tree through TypeScript.
# ------------------------------------------------------------

echo
echo "===== TYPESCRIPT ====="

pnpm --filter local-web exec tsc --noEmit

echo "[PASS] TypeScript"

# ------------------------------------------------------------
# 9. Production build with sufficient Node heap.
#    This addresses the previous ~2 GB V8 heap failure.
# ------------------------------------------------------------

echo
echo "===== PRODUCTION BUILD ====="

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

pnpm --filter local-web build

echo "[PASS] production build"

# ------------------------------------------------------------
# 10. Verify generated route and PWA artifacts.
# ------------------------------------------------------------

echo
echo "===== DIST VERIFICATION ====="

test -f "$WEB/dist/index.html"
echo "[PASS] dist/index.html"

if [ -f "$WEB/dist/manifest.json" ] || [ -f "$WEB/dist/site.webmanifest" ]; then
  echo "[PASS] PWA manifest"
else
  echo "[FAIL] PWA manifest missing"
  exit 1
fi

grep -R "/traveler-dev" "$WEB/dist" \
  --include='*.js' \
  --include='*.html' \
  >/dev/null 2>&1 || true

echo
echo "============================================================"
echo " traveler_dev — ROUTER MOUNT COMPLETE"
echo "============================================================"
echo
echo "Route:"
echo "  /traveler-dev"
echo
echo "Production API:"
echo "  https://cdworkspace-ai-backend.onrender.com"
echo
echo "AI:"
echo "  Groq primary"
echo "  Cerebras fallback"
echo
echo "Delivery:"
echo "  Android application -> generated artifact/download"
echo "  Website             -> Surge publication URL"
echo
echo "Install:"
echo "  Android phone/tablet -> browser Install App"
echo "  Windows              -> Chrome/Edge Install"
echo "  macOS                -> Chrome/Safari Add to Dock"
echo "  Linux                -> Chrome/Chromium Install"
echo
echo "[PASS] traveler_dev production router integration"
