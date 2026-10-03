# Historical Active return replay — 2026-09-29

This increment repairs persisted replay evidence and adds its order-scoped read view. It is not Stage readiness or external deployment approval.

## Reproduced defects and repair

The shared replay writer compared a Taipei month-boundary instant (August 31 16:00 UTC for September) with SQL DATE recognition/accumulator month keys (September 1). Two real-PostgreSQL cases returned PRE_V3_RECOGNITION despite existing original decisions. The writer now uses the recognition's Taipei calendar-month key and checks the sealed period boundaries when v3 evidence exists. Legacy months without v3 decisions retain their explicit skip; they are not backfilled. An initial boundary check before that legacy skip blocked the older baseline fixture and was moved after evidence selection.

The writer's intended removal record used equal start/end timestamps, but migration 41 required end > start. Migration 107 (`20260929090000_active_replay_interval_removal`) permits equality only for HISTORICAL_RETURN_REPLAY_INACTIVE with a non-null superseded evidence reference. Other zero/reversed intervals and nonzero removal intervals are rejected. Existing append-only protection remains. The isolated 106→107 upgrade reproduces the original constraint rejection, preserves the original interval/accumulator, then checks the valid removal and invalid alternatives. No stored historical row is rewritten.

## Read and UI boundary

`returnActiveReplays` follows this order's ReturnCase IDs to recorded EPV reversal decisions, exact accumulators and replacement Active intervals. It validates the original-recognition subject/month, accumulation identity/delta/math, replacement subject/month/rule/threshold state and the superseded interval's subject/month. Ambiguous replacement rows fail closed. IDs and action keys are replaced by scoped references; current qualification flags are not consulted.

The timeline shows original and replaced/removed interval dates separately. Monthly before/after amounts may include other orders; replay deltas may be cumulative and cannot be added across actions. Missing replacement evidence does not imply removal or completed processing. RETURN_MONTH_REPLAY_NOT_CURRENT_ACTIVE distinguishes these recorded historical changes from current eligibility. The reader does not infer bank/payment results or run a recalculation.

## Validation

- Final full isolated API regression **142 suites / 1027 tests PASS**, fresh **0→107 migrations**, **162 baseline assertions** and cleanup PASS. Log: `C:/UCell/logs/active-replay-full-final-20260929.log`. This frozen-code rerun supersedes the failed fixture-contaminated full run below.

- Pre-fix reproduction: two real-DB tests fail with PRE_V3_RECOGNITION instead of an Active result. Log: `C:/UCell/logs/active-replay-red-20260929.log`.
- Isolated 106→107 upgrade, preserved historical rows, constrained removal shape and immutable-row guards PASS; cleanup PASS. Log: `C:/UCell/logs/active-replay-upgrade-20260929.log`.
- Database/API/Worker builds, migration preflight, Admin typecheck/build and **36 files / 139 tests PASS**.
- Real writer-to-read cases cover retained amounts above/below the threshold, original interval preservation, replay retry, exact-return exclusion, private-ID exclusion, stable reads and duplicate replacement rejection. These use the actual shared append writer with controlled sealed-input fixtures; they do not claim a new full return-command end-to-end certification.
- The first full run passed 1026 tests and failed the Train B/C return-cohort export expectation. Recent consumption-reader fixtures intentionally left incomplete ORDER recognition linkage in the shared disposable database; the analytics completeness guard correctly marked it stale. Those fixture groups now execute inside a Serializable rollback transaction (nested service callbacks share that transaction). Production analytics checks were not relaxed.

Broader all-award lineage, exhaustive replay graphs, complete common Explain fields, browser/visual acceptance and full-batch certification remain open. No Stage/Production deployment was performed.
