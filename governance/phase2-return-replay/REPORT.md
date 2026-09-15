# Phase 2 Connected DEV Report

Date: 2026-09-15  |  Branch: `rc1-recovered`

Phase 2 implements historical, append-only replay for GPV/K0, Binary/K1, Matching/K2, EPV monthly threshold allocation, RPV cancellation, multi-return carry continuation, and the production outbox consumer. Every replay reads the sealed original Qualification, Sponsor/Binary, Active, and Parameter evidence. Missing evidence fails closed with `HISTORICAL_SNAPSHOT_MISSING`.

The DB regression harness passed 81 assertions (fixtures are transactionally rolled back). It covers partial and repeated returns, cross-threshold EPV, historical recipient changes, inactive recipients, duplicate/idempotency keys, complete period replay, carry continuation, RPV cancellation, PAID clawback, two payout batches, append-only mutation guards, and missing evidence. The Admin DEV full-access flow passed 43 HTTP requests. `http://127.0.0.1:4173/` and its API proxy returned HTTP 200.

## Gate matrix

The authoritative matrix and raw command output are in [final/PASS-FAIL-MATRIX.md](C:/UCell/UCell/governance/phase2-return-replay/final/PASS-FAIL-MATRIX.md) and [final/gate-results.json](C:/UCell/UCell/governance/phase2-return-replay/final/gate-results.json).

PASS: Node/pnpm checks, static/convergence/source/schema/security-policy preflights, Prisma validate/generate/deploy (19 migrations), Backend Build, Admin Build, API Jest (16 suites; 95 passed, 67 TODO), shared tests (6), Admin tests (4), CI gate, isolated DB Golden (manifest fixture plus DB assertions), Phase 2 DB regression, OpenAPI export/preflight, and Admin DEV full flow.

FAIL/BLOCKED: the default `ucell` DB Golden lacks the five-ball fixture; PostgreSQL version subprocess was denied Docker pipe access in the first child-process attempt (direct verification passed PostgreSQL 16.15); backend/release/RC gates remain blocked by 67 executable TODOs; Security HTTP requires formal port 3000 and role tokens; UAT requires its configured tokens and operational environment. Production Promotion remains BLOCKED.

## TODO burn-down

The baseline was 148 executable TODOs. Eighty-one rule-supported cases are now executable, including EPV self/upline allocation and Sponsor Tree separation. Current count is 67. No TODO was deleted, skipped, or replaced by a fake assertion. Remaining TODOs are Test implementation; cases that depend on pending eligible-consumption scope, PV/BV mapping, operational calendar, or EPV timezone remain pending review.

## Remaining blockers

Historical allocation evidence for a return that affects an RPV recognition is required; the consumer correctly refuses to infer a month or recipient from current state. Eligible-consumption scope, PV/BV mapping, production calendar, and EPV timezone remain Pending Decision. The default development database needs an isolated Golden fixture load before its legacy DB Golden can pass. Formal security/UAT credentials and service configuration are absent. These blockers do not change the frozen commercial rules.

## Traceability

Decision `SA-20260915-02` is recorded in [DECISION.md](C:/UCell/UCell/governance/a-decision-return-replay/DECISION.md). Phase 2 evidence is sealed in `ledger.historical_replay_snapshot`; corrections are in `ledger.entitlement_replay_posting`; completed actions and carry projections are append-only. Original ledger and PAID lifecycle records are never updated. Recovery offsets use the existing payout/recovery owner and are idempotent per payout line.

## Commands

The executed command set is captured by [run-gates.mjs](C:/UCell/UCell/governance/phase2-return-replay/run-gates.mjs) and its per-command logs. Key commands were `pnpm -r build`, Prisma validate/generate/migrate deploy, `pnpm --filter @ucell/api test:e2e --runInBand`, `node backend/scripts/phase2-db-test.mjs`, `pnpm db:golden`, `pnpm preflight`, `pnpm security:preflight`, `pnpm uat:gate`, `pnpm rc:gate`, and `pnpm release:prep`.

## Commits

Checkpoint commits: `9200151520734525de4689d0db93a98bcd8642293`, `ba2afeb70e7b72e6d175c33541f14b58a532c519`, `c1018aa79c28f42ca793883c603f44e50ed63deb`.
