#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker compose --env-file "$ROOT_DIR/.env" -f "$ROOT_DIR/docker-compose.yml" exec -T n8n \
  n8n import:workflow --input=/workflows/kam-whatsapp-group-intake.json

docker compose --env-file "$ROOT_DIR/.env" -f "$ROOT_DIR/docker-compose.yml" exec -T n8n \
  n8n update:workflow --id=KAMWhatsAppGroupIntake --active=true
