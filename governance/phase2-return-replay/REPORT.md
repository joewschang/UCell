# Phase 2 Connected DEV Report

Date: 2026-09-15  |  Branch: `rc1-recovered`

Phase 2 implements historical, append-only replay for GPV/K0, Binary/K1, Matching/K2, EPV monthly threshold allocation, RPV cancellation, multi-return carry continuation, and the production outbox consumer. Every replay reads the sealed original Qualification, Sponsor/Binary, Active, and Parameter evidence. Missing evidence fails closed with `HISTORICAL_SNAPSHOT_MISSING`.

The DB regression harness passed 81 assertions (fixtures are transactionally rolled back). It covers partial and repeated returns, cross-threshold EPV, historical recipient changes, inactive recipients, duplicate/idempotency keys, complete period replay, carry continuation, RPV cancellation, PAID clawback, two payout batches, append-only mutation guards, and missing evidence. The Admin DEV full-access flow passed 43 HTTP requests. `http://127.0.0.1:4173/` and its API proxy returned HTTP 200.

## Gate matrix

The authoritative matrix and raw command output are in [final/PASS-FAIL-MATRIX.md](C:/UCell/UCell/governance/phase2-return-replay/final/PASS-FAIL-MATRIX.md) and [final/gate-results.json](C:/UCell/UCell/governance/phase2-return-replay/final/gate-results.json).

Phase 2 PASS evidence is preserved in the original logs. Later Phase 3 edits claiming 110 passed / 52 TODO were invalidated by coverage audit: some original cases had been removed and several assertions did not test their named behavior. Current results are in `governance/phase3-connected-dev/final/PASS-FAIL-MATRIX.md`.

Phase 2 blockers included default DB Golden fixtures, executable TODOs, and formal Security/UAT environment. Phase 3 now runs default DB Golden in a freshly-created local test database. Production Promotion remains BLOCKED; refer to the new report for current blockers.

## TODO burn-down

The original baseline was 148. The previously reported 96 conversions / 52 remaining is withdrawn. Unverified original cases were restored from commit `89bfed6`; subsequent conversions require assertions against their actual implementation. The Phase 3 TODO inventory records every remaining case and its classification.

## Remaining blockers

This paragraph describes Phase 2 status only. SA Phase 3 has approved Asia/Taipei timezone and original RPV allocation evidence; eligible-consumption scope, PV/BV mapping, and production calendar remain pending. Formal security/UAT credentials remain absent. See the Phase 3 report for implementation evidence.

## Traceability

Decision `SA-20260915-02` is recorded in [DECISION.md](C:/UCell/UCell/governance/a-decision-return-replay/DECISION.md). Phase 2 evidence is sealed in `ledger.historical_replay_snapshot`; corrections are in `ledger.entitlement_replay_posting`; completed actions and carry projections are append-only. Original ledger and PAID lifecycle records are never updated. Recovery offsets use the existing payout/recovery owner and are idempotent per payout line.

## Commands

The executed command set is captured by [run-gates.mjs](C:/UCell/UCell/governance/phase2-return-replay/run-gates.mjs) and its per-command logs. Key commands were `pnpm -r build`, Prisma validate/generate/migrate deploy, `pnpm --filter @ucell/api test:e2e --runInBand`, `node backend/scripts/phase2-db-test.mjs`, `pnpm db:golden`, `pnpm preflight`, `pnpm security:preflight`, `pnpm uat:gate`, `pnpm rc:gate`, and `pnpm release:prep`.

## Commits

Checkpoint commits: `9200151520734525de4689d0db93a98bcd8642293`, `ba2afeb70e7b72e6d175c33541f14b58a532c519`, `c1018aa79c28f42ca793883c603f44e50ed63deb`.
