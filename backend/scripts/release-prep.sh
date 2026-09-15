#!/usr/bin/env bash
set -euo pipefail

echo "== UCell R6 Release Preparation =="
bash scripts/ci-gate.sh

if [[ ! -f pnpm-lock.yaml ]]; then
  echo "RELEASE_PREP_BLOCKED: pnpm-lock.yaml missing; resolve/review dependencies in connected DEV first"
  exit 4
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "RELEASE_PREP_BLOCKED: pnpm unavailable"
  exit 2
fi

pnpm install --frozen-lockfile
pnpm --filter @ucell/database prisma validate
echo "PRISMA_VALIDATE_PASS"
pnpm --filter @ucell/database prisma generate
echo "PRISMA_GENERATE_PASS"
pnpm -r build
echo "TYPESCRIPT_BUILD_PASS"
node scripts/test-todo-gate.mjs

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "RELEASE_PREP_BLOCKED: DATABASE_URL missing"
  exit 3
fi

pnpm --filter @ucell/database prisma migrate deploy
echo "MIGRATE_DEPLOY_PASS"
pnpm exec ts-node scripts/db-golden-e2e.ts
echo "DB_GOLDEN_E2E_PASS"
pnpm --filter @ucell/api openapi:export
node scripts/openapi-preflight.mjs
echo "OPENAPI_PREFLIGHT_PASS"

echo "Release-prep dependency/database gates completed."

if [[ "${RUN_SECURITY_E2E:-false}" == "true" ]]; then
  node scripts/security-http-e2e.mjs
fi

if [[ "${RUN_UAT_GATE:-false}" == "true" ]]; then
  node scripts/uat-gate.mjs
fi
