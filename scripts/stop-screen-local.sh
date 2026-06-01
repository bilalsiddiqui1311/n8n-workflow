#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$ROOT_DIR/.env"
set +a

for name in kam-whatsapp-bridge kam-n8n kam-codex-runner; do
  screen -S "$name" -X quit >/dev/null 2>&1 || true
done

for port in "${WHATSAPP_BRIDGE_PORT:-3001}" "${N8N_PORT:-5678}" "${CODEX_RUNNER_PORT:-4777}"; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids >/dev/null 2>&1 || true
  fi
done
