#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$ROOT_DIR/.env"
set +a

curl -sS -X POST "http://localhost:${N8N_PORT:-5678}/webhook/whatsapp-group-intake" \
  -H "content-type: application/json" \
  -H "x-kam-intake-secret: ${KAM_INTAKE_SECRET}" \
  -d @- <<'JSON'
{
  "source": "smoke-test",
  "receivedAt": "2026-05-19T00:00:00.000Z",
  "group": {
    "id": "local-smoke-test@g.us",
    "name": "KAM Test Group"
  },
  "sender": {
    "id": "923001234567@c.us",
    "name": "Test Sender",
    "number": "923001234567"
  },
  "message": {
    "id": "local-smoke-test-message",
    "timestamp": 1779148800,
    "type": "chat",
    "text": "Client asked whether we can send renewal pricing today and flagged a blocker with onboarding.",
    "rawText": "#kam Client asked whether we can send renewal pricing today and flagged a blocker with onboarding.",
    "hasMedia": false
  }
}
JSON
