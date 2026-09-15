# Phase 3 Connected DEV progress report

Date: 2026-09-15–16 (Asia/Taipei). Branch: `rc1-recovered`. Production Promotion remains BLOCKED; no RC2, merge, force push or production promotion.

Default DEV DB Golden now creates a fresh local `ucell_dev_golden_<uuid>` database, deploys all 20 migrations, loads deterministic five-person/five-qualification fixtures, checks exact fixture counts and frozen pool values, executes timezone/concurrency regression, and removes only its successfully-created test database. Two independent runs passed. It no longer requires pre-existing manual Golden data in the default DEV database.

RPV sealing includes original recognition period UTC bounds plus its historical accounting timezone. Replay verifies original event identity, recognition timestamp, Qualification, Binary path, Active/direct-count evidence, Parameter snapshot and complete recipient allocation. Missing evidence produces `HISTORICAL_SNAPSHOT_MISSING`; no current-state fallback is introduced. A changed current Binary parent receives no historical recovery, and original RPV awards remain unchanged.

Idempotency now checks a transaction-visible unfinished record's request hash before executing work. Regression covers the prior conflict hole. Real parallel transactions in the isolated Golden DB prove one committed entity/idempotency record; serialization/uniqueness conflicts require external redelivery and then return the original result. Injected partial failure rolls back entity/outbox/idempotency together, followed by successful retry and duplicate-delivery verification. This evidence does not claim automatic retry inside the service or complete concurrent monetary Return replay coverage.

## Coverage audit and TODO burn-down

The earlier report of 52 remaining TODOs / 96 completed cases is withdrawn. Several original cases were removed instead of converted, and assertions against constants or unrelated scenarios were incorrectly counted. The commits remain in history, with checkpoint `e232c92` before correction. Unverified cases were restored from `89bfed6`.

Current inventory: **99 executable TODOs** from original baseline 148. This is a net reduction of 49 placeholders, not a claim that all 49 have completed release-level review. The preceding audited Phase 3 batch converted 19 original TODOs with corresponding service/guard or direct DB assertions: idempotency (4), organization (4), qualification isolation (3), unlock-depth behavior (2), negative return/payout invariants (6). Two additional idempotency defect/rollback regression tests were added. Earlier Phase 2 conversions remain subject to continued coverage review.

The next batch, checkpoint `27789de`, converts four Vertical Slice 02 cases: DRAFT creation using the real service/idempotency callback; SUBMIT rejection for each missing Sponsor/Binary field plus successful submission; Active overlap rejection without mutation; historical Active half-open boundaries independent of the current flag. These are service tests with mocked persistence and do not claim database atomicity or concurrent Active exclusion. All other original cases remain TODO.

The following batch, checkpoint `8b44716`, converts three cases: application approval uses one idempotent transaction callback and transaction-local Qualification/Holder/Plan/Status/Sponsor/Binary delegates; the first/third-left guard is invoked before any creation; placement preview keeps different Sponsor and Binary identities. `phase3-membership-db-test.mjs` additionally invokes real services and Prisma in the fresh Golden DB to prove complete late-failure rollback, retry, duplicate approval, separate tree records, and first/third-left restrictions. Mocked callbacks now preserve the real idempotency `{value,replayed}` response envelope.

Checkpoint `b72e304` precedes two additional conversions: temporal holder authorization across the transfer boundary, and AdminRoleGuard denial for missing session, disallowed/missing role and absent endpoint policy. The isolated membership DB suite adds five temporal authorization assertions using explicit TEST_ONLY intervals; it does not infer workflow fee policy or claim Entra HTTP verification. This batch changes tests only; Prisma/offline/release-preparation results in the matrix retain their preceding run timestamps.

Checkpoint `1736321` precedes two payable idempotency conversions. Real `UnifiedPayableService.materialize` executes against stateful mocked transaction delegates; repeated BonusAward/RPV inputs create exactly one payable with the original source, recipient Qualification and amount. This is service-level idempotency evidence, not a concurrent database materialization test or approval of historical lifecycle eligibility. No production implementation changed; build/Prisma/offline/release-preparation results retain their preceding timestamps.

Checkpoint `68ae674` precedes three payout conversions: Qualification grouping despite a common Person, recovery offset without source Award mutation, and recovery bounded by payout gross so net remains nonnegative. The service tests execute `UnifiedPayableService` or `RecoveryBalanceService` against stateful transaction delegates and verify duplicate offset adds no second application. Fresh isolated DB fixtures add real payout grouping with the same holder Person, exact entry allocation and independent line amounts. TEST_ONLY inputs do not define formal PV/BV events or operational calendar.

