# Power interruption recovery — 2026-09-28

Resumed checkout: `C:/UCell/next-generation-recovered`, branch `integration/member-backend-mvp`, starting commit `56ca29c`.

## Recovered work

The previous session had implemented partial Repurchase returns, but had not exercised multiple partial cancellations against a real database. Source files survived the interruption. The only initial working-tree change was the generated DB regression report.

## Corrections and evidence

- The cancellation aggregate already contains the newly inserted refund. Restore the pre-command remaining amount before computing the reduction, so each refund is deducted once.
- Lock the subscription row before reading cancellation totals and schedules. Different concurrent refund commands cannot both spend the same remaining entitlement.
- Preserve both currency and RPV rounding residuals in the final future installment.
- Identify each RPV reversal by its immutable cancellation ID, retaining the recognition ID and original ledger reversal reference. A second legitimate partial return no longer collides with the first reversal's unique key. Existing ledger rows are untouched.
- Added disposable PostgreSQL tests for 20% then 30% then remaining 50% refunds, unchanged retry results, rejected over-refunds with rollback, rounding totals, and competing 60% refunds.
- Added historical replay assertions for cumulative 20% then 50% RPV/award recovery, duplicate replay, cancellation retry and unchanged original award facts.

Database and API builds passed. Focused isolated API verification passed **2 suites / 7 tests**, **162 real-DB assertions**, and fresh **0→101 migrations**. The disposable database was cleaned up.

Full isolated API regression then passed **133 suites / 904 tests**, again with **162 real-DB assertions** and fresh **0→101 migrations**. The runner reported both `API_JEST_ISOLATED_PASS` and `API_JEST_ISOLATED_CLEANUP_PASS`. Local command logs: `C:/UCell/logs/power-recovery-repurchase-tests.log` and `C:/UCell/logs/power-recovery-full-api.log`.

## Remaining scope

This checkpoint does not close the full CR batch. Commercial Offering promotional composition validation, Operations invariant families, ERP transport/reconciliation, governed bank-format decisions, and other pending items remain tracked in `R1.0B_CR_BATCH_01_IMPLEMENTATION_PROGRESS.md`.

Additional Repurchase acceptance still needs coverage for recognition occurring between partial returns, mixed full/partial returns delivered out of order, and concurrent recovery consumers. These cases are not certified by the focused tests above.

No Stage or Production deployment was performed.
