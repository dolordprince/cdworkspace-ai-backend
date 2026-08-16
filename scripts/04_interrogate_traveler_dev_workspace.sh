#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPORT="$ROOT/TRAVELER_DEV_WORKSPACE_INTERROGATION.txt"

exec > >(tee "$REPORT") 2>&1

echo "============================================================"
echo "TRAVELER DEV DESIGN — COMPLETE WORKSPACE INTERROGATION"
echo "============================================================"
echo "ROOT: $ROOT"
echo "DATE: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo

section() {
    echo
    echo "============================================================"
    echo "$1"
    echo "============================================================"
}

section "1. REPOSITORY"

git status --short || true
echo
git branch --show-current || true
echo
git remote -v || true

section "2. COMPLETE PROJECT TREE"

find . \
    -path './.git' -prune -o \
    -path './.production-backup' -prune -o \
    -path './node_modules' -prune -o \
    -path './packages/web/node_modules' -prune -o \
    -path './__pycache__' -prune -o \
    -type f -print | sort

section "3. PYTHON BACKEND"

find backend -maxdepth 5 -type f -print 2>/dev/null | sort || true

section "4. FRONTEND"

find packages/web -maxdepth 6 -type f -print 2>/dev/null | sort || true

section "5. PYTHON DEPENDENCIES"

for f in \
    requirements.txt \
    pyproject.toml \
    backend/requirements.txt
do
    if [ -f "$f" ]; then
        echo
        echo "----- $f -----"
        cat "$f"
    fi
done

section "6. NODE DEPENDENCIES"

for f in \
    package.json \
    packages/web/package.json
do
    if [ -f "$f" ]; then
        echo
        echo "----- $f -----"
        cat "$f"
    fi
done

section "7. RENDER CONFIGURATION"

if [ -f render.yaml ]; then
    cat render.yaml
else
    echo "render.yaml NOT FOUND"
fi

section "8. ENVIRONMENT REFERENCES"

grep -RInE \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=.production-backup \
    --exclude='*.lock' \
    'OPENROUTER|ANTHROPIC|GROQ|CEREBRAS|CLOUDFLARE|CF_|MCP|RENDER|API_KEY|TOKEN|ACCOUNT_ID' \
    . 2>/dev/null || true

section "9. PROVIDERS"

find backend/app/providers -type f -maxdepth 3 -print -exec sh -c '
    echo
    echo "----- $1 -----"
    sed -n "1,260p" "$1"
' _ {} \; 2>/dev/null || true

section "10. MCP"

find backend/app/mcp -type f -maxdepth 4 -print -exec sh -c '
    echo
    echo "----- $1 -----"
    sed -n "1,320p" "$1"
' _ {} \; 2>/dev/null || true

section "11. API ROUTES"

find backend/app/api -type f -maxdepth 3 -print -exec sh -c '
    echo
    echo "----- $1 -----"
    sed -n "1,320p" "$1"
' _ {} \; 2>/dev/null || true

section "12. SERVICES"

find backend/app/services -type f -maxdepth 3 -print -exec sh -c '
    echo
    echo "----- $1 -----"
    sed -n "1,320p" "$1"
' _ {} \; 2>/dev/null || true

section "13. APPLICATION ENTRYPOINT"

find backend -maxdepth 3 -type f \
    \( -name 'main.py' -o -name 'app.py' \) \
    -print -exec sh -c '
        echo
        echo "----- $1 -----"
        sed -n "1,360p" "$1"
    ' _ {} \; 2>/dev/null || true

section "14. FRONTEND ENTRYPOINTS"

find packages/web/src -maxdepth 5 -type f \
    \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' \) \
    -print | sort | while read -r file; do
        case "$file" in
            *node_modules*) continue ;;
        esac

        echo
        echo "----- $file -----"
        sed -n '1,360p' "$file"
    done 2>/dev/null || true

section "15. PWA"

find packages/web/public -maxdepth 3 -type f -print \
    2>/dev/null | sort || true

if [ -f packages/web/public/manifest.json ]; then
    echo
    echo "----- manifest.json -----"
    cat packages/web/public/manifest.json
fi

if [ -f packages/web/public/sw.js ]; then
    echo
    echo "----- sw.js -----"
    sed -n '1,360p' packages/web/public/sw.js
fi

section "16. DEPLOYMENT IMPLEMENTATION"

grep -RInE \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=.production-backup \
    'cloudflare|pages.dev|workers.dev|deploy|publish|wrangler|API_TOKEN' \
    backend packages scripts 2>/dev/null || true

section "17. MCP TOOL EXECUTION REFERENCES"

grep -RInE \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=.production-backup \
    'tools/call|tools/list|workspace_agent_run|call_tool|execute_workspace_agent' \
    backend packages scripts 2>/dev/null || true

section "18. CLAUDE / OPENROUTER REFERENCES"

grep -RInE \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=.production-backup \
    'anthropic/claude|OpenRouterProvider|openrouter_model|openrouter_api_key' \
    backend packages scripts 2>/dev/null || true

section "19. TESTS"

find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './.production-backup' -prune -o \
    -type f \
    \( -name 'test*.py' -o -name '*test*.sh' -o -name '*spec*.ts' -o -name '*test*.ts' \) \
    -print | sort

section "20. SYNTAX VALIDATION"

if command -v python3 >/dev/null 2>&1; then
    python3 -m compileall -q backend
    echo "Python compilation: PASS"
fi

if [ -f packages/web/package.json ] && command -v npm >/dev/null 2>&1; then
    echo "Frontend package metadata: PASS"
    node -e "JSON.parse(require('fs').readFileSync('packages/web/package.json','utf8')); console.log('package.json JSON: PASS')"
fi

git diff --check
echo "Git whitespace audit: PASS"

section "21. SECURITY CHECK"

echo "Checking for accidentally committed secret values..."

grep -RInE \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=.production-backup \
    --exclude='*.lock' \
    'sk-or-v1-[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9._-]{20,}|CLOUDFLARE.*=[A-Za-z0-9_-]{20,}' \
    . 2>/dev/null || true

section "22. FINAL STATUS"

echo "Report: $REPORT"
echo
echo "The interrogation completed."
echo "No source files were modified by this script."
echo
echo "Next production phase:"
echo "  1. Repair backend contracts discovered above."
echo "  2. Integrate MCP with the actual Claude/OpenRouter agent."
echo "  3. Integrate Traveler Dev Design frontend."
echo "  4. Implement real workspace/project operations."
echo "  5. Implement real Cloudflare deployment."
echo "  6. Implement PWA installation."
echo "  7. Validate locally."
echo "  8. Validate Render deployment."
echo "  9. Push to dolordprince/cdworkspace-ai-backend."
echo
echo "============================================================"
echo "INTERROGATION COMPLETE"
echo "============================================================"
