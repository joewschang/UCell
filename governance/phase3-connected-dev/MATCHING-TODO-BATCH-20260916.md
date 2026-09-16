# Phase 3 Matching TODO burn-down — 2026-09-16

Branch: integration/member-backend-mvp. Pre-change checkpoint: 1feffce.

Converted exactly three original TODOs in backend/apps/api/test/bonus-engine-v04.e2e-spec.ts:

- Matching source is actual Binary payable after K1, never Binary theory. Two different source theory amounts with unchanged payable produce the same five matching theories; source award identity and finalized Binary batch selection are asserted.
- G1=15%, G2=10%, G3–G5=5%. Actual service writes are asserted by generation, recipient and Decimal theory amount.
- Matching pool=15%, K2<=1. Independent expected values cover unconstrained, constrained and zero-volume pools, every recipient payable, aggregate pool bound and Serializable transaction selection.

Rate evidence: existing R1.0B migration 0003_bonus_engine_core, matching.rate scopes 1–5 and pool.matching.rate. No business rule, monetary implementation, migration, dependencies, historical result, ledger, reversal or clawback changed.

These are real BinaryBonusService.settleMatching tests with mocked transaction-local persistence and Sponsor/recipient queries. captureParameters, snapshot verification, replay envelope verification, effectiveGpv and Prisma.Decimal remain real. sealSettlement is mocked: these cases do not establish real DB atomicity, concurrent settlement exclusion, historical graph correctness or replay sealing. The original Sponsor Tree traversal TODO remains unresolved.

## Verification

| Command | Result |
|---|---|
| pnpm --filter @ucell/api test -- --runInBand bonus-engine-v04 | PASS: 1 suite, 7 tests, 19 TODO; exit 0 |
| pnpm --filter @ucell/api test -- --runInBand | PASS: 17 suites, 113 tests, 69 TODO; exit 0 |
| node scripts/test-todo-gate.mjs | BLOCKED: 69 executable placeholders; exit 1 |
| git diff --check | PASS; CRLF normalization warnings only |

Commands executed from backend/, except git checks. Node v24.21.0; pnpm 12.4.1. Full Jest run took 30.698 seconds.

## Inventory observation and remaining work

The preceding committed inventory records 73 TODO. This batch changes bonus-engine-v04 from 22 to 19. Concurrent UX/API work also converts one v064-golden-dataset placeholder; the observed working tree total is 69. Only three conversions are attributed to this batch. The full-suite result includes those concurrent uncommitted changes and is not a clean-checkout release result.

Observed remaining counts: bonus-engine-v04 19; epv-global-v05 8; negative-flow-v05 6; qualification-isolation 1; v060-adjustment-lifecycle 3; v061-replay 4; v062-carry-chain 8; v063-golden-path 1; v064-golden-dataset 9; vertical-slice-02 8; vertical-slice 2.

Phase 3 remains incomplete. Next engineering work includes period-wide K1/K2 replay, carry convergence/maxWeeks/resume, subscription scheduling and remaining audited TODO conversion. Eligible-consumption scope, formal PV/BV mapping and production calendar/cut-off remain Pending Decisions. Production Promotion, formal Security/UAT and TODO-dependent release gates remain BLOCKED. No main merge or force push.

This separate batch report preserves the shared gate evidence and main report currently being updated by concurrent UX/API work. Integration inventory and report consolidation must include this batch before a release review.
