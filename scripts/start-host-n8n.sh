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
export N8N_PORT="${N8N_PORT:-5678}"
export N8N_HOST="127.0.0.1"
export N8N_LISTEN_ADDRESS="127.0.0.1"
export N8N_PROTOCOL="http"
export WEBHOOK_URL="http://127.0.0.1:${N8N_PORT}/"
export GENERIC_TIMEZONE="${TZ:-Asia/Karachi}"
export N8N_DIAGNOSTICS_ENABLED="false"
export N8N_VERSION_NOTIFICATIONS_ENABLED="false"
export N8N_BLOCK_ENV_ACCESS_IN_NODE="false"
export N8N_BLOCK_RUNNER_ENV_ACCESS="false"
export CODEX_RUNNER_URL="http://127.0.0.1:${CODEX_RUNNER_PORT:-4777}/run"

mkdir -p "$ROOT_DIR/.runtime/n8n-package" "$N8N_USER_FOLDER"

if [[ ! -x "$ROOT_DIR/.runtime/n8n-package/node_modules/.bin/n8n" ]]; then
  "$NODE_BIN" "$NPM_CLI" install --prefix "$ROOT_DIR/.runtime/n8n-package" n8n@2.21.4 --no-audit --no-fund
fi

exec "$ROOT_DIR/.runtime/n8n-package/node_modules/.bin/n8n"
