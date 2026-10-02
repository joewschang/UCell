# Welfare durable period-close evidence

Authority: the CR-BATCH-01 Period Orchestrator queue. This closes the Welfare job slice, not the full orchestrator or whole batch.

## Runtime boundary

- `WELFARE` uses the existing immutable Period Job, Outbox, dependency-aware claim, fenced transaction and Period Close Receipt.
- Admission requires a same-rule, same-period Global prerequisite. Waiting for its receipt never acquires a lease or consumes retries.
- The existing Welfare accrual calculation remains accrual-only. No member award, payable or payout is created.
- Its original GPV cohort is now restricted to the requested rule version and `[periodStart, periodEnd)`. The former aggregate admitted unrelated rule versions.
- The accrual, initial Welfare effect, source/parameter replay envelope and job receipt commit atomically. The envelope records exact GPV events, rate, total, amount and initial effect; it does not reconstruct historical evidence on retry.
- Existing unsealed accruals are preserved. A durable request against one fails the existing missing-snapshot guard; current inputs cannot silently backfill original evidence.
- Migration 114 only extends the allowed job kinds. It does not modify historical jobs, receipts or monetary rows.
- A reproduced admission race is repaired: a serialization loser may observe no committed winner yet. Admission now retries in a fresh transaction up to four attempts; successful replay still compares immutable approval and dependencies.

## Verification

- Backend build, schema preflight, migration preflight and OpenAPI regeneration/preflight: PASS.
- Disposable real PostgreSQL upgrade 113→114: PASS. All four old job families, receipts and Outbox rows remain identical; append-only job/receipt guards remain enforced; Welfare admission is accepted.
- Focused database/HTTP/runtime regression: **4 suites / 36 tests PASS**, including four simultaneous admissions, actual funded Welfare with an unrelated-rule GPV source, rollback after sealing, retry, and zero member payable creation. Fresh **0→114**, **162 baseline assertions**, and cleanup PASS.
- Actual Worker process-death matrix: **1 suite / 20 tests PASS**, preserving the original four job families and adding Welfare, each with zero/funded inputs and before-seal/after-commit termination. Recovery preserves byte-identical economic rows and a single effect/receipt. Cleanup PASS.
- Full DB Golden: PASS with fresh migrations and cleanup; security policy preflight PASS.
- Two test fixture delegate typos were corrected before executing the new assertions. A subsequent run passed all 36 assertions but exceeded the disposable-database cleanup hook's default five seconds; cleanup now uses a bounded 30 seconds with guaranteed control-client disconnection. The final successful run also includes the admission race fix.

Logs: `C:\UCell\logs\cr-batch-welfare-*-20260930.log`. No Stage or Production access/deployment.

## Remaining orchestrator scope

Payable preparation sequencing, approved-calendar due discovery, late-input policy, overdue detection and the final operational read remain required. This slice does not mark those features PASS or declare Stage RC readiness.
