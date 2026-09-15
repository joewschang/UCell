Latest verification for each gate; earlier runs remain in gate-results.json. Production Promotion: BLOCKED.

| Gate | PASS/FAIL | Command / evidence | Explanation |
|---|---|---|---|
| node-version | PASS | `node --version` |  |
| pnpm-version | PASS | `pnpm --version` |  |
| git-status | PASS | `git status --short --branch` |  |
| backend-install | PASS | `pnpm install --frozen-lockfile` |  |
| admin-install | PASS | `pnpm install --frozen-lockfile` |  |
| backend-peers | PASS | `pnpm peers check` |  |
| static-validate | PASS | `node scripts/static-validate.mjs` |  |
| convergence-validate | PASS | `node scripts/convergence-validate.mjs` |  |
| golden-domain-test | PASS | `node scripts/golden-domain-test.mjs` |  |
| schema-preflight | PASS | `node scripts/schema-preflight.mjs` |  |
| prisma-relation-preflight | PASS | `node scripts/prisma-relation-preflight.mjs` |  |
| prisma-client-access-preflight | PASS | `node scripts/prisma-client-access-preflight.mjs` |  |
| enum-migration-preflight | PASS | `node scripts/enum-migration-preflight.mjs` |  |
| runtime-safety-preflight | PASS | `node scripts/runtime-safety-preflight.mjs` |  |
| migration-preflight | PASS | `node scripts/migration-preflight.mjs` |  |
| source-preflight | PASS | `node scripts/source-preflight.mjs` |  |
| import-module-preflight | PASS | `node scripts/import-module-preflight.mjs` |  |
| review-r1-preflight | PASS | `node scripts/review-r1-preflight.mjs` |  |
| admin-readmodel-preflight | PASS | `node scripts/admin-readmodel-preflight.mjs` |  |
| admin-observability-preflight | PASS | `node scripts/admin-observability-preflight.mjs` |  |
| admin-operations-preflight | PASS | `node scripts/admin-operations-preflight.mjs` |  |
| operations-ready-preflight | PASS | `node scripts/operations-ready-preflight.mjs` |  |
| security-policy-preflight | PASS | `pnpm security:preflight` |  |
| release-readiness-preflight | PASS | `node scripts/release-readiness-preflight.mjs` |  |
| typescript-parse-preflight | PASS | `node scripts/typescript-parse-preflight.mjs` |  |
| golden-r1b-regression | PASS | `node scripts/golden-r1b-regression.mjs` |  |
| golden-economic-cases | PASS | `node scripts/golden-economic-cases.mjs` |  |
| admin-preflight | PASS | `pnpm preflight` |  |
| admin-selfaudit | PASS | `pnpm selfaudit` |  |
| prisma-validate | PASS | `pnpm --filter @ucell/database exec prisma validate` |  |
| prisma-generate | PASS | `pnpm --filter @ucell/database exec prisma generate` |  |
| prisma-migrate-deploy | PASS | `pnpm --filter @ucell/database exec prisma migrate deploy` |  |
| backend-build | PASS | `pnpm -r build` |  |
| admin-build | PASS | `pnpm build` |  |
| shared-golden-tests | PASS | `pnpm --filter @ucell/shared test --runInBand` | 6 executable golden assertions PASS |
| api-tests | PASS | `pnpm --filter @ucell/api test:e2e --runInBand` | 15 suites / 23 executable assertions PASS; 148 TODO remain |
| backend-test-gate | FAIL | `pnpm test` | 148 executable TODO; actual tests PASS |
| admin-tests | PASS | `pnpm test` | 4 executable assertions PASS |
| test-todo-gate | FAIL | `pnpm test:todo:gate` | 148 retained TODO across 13 original files |
| db-golden | FAIL | `pnpm db:golden` | Missing complete five-ball fixture / required fixed IDs |
| openapi-export | PASS | `pnpm openapi` |  |
| openapi-preflight | PASS | `pnpm openapi:preflight` |  |
| security-http-e2e | FAIL | `pnpm security:e2e` | Formal API3000 / Entra security context unavailable; isolated DEV43 checks are separate |
| http-smoke | FAIL | `node scripts/http-smoke.mjs` | Formal API3000 not running |
| uat-gate | FAIL | `pnpm uat:gate` | P0/P1 UAT still NOT_RUN |
| backend-dependency-audit | PASS | `pnpm audit --json` |  |
| admin-dependency-audit | PASS | `pnpm audit --json` |  |
| ci-gate | PASS | `pnpm preflight` | 21 offline checks + Prisma + full build PASS; not root Release gate |
| rc-gate | FAIL | `pnpm rc:gate` | 148 TODO guard blocks RC |
| release-gate | FAIL | `"C:\Program Files\Git\bin\bash.exe" scripts/release-gate.sh` | 148 TODO guard blocks Release |
| windows-preflight-entrypoint | PASS | `pnpm preflight` |  |
| windows-dev-smoke-entrypoint | FAIL | `pnpm dev:smoke` | Missing golden-r1-0b.ts fixture/seed runner |
| windows-rc-entrypoint | FAIL | `pnpm rc:gate` | 148 TODO guard |
| windows-release-prep-entrypoint | FAIL | `pnpm release:prep` | 148 TODO guard |
| sa-db-regression | PASS | `node backend/scripts/sa-decision-db-test.mjs` | 18 real DB assertions; fixtures rolled back |
| release-prep | FAIL | `pnpm release:prep` | 148 TODO guard blocks promotion |
| full-admin-dev-build | PASS | `pnpm --filter @ucell/api build:admin-dev` |  |
| admin-full-flow | PASS | `final/full-admin-flow.json` | 43 isolated DEV HTTP checks |
| http-configuration-guards | PASS | `final/http-configuration-guards.json` | Expected422 K0/K1 guards; zero settlement rows created |
| local-runtime | PASS | `final/local-runtime.json` | UI4173/API3001/proxy200 |
| original-source-preservation | PASS | `final/preservation.json` | Docs/frozen constants/original148 TODO unchanged |
