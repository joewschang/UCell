#!/usr/bin/env bash
set -euo pipefail

echo "== UCell R1.0B offline preflight =="
node scripts/static-validate.mjs
node scripts/convergence-validate.mjs
node scripts/golden-domain-test.mjs
node scripts/schema-preflight.mjs
node scripts/prisma-relation-preflight.mjs
node scripts/prisma-client-access-preflight.mjs
node scripts/enum-migration-preflight.mjs
node scripts/runtime-safety-preflight.mjs
node scripts/migration-preflight.mjs
node scripts/source-preflight.mjs
node scripts/import-module-preflight.mjs
node scripts/review-r1-preflight.mjs
node scripts/admin-readmodel-preflight.mjs
node scripts/admin-observability-preflight.mjs
node scripts/admin-operations-preflight.mjs
node scripts/operations-ready-preflight.mjs
node scripts/security-policy-preflight.mjs
node scripts/release-readiness-preflight.mjs
node scripts/typescript-parse-preflight.mjs
node scripts/golden-r1b-regression.mjs
node scripts/golden-economic-cases.mjs

echo "OFFLINE_PREFLIGHT_PASS"

if command -v pnpm >/dev/null 2>&1; then
  echo "== dependency-backed gate =="
  pnpm --filter @ucell/database prisma validate
  pnpm --filter @ucell/database prisma generate
  pnpm -r build
  echo "DEPENDENCY_GATE_PASS"
else
  echo "DEPENDENCY_GATE_SKIPPED: pnpm not installed"
fi
