# Closed-period late-input boundary

Authority: R1.0B CR-BATCH-01 Period Orchestrator. This evidence covers prospective original volume admission after a durable period receipt; it does not declare whole-batch closure or authorize deployment.

## Implemented boundary

Migration 117 rejects a new original GPV, RPV or EPV whose rule and occurrence time belong to an already receipted period. The interval is half-open. The database returns `PERIOD_CLOSE_LATE_INPUT_REQUIRES_CORRECTION`; historical rows, jobs, parameters and receipts are untouched. Exact redelivery can reach an existing unique identity without introducing another fact. A nullable source-line identity cannot bypass this rule. Linked Return GPV / EPV adjustments and monthly-recognition RPV reversals retain their established append-only path.

Period execution obtains a PostgreSQL SHARE lock on the volume ledger before its first Serializable snapshot read and retains it through the receipt commit. A writer already holding the ledger lock commits before the close reads its sources. A later writer waits, then either encounters the closed-period guard or fails serialization. The latter remains retryable; retry observes the closed-period guard. This deliberately pauses volume writes during a close, bounded by the existing 60-second transaction timeout; it does not serialize ordinary volume writers when no close runs.

## Verification

- Backend build PASS after restoring missing local dependencies from the unchanged frozen lockfile and a fresh package store. The old dependency directory was retained outside the repository; no package or lockfile version changed.
- Focused isolated PostgreSQL: 2 suites / 10 tests PASS (late-input plus canonical planner), 162 baseline assertions, fresh 0→117 and cleanup PASS.
- Final strengthened contention checks: 4 tests PASS, observing actual `pg_locks` waits. Source-before-close includes GPV 100; close-before-source rejects both Read Committed and Serializable writers. Exact cutoff, foreign rule, exact redelivery, changed payload, nullable source-line, linked correction and immutable original receipt/snapshot are checked.
- Isolated 116→117 upgrade preserves existing six-kind jobs, Outbox records, receipts and original volume exactly; late admission and original redelivery checks PASS; cleanup PASS.
- Full DB Golden, schema/migration/security preflights PASS; disposable database cleanup PASS.
- Regression: 3 suites / 46 tests PASS, including all six Worker kinds across 24 actual process-kill/restart cases, durable job/Payable/Welfare checks and the canonical 3+2 Return/RPV recovery. Fresh 0→117, 162 baseline assertions and cleanup PASS.

The first fresh run exposed a PostgreSQL alias collision with trigger `OLD`; the unpublished migration was corrected and all listed successful runs used the corrected trigger.

Logs: `C:\UCell\logs\cr-batch-period-late-input-{focused,lock-golden,regression,upgrade,golden,build,schema,migration,security}-20260930.log`.

Period overdue detection and operational read remain the next slice. Full local implementation and final isolated recertification remain IN_PROGRESS; Stage RC remains NOT_READY.
