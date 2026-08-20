#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

echo "============================================================"
echo "CDESTKTOP FASTAPI BACKEND"
echo "============================================================"

if [ ! -x ".venv/bin/python" ]; then
    echo "[FAIL] backend virtual environment missing"
    exit 1
fi

if [ ! -f "app/main.py" ]; then
    echo "[FAIL] app/main.py not found"
    exit 1
fi

echo "[1/6] Python"
.venv/bin/python --version

echo "[2/6] Compiling backend"
.venv/bin/python -m compileall -q app

echo "[3/6] Checking existing port 8000"
if ss -ltnp 2>/dev/null | grep -q ':8000 '; then
    echo "[INFO] Port 8000 already has a listener"
    ss -ltnp 2>/dev/null | grep ':8000 ' || true
else
    echo "[INFO] Port 8000 is free"
fi

echo "[4/6] Starting FastAPI"
exec .venv/bin/python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips='*'
