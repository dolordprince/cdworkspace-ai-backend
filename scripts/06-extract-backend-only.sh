#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(pwd)"
OUT="$ROOT/.workspace-interrogation/fastapi-migration"

rm -rf "$OUT"
mkdir -p "$OUT"

echo "===== BOLT.DIY BACKEND EXTRACTION ====="

echo "[1/6] Locating package manifests..."
find . \
  -path './node_modules' -prune \
  -o -path './.git' -prune \
  -o -path './dist' -prune \
  -o -path './build' -prune \
  -o -name 'package.json' -print \
  > "$OUT/package-manifests.txt"

echo "[2/6] Locating server/backend packages..."
find . \
  -path './node_modules' -prune \
  -o -path './.git' -prune \
  -o -path './dist' -prune \
  -o -path './build' -prune \
  -o -type d \( \
    -iname '*server*' \
    -o -iname '*backend*' \
    -o -iname '*api*' \
  \) -print \
  > "$OUT/server-directories.txt"

echo "[3/6] Locating server entry points..."
grep -RIlE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude-dir=build \
  --include='*.ts' \
  --include='*.tsx' \
  --include='*.js' \
  --include='*.mjs' \
  --include='*.cjs' \
  'express\(|createServer|WebSocketServer|app\.listen|server\.listen|router\.(get|post|put|patch|delete)' \
  . 2>/dev/null \
  | sort -u \
  > "$OUT/server-files.txt"

echo "[4/6] Extracting API route references..."
grep -RhoE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude-dir=build \
  --include='*.ts' \
  --include='*.tsx' \
  --include='*.js' \
  --include='*.mjs' \
  --include='*.cjs' \
  '(/api/[A-Za-z0-9_./:${}?=&-]+)' \
  . 2>/dev/null \
  | sed 's/[`"'\'',;)]//g' \
  | sort -u \
  > "$OUT/api-routes.txt"

echo "[5/6] Extracting backend dependencies..."
for manifest in $(cat "$OUT/package-manifests.txt"); do
    echo
    echo "===== $manifest ====="
    cat "$manifest"
done > "$OUT/package-manifests-expanded.txt"

echo "[6/6] Extracting backend source..."
while IFS= read -r file; do
    [ -f "$file" ] || continue

    rel="${file#./}"
    safe="${rel//\//__}"

    {
        echo
        echo "============================================================"
        echo "SOURCE: $rel"
        echo "============================================================"
        cat "$file"
    } > "$OUT/$safe"
done < "$OUT/server-files.txt"

echo
echo "============================================================"
echo "EXTRACTION COMPLETE"
echo "============================================================"

echo "Server files:"
wc -l "$OUT/server-files.txt" | awk '{print $1}'

echo "API references:"
wc -l "$OUT/api-routes.txt" | awk '{print $1}'

echo
echo "Output:"
echo "$OUT"

echo
echo "Important files:"
echo "  $OUT/server-files.txt"
echo "  $OUT/api-routes.txt"
echo "  $OUT/package-manifests-expanded.txt"
