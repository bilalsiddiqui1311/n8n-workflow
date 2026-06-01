#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"
set -a
source "$ROOT_DIR/.env"
set +a

PID_FILE="$LOG_DIR/codex-runner.pid"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1; then
  echo "Codex runner already appears to be running."
else
  nohup "$ROOT_DIR/scripts/start-codex-runner.sh" >"$LOG_DIR/codex-runner.log" 2>&1 &
  echo "$!" >"$PID_FILE"
  echo "Started Codex runner. Log: $LOG_DIR/codex-runner.log"
fi

docker compose --env-file "$ROOT_DIR/.env" -f "$ROOT_DIR/docker-compose.yml" up -d --build

echo "n8n: http://localhost:${N8N_PORT:-5678}"
echo "WhatsApp QR: http://localhost:${WHATSAPP_BRIDGE_PORT:-3001}/qr"
