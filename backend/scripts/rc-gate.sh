#!/usr/bin/env bash
set -euo pipefail
node scripts/test-todo-gate.mjs

bash scripts/dev-smoke.sh

echo "== Start API for HTTP smoke =="
pnpm --filter @ucell/api start:prod > /tmp/ucell-api.log 2>&1 &
PID=$!
trap 'kill $PID || true' EXIT

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null; then
    break
  fi
  sleep 1
done

node scripts/http-smoke.mjs
echo "RC_GATE_PASS"
