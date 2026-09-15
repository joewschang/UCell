| Gate | Result | Exit | Expected Exit | Command |
| --- | --- | --- | --- | --- |
| node-version | PASS | 0 | 0 | node --version |
| pnpm-version | PASS | 0 | 0 | pnpm --version |
| git-status | PASS | 0 | 0 | git status --short --branch |
| backend-install | PASS | 0 | 0 | pnpm install --frozen-lockfile |
| admin-install | PASS | 0 | 0 | pnpm install --frozen-lockfile |
| backend-peers | PASS | 0 | 0 | pnpm peers check |
| static-validate | PASS | 0 | 0 | node scripts/static-validate.mjs |
| convergence-validate | PASS | 0 | 0 | node scripts/convergence-validate.mjs |
| golden-domain-test | PASS | 0 | 0 | node scripts/golden-domain-test.mjs |
| schema-preflight | PASS | 0 | 0 | node scripts/schema-preflight.mjs |
| prisma-relation-preflight | PASS | 0 | 0 | node scripts/prisma-relation-preflight.mjs |
| prisma-client-access-preflight | PASS | 0 | 0 | node scripts/prisma-client-access-preflight.mjs |
| enum-migration-preflight | PASS | 0 | 0 | node scripts/enum-migration-preflight.mjs |
| runtime-safety-preflight | PASS | 0 | 0 | node scripts/runtime-safety-preflight.mjs |
| migration-preflight | PASS | 0 | 0 | node scripts/migration-preflight.mjs |
| source-preflight | PASS | 0 | 0 | node scripts/source-preflight.mjs |
| import-module-preflight | PASS | 0 | 0 | node scripts/import-module-preflight.mjs |
| review-r1-preflight | PASS | 0 | 0 | node scripts/review-r1-preflight.mjs |
| admin-readmodel-preflight | PASS | 0 | 0 | node scripts/admin-readmodel-preflight.mjs |
| admin-observability-preflight | PASS | 0 | 0 | node scripts/admin-observability-preflight.mjs |
| admin-operations-preflight | PASS | 0 | 0 | node scripts/admin-operations-preflight.mjs |
| operations-ready-preflight | PASS | 0 | 0 | node scripts/operations-ready-preflight.mjs |
| security-policy-preflight | PASS | 0 | 0 | node scripts/security-policy-preflight.mjs |
| release-readiness-preflight | PASS | 0 | 0 | node scripts/release-readiness-preflight.mjs |
| typescript-parse-preflight | PASS | 0 | 0 | node scripts/typescript-parse-preflight.mjs |
| golden-r1b-regression | PASS | 0 | 0 | node scripts/golden-r1b-regression.mjs |
| golden-economic-cases | PASS | 0 | 0 | node scripts/golden-economic-cases.mjs |
| admin-preflight | PASS | 0 | 0 | pnpm preflight |
| admin-selfaudit | PASS | 0 | 0 | pnpm selfaudit |
| prisma-validate | PASS | 0 | 0 | pnpm --filter @ucell/database exec prisma validate |
| prisma-generate | PASS | 0 | 0 | pnpm --filter @ucell/database exec prisma generate |
| prisma-migrate-deploy | PASS | 0 | 0 | pnpm --filter @ucell/database exec prisma migrate deploy |
| backend-build | FAIL | 1 | 0 | pnpm -r build |
| admin-build | PASS | 0 | 0 | pnpm build |
| shared-golden-tests | PASS | 0 | 0 | pnpm --filter @ucell/shared test --runInBand |
| api-tests | PASS | 0 | 0 | pnpm --filter @ucell/api test:e2e --runInBand |
| backend-test-gate | FAIL | 1 | 0 | pnpm test |
| admin-tests | PASS | 0 | 0 | pnpm test |
| test-todo-gate | FAIL | 1 | 0 | node scripts/test-todo-gate.mjs |
| db-golden | FAIL | 1 | 0 | pnpm db:golden |
| openapi-export | FAIL | 1 | 0 | pnpm openapi |
| openapi-preflight | FAIL | 1 | 0 | node scripts/openapi-preflight.mjs |
| security-http-e2e | FAIL | 1 | 0 | node scripts/security-http-e2e.mjs |
| http-smoke | FAIL | 1 | 0 | node scripts/http-smoke.mjs |
| uat-gate | FAIL | 1 | 0 | pnpm uat:gate |
| backend-dependency-audit | PASS | 0 | 0 | pnpm audit --json |
| admin-dependency-audit | PASS | 0 | 0 | pnpm audit --json |
| ci-gate | FAIL | 1 | 0 | "C:\Program Files\Git\bin\bash.exe" scripts/ci-gate.sh |
| rc-gate | FAIL | 1 | 0 | "C:\Program Files\Git\bin\bash.exe" scripts/rc-gate.sh |
| release-gate | FAIL | 1 | 0 | "C:\Program Files\Git\bin\bash.exe" scripts/release-gate.sh |
| windows-preflight-entrypoint | FAIL | 1 | 0 | pnpm preflight |
| windows-dev-smoke-entrypoint | FAIL | 1 | 0 | pnpm dev:smoke |
| windows-rc-entrypoint | FAIL | 1 | 0 | pnpm rc:gate |
| windows-release-prep-entrypoint | FAIL | 1 | 0 | pnpm release:prep |
| full-admin-dev-build | PASS | 0 | 0 | pnpm --filter @ucell/api build:admin-dev |
| hardened-admin-build | PASS | 0 | 0 | pnpm build |
| production-full-start-rejected | PASS | 1 | 1 | node dist-admin-dev/admin-dev.js |
| original-dev-db-full-start-rejected | PASS | 1 | 1 | node dist-admin-dev/admin-dev.js |
| remote-db-full-start-rejected | PASS | 1 | 1 | node dist-admin-dev/admin-dev.js |
| bypass-disabled-full-start-rejected | PASS | 1 | 1 | node dist-admin-dev/admin-dev.js |
