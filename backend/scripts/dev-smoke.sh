#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"

echo "== Offline preflight =="
bash scripts/ci-gate.sh

echo "== Prisma validate/generate =="
pnpm --filter @ucell/database exec prisma validate
pnpm --filter @ucell/database exec prisma generate

echo "== Migrations =="
pnpm --filter @ucell/database exec prisma migrate deploy

echo "== Build =="
pnpm -r build

echo "== Golden seed =="
pnpm --filter @ucell/database exec ts-node prisma/seed/golden-r1-0b.ts

echo "== DB Golden =="
pnpm exec ts-node scripts/db-golden-e2e.ts

echo "== OpenAPI =="
pnpm --filter @ucell/api openapi:export
node scripts/openapi-preflight.mjs

echo "DEV_SMOKE_PASS"