The latest Jest run passes 16 suites / 79 tests with 99 TODOs. The DB regression passed 94 assertions with fixture rollback; the fresh Golden runner additionally exercises 20 monetary Return/outbox assertions and 67 membership/temporal/payout grouping assertions (48 approval, five temporal, 14 grouping). [TODO inventory](C:/UCell/UCell/governance/phase3-connected-dev/final/TODO-INVENTORY.md) records each unresolved name/file/line and its engineering or Pending Decision classification. No skip was added and original unresolved cases are retained. Exact newest Jest and isolated DB assertion counts are in `final/api-tests.txt` and `final/default-db-golden-repeat.txt`. This test-only batch retains preceding build/Prisma/offline/release-preparation timestamps.

## Verification

See [PASS/FAIL Matrix](C:/UCell/UCell/governance/phase3-connected-dev/final/PASS-FAIL-MATRIX.md) and `final/gate-results.json` for exact commands, exit codes and raw logs. Prisma validate/generate/deploy, Backend/Admin build, API/shared/Admin tests, static/offline preflights, default isolated DB Golden, timezone/concurrency tests and replay DB regression passed. The first Prisma generate attempt hit a Windows DLL lock from the existing DEV API/worker; after stopping those identified local DEV processes, generate and dependency-backed preflight passed.

The latest service test's first run failed TypeScript literal inference and was corrected using the DTO's literal type. Offline preflight also exposed Legacy Static Check Drift after the outbox owner extraction: `admin-operations-preflight.mjs` now verifies worker wiring plus safeguards in the shared lease module rather than requiring those implementation tokens in the worker entrypoint. Real DB lease/return assertions remain enabled. These repairs change no monetary/business rule.

The new timezone migration was deployed to default local `ucell` and isolated `ucell_admin_test`, and also replayed from zero in fresh Golden databases. No historical snapshot, original monetary ledger or PAID lifecycle was changed by the migration.

The identified local DEV API/worker were restored after Prisma generation, using the isolated `ucell_admin_test` full-access profile. Admin DEV full flow passed 43 HTTP requests. Frontend `http://127.0.0.1:4173/`, its health proxy, and API `http://127.0.0.1:3001/api/v1/health` returned HTTP 200. This is DEV infrastructure evidence, not formal Security/UAT approval.

## Remaining blockers and next work

- 99 TODOs: continue SSOT/evidence audit and real implementation tests, especially vertical slice and bonus-engine settlement integration.
- Commit `83e5b39` adds lease-safe production consumer processing and 20 isolated real DB assertions for concurrent partial returns, rollback/retry, PAID clawback, stale ownership, expired lease and duplicate delivery. This closes the previously missing focused concurrency coverage; broader production workload verification remains outstanding.
- RPV historical data predating required snapshots cannot be reconstructed from current state; missing allocation/period/timezone evidence remains fail-closed.
- Formal partial-refund RPV month allocation requires original allocation evidence; no proportional fixed-award assumption is made.
- Security HTTP is BLOCKED: formal API port 3000 is unavailable and formal Entra role tokens are not provided. The script now emits a clear infrastructure blocker rather than an unhandled fetch exception. DEV full-access success is not Production RBAC PASS.
- UAT is BLOCKED: operational credentials/configuration and formal UAT execution evidence are unavailable/NOT_RUN. The existing UAT gate remains unchanged.
- Eligible-consumption scope, formal PV/BV mapping and production operational calendar/cut-off remain Pending Decision. Existing subscription UTC schedule construction still requires a versioned scheduling implementation without guessing cut-off policy.

## Changed files and commands

Engineering changes: historical replay validator/sealer, idempotency service, versioned timezone migration, default Golden runner/fixtures/assertions, real DB concurrency test and Security HTTP error handling. Test changes restore unverified cases and add focused service/guard/DB regression. Governance changes add Decision, this report, TODO inventory, gate runner and per-gate evidence; the old Phase 2 report now explicitly withdraws invalid later coverage annotations.

Executed commands include `pnpm build` (Backend), Admin `pnpm build`, Prisma validate/generate/migrate deploy, `pnpm db:golden` twice on fresh databases, API `test:e2e --runInBand`, shared/Admin tests, `node scripts/phase2-db-test.mjs`, static/security preflights, `pnpm preflight`, `pnpm security:e2e`, `pnpm uat:gate`, TODO/backend test/RC/release gates, and `git diff --check`. All command logs are generated by `run-gates.mjs`.
