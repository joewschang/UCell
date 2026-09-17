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

echo "== Isolated DB Golden =="
# The legacy TypeScript seed was retired.  The isolated runner creates a
# disposable database, applies every migration, loads the frozen JSON fixture,
# executes the DB/HTTP assertions, and drops the database on completion.
pnpm db:golden

echo "== OpenAPI =="
pnpm --filter @ucell/api openapi:export
node scripts/openapi-preflight.mjs

echo "DEV_SMOKE_PASS"
