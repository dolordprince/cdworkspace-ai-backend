#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p .workspace-interrogation/cdesktop-main

cat > .workspace-interrogation/cdesktop-main/CANONICAL_WORKSPACE.md <<'DOC'
# cdesktop — Canonical Main Workspace

This repository is the canonical main workspace.

Architecture policy:

1. Preserve the existing cdesktop workspace architecture.
2. Preserve all existing cdesktop tools.
3. Preserve all existing MCP integrations.
4. Preserve all existing agent/tool dispatch.
5. Preserve the existing project/file workspace system.
6. Preserve existing frontend behavior unless explicitly changed.
7. Preserve existing backend behavior unless explicitly changed.
8. Do not replace cdesktop with Traveler Dev.
9. Do not copy Traveler Dev architecture into cdesktop.
10. Do not remove tools merely to resolve provider configuration.
11. Branding/name changes must not destroy functionality.
12. Provider changes must integrate with the existing cdesktop architecture.
13. No mock providers.
14. No simulated tools.
15. No placeholder implementations.
16. No demo implementations.
17. No duplicate agent architecture unless required by the existing cdesktop design.
18. cdesktop is the source of truth for future workspace modifications.
DOC

echo "[PASS] cdesktop is declared the canonical workspace."
