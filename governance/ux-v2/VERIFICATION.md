# Phase 1 verification — original closure task

Source baseline: `903b8e96b9419e4dad2625777b7ec8ff1053c433`; Node 24.21.0, pnpm 12.4.1, Prisma 6.19.3. Run by task `01a0b14e-afc0-7680-8963-8af2e27137bb` in `C:/UCell/ux-v2-phase1`. This report records executed tests, separately from proposed next-phase acceptance cases. Production Promotion remains BLOCKED.

## Executed checks

| Check / command | Result | Evidence |
|---|---|---|
| Member `pnpm test` | PASS: 24 files / 142 tests | [member-tests](evidence/member-tests.txt) |
| Admin `pnpm test` | PASS: 17 files / 49 tests | [admin-tests](evidence/admin-tests.txt) |
| Backend `pnpm build` | PASS: workspace build, including API/Worker/shared/database | [backend-build](evidence/backend-build.txt) |
| Backend API `pnpm --filter @ucell/api exec jest --config ./test/jest-e2e.json --runInBand` | PASS: 52 suites / 483 tests | [backend-api-serial-tests](evidence/backend-api-serial-tests.txt) |
| Shared `pnpm --filter @ucell/shared test -- --runInBand` | PASS: 2 suites / 19 tests | [shared-golden-tests](evidence/shared-golden-tests.txt) |
| Backend `pnpm test:todo:gate` | PASS | [backend-todo-gate](evidence/backend-todo-gate.txt) |
| Decision v3 `pnpm golden:v3:mandatory` | PASS: T01–T17, 17/17 | [decision-v3-golden](evidence/decision-v3-golden.txt) |
| Boundary Golden B01–B20 | PASS via executed Shared + full API suites; mapping below | same Shared/API logs plus existing test sources |
| `pnpm --filter @ucell/database exec prisma validate` | PASS | [prisma-validate](evidence/prisma-validate.txt) |
| `pnpm openapi:preflight` | PASS | [openapi-preflight](evidence/openapi-preflight.txt) |
| `pnpm security:preflight` | PASS | [security-preflight](evidence/security-preflight.txt) |

Boundary coverage mapping: B01–B05 `backend/packages/shared/test/calendar.spec.ts`; B06–B09 `recognition-active-db.e2e-spec.ts`; B10–B11 `a-decision-return.e2e-spec.ts`; B12 `global-pool-calculation.e2e-spec.ts`; B13–B14 `global-pool-persistence.e2e-spec.ts`; B15–B20 `boundary-qualification.e2e-spec.ts`. B18/B19 and B20 are grouped named scenarios, not twenty separately counted test functions. Full API also executes existing Golden Dataset, Return/Replay, Carry and qualification isolation suites.

## Initial failures and recovery

Initial Backend `pnpm test` failed with 15 suites / 90 tests failing, 37 suites / 393 tests passing. [Original log](evidence/backend-tests.txt) is retained. It ran before the full API build; legacy DB fixture scripts require compiled `apps/api/dist` modules. Parallel execution also caused transaction conflicts/timeouts. After building unchanged source, the full API suite was run serially and all 483 tests passed. Shared tests and the mandatory TODO gate passed separately. Do not label the initial exact `pnpm test` command as passing; final evidence is the equivalent constituent gates with serial API execution.

Member offline dependency installation initially could not read cached registry policy metadata for a locked LIFF package. Normal frozen-lockfile installation succeeded with existing package versions; no lockfile changed. Dependencies and generated/build outputs remain untracked/ignored and are not production source edits.

## Database scope and no-migration evidence

First attempted template cloning of local `ucell_admin_test` was rejected because that database had an active session; no session was terminated. For independent v3 verification, copied schema only into new empty `ucell_ux_phase1_test`, then copied only `_prisma_migrations` provenance (no application data). Logs: [schema copy](evidence/test-schema-copy.txt), [provenance copy](evidence/test-schema-provenance.txt). This copied already-existing local database structure; no `migrate deploy`, `migrate dev`, schema push, new migration or production schema change was run.

