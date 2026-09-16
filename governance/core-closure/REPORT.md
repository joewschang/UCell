# Core Closure checkpoint report

Date: 2026-09-16 (Asia/Taipei)

- Branch: `integration/member-backend-mvp`
- Baseline checkpoint: `9615a46`
- TODO: 51 -> 39 (`IMPLEMENTABLE` 17 -> 6; `ENGINEERING` 28; `PENDING_DECISION` 3; `LEGACY_TEST_DRIFT` 2)
- Completed obligation: Matching traversal uses Sponsor Tree and is executable.
- Historical replay now has executable evidence that Matching recipients are validated against sealed Sponsor/Active/Qualification evidence even when Binary ancestry differs.
- Missing or substituted historical Sponsor evidence fails closed; no current-state fallback is introduced.
- K1/K2 now replay all sealed recipients from the original recognition period through subsequent finalized periods.
- Carry replay persists one immutable `SettlementReplayPeriod` per period and resumes the same `SettlementReplayRun` deterministically.
- `maxWeeks` produces `REPLAY_INCOMPLETE`, persists a non-monetary checkpoint, and never partially finalizes awards/recoveries.
- Propagation stops at the first period whose carry and award results match the original sealed boundary.
- Posted returns create idempotent historical Binary/Matching recalculation requests; replay marks them processed without rewriting settlements.
- Pending direct entitlement cancellation appends `REVERSED` without recovery; PAID reduction appends `CLAWBACK` plus recovery while preserving the original PAID row.
- Backend API: 147 PASS / 39 TODO / 0 FAIL.
- Database package build: PASS.
- Backend API build: PASS.
- Isolated DB Golden: PASS with all 25 migrations and 21 return/outbox concurrency assertions.
- Security policy preflight, R1.0B Golden, OpenAPI preflight: PASS.
- Business-rule changes: NONE. This checkpoint converts an already decided rule into executable verification.
- Production promotion: BLOCKED.

Pending decisions remain limited to production clock values, historical GPV-to-PV/BV migration mapping, and inactive Matching Sponsor edge semantics.
