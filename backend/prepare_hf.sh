#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "===== 1. CLEAN PYTHON CACHE ====="
find app -type d -name "__pycache__" -prune -exec rm -rf {} +
find app -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete

echo "===== 2. PRODUCTION CONFIG ====="

python - <<'PY'
from pathlib import Path

p = Path("app/config.py")
s = p.read_text()

s = s.replace(
    'cors_origins: str = "*"',
    'cors_origins: str = "https://huggingface.co"'
)

p.write_text(s)
PY

echo "===== 3. PRODUCTION DOCKERFILE ====="

cat > Dockerfile <<'DOCKER'
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
DOCKER

echo "===== 4. HUGGING FACE README ====="

cat > README.md <<'MD'
---
title: Traveler Dev Backend
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# Traveler Dev Backend

Production FastAPI backend for Traveler Dev Studio.

## Runtime secrets

Configure these as Hugging Face Space Secrets:

- `OPENROUTER_API_KEY`
- `GITHUB_TOKEN`

Optional:

- `OPENROUTER_MODEL`
- `OPENROUTER_BASE_URL`
- `CORS_ORIGINS`

Secrets are never stored in this repository.

## API

- `/api/health`
- `/api/agent/run`
- `/api/android/docs/search`
- `/api/github/search`

Interactive API documentation:

`/docs`
MD

echo "===== 5. PYTHON SOURCE COMPILE ====="

python -m compileall -q app
echo "Python syntax: PASS"

echo "===== 6. SECURITY SCAN ====="

if grep -RInE \
  'ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|sk-or-v1-[A-Za-z0-9]+|OPENROUTER_API_KEY=[A-Za-z0-9]' \
  app \
  --exclude-dir=__pycache__ 2>/dev/null; then
    echo "SECURITY FAILURE: credential-like value detected"
    exit 1
fi

echo "Credential scan: PASS"

echo "===== 7. REQUIRED FILES ====="

required=(
  "app/main.py"
  "app/config.py"
  "app/routes/ai.py"
  "app/routes/android.py"
  "app/routes/github.py"
  "app/routes/health.py"
  "app/services/android_docs.py"
  "app/services/github.py"
  "app/services/openrouter.py"
  "requirements.txt"
  "Dockerfile"
  "README.md"
)

for f in "${required[@]}"; do
    test -f "$f" || {
        echo "MISSING: $f"
        exit 1
    }
    echo "PASS: $f"
done

echo
echo "============================================================"
echo "TRAVELER DEV FASTAPI BACKEND READY FOR HF"
echo "============================================================"