The local source schema has 52 recorded migrations (including other in-progress local work), while audited Git source has 50. Therefore these DB tests are compatibility/regression evidence against the existing local schema, **not** proof of a fresh 0-to-50 migration deployment. No such deployment was attempted in this phase. Prisma validation uses the audited unchanged 50-migration source schema.

Some legacy full-suite scripts assert database name `/ucell_admin_test` and need its existing local test fixtures. Final full API serial run used that local DEV test database, as the repository harness requires, rather than the empty copy. The legacy Phase 2 fixture records `fixturesRolledBack: true`; its resulting report is preserved at [phase2-db-regression](evidence/phase2-db-regression.json). Test-generated changes to the old governance report were restored in this isolated checkout; only the new evidence copy is intended for commit. No Stage/Production connection, deployment, promotion or provider credentials were used.

## Limits and acceptance

No Multi-Tree/company/B production behavior has been implemented or claimed tested. MT/ST/component/API acceptance matrices are future tests. No browser screenshot or manual accessibility review is claimed for new v2 screens. Passing legacy tests does not resolve the documented NT$2,000/source-basis conflict, company ownership model gap, historical read gaps or D1/D2 decisions. Formal UAT, external identity/security, release and economic extension gates remain separate.

Before commit: verify only `governance/ux-v2/` is changed, all production source/Prisma/migrations/OpenAPI hashes match baseline, relative links resolve, and the final review package uses one consistent API/decision vocabulary. Concurrent task ownership and newer Issue addenda must be resolved before claiming final architecture closure. Final commit SHA and remote equality belong in the completion response after push, not prefilled here.

## Final baseline revalidation — 924dadc

Upstream source advanced to 924dadc9b162a68471ef971c8eec72e24430a554 before documentation commit. Existing migrations now total 52, matching the copied local schema count; this still does not prove a fresh migration deployment. Initial results above remain dated evidence.

- Backend generate/build PASS: evidence/current-generate.txt and current-build.txt.
- Full serial API PASS: 60 suites / 571 tests, evidence/current-api-tests.txt.
- Admin PASS: 21 files / 61 tests, evidence/current-admin-tests.txt.
- TODO, OpenAPI and security PASS: evidence/current-todo.txt, current-openapi.txt, current-security.txt.
- Prisma first failed because DATABASE_URL was omitted (current-prisma.txt). With the existing local test URL supplied, validation PASS (current-prisma-retry.txt); no migration was run.
- Member and shared source trees are unchanged from 903b8e9, so their prior passing evidence remains applicable. Mandatory v3 result remains explicitly labeled at its original baseline; no claim of a new run.
- Final inventory: 993 protected source/document hashes, 52 migrations, 151 OpenAPI operations and 687 terminology matches. Previous source manifest preserved separately.
- Documentation check: evidence/verify-closure.mjs verifies required documents, relative links, source hashes, authorized diff scope and curated dataset fields. Results are saved in evidence/closure-validation.json. It is a package consistency check, not execution of future architecture acceptance scenarios.

Issue input boundary is body plus six captured addenda. AI/BI additions are incorporated; separate architecture work in another checkout has not been copied as an implementation claim. The final review report is the package entry point. No Stage/Production/provider operations occurred.
Evidence text has trailing whitespace and final blank lines normalized for Git hygiene; test outcomes and diagnostic content are retained.

Final remote reconciliation at 935e8a288f0e0891e657175a0f9a4f1afc12a47b: ProviderOperationsPage test initially failed while loading (evidence/final-admin-tests.txt); rerun without code changes passes 22 files / 63 tests (evidence/final-admin-tests-retry.txt). The upstream test waits a fixed 20ms, so this remains a documented timing-sensitive test, not a proven repair. Backend/member/shared unchanged; prior results apply. Final inventory has 995 protected files, 52 migrations and 151 API operations. Only the documentation commit is ours.
