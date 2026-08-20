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
