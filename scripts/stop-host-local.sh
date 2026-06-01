#!/usr/bin/env bash
set -euo pipefail

AGENT_DIR="$HOME/Library/LaunchAgents"

for label in com.n8nlocal.whatsapp-bridge com.n8nlocal.n8n com.n8nlocal.kam-codex-runner; do
  launchctl bootout "gui/$(id -u)" "$AGENT_DIR/$label.plist" >/dev/null 2>&1 || true
done
