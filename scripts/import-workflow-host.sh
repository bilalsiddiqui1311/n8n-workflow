#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$ROOT_DIR/.env"
set +a
NODE_BIN="${LOCAL_NODE_BIN:-node}"
NPM_CLI="${LOCAL_NPM_CLI:-/usr/local/lib/node_modules/npm/bin/npm-cli.js}"
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:$PATH"

export N8N_USER_FOLDER="${N8N_USER_FOLDER:-$ROOT_DIR/.runtime/n8n-user}"
export GENERIC_TIMEZONE="${TZ:-Asia/Karachi}"
export N8N_DIAGNOSTICS_ENABLED="false"
export N8N_VERSION_NOTIFICATIONS_ENABLED="false"
export N8N_BLOCK_ENV_ACCESS_IN_NODE="false"
export N8N_BLOCK_RUNNER_ENV_ACCESS="false"
export CODEX_RUNNER_URL="http://127.0.0.1:${CODEX_RUNNER_PORT:-4777}/run"
export PROPERTY_CONTACTS_FILE="${PROPERTY_CONTACTS_FILE:-$ROOT_DIR/property-dealer/contacts.xlsx}"
export PROPERTY_WHATSAPP_SEND_URL="${PROPERTY_WHATSAPP_SEND_URL:-http://127.0.0.1:${WHATSAPP_BRIDGE_PORT:-3001}/send}"
export PROPERTY_WHATSAPP_SEND_TOKEN="${PROPERTY_WHATSAPP_SEND_TOKEN:-${WHATSAPP_SEND_TOKEN:-${KAM_INTAKE_SECRET:-}}}"

N8N_BIN="$ROOT_DIR/.runtime/n8n-package/node_modules/.bin/n8n"
if [[ ! -x "$N8N_BIN" ]]; then
  "$NODE_BIN" "$NPM_CLI" install --prefix "$ROOT_DIR/.runtime/n8n-package" n8n@2.21.4 --no-audit --no-fund
fi

"$N8N_BIN" import:workflow --input="$ROOT_DIR/n8n/workflows/kam-whatsapp-group-intake.json"
"$N8N_BIN" update:workflow --id=KAMWhatsAppGroupIntake --active=true
