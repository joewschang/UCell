# Compensation Period payment-state correction

Bounded §35 defect repair; Compensation Period Control remains IN_PROGRESS.

The prior read could overwrite a failed/missing settlement or outstanding maturity/materialization stage with FINANCIALLY_RECONCILED whenever a matching payout was PAID. It also summed cumulative bank confirmations, showing 40 followed by 100 as 140. Six failing regressions reproduced these defects before the repair, including actual independently approved/exported payout results on disposable PostgreSQL.

The read now takes the maximum confirmed PAID amount per payout line, then sums the lines. Payment-stage advancement requires all currently modeled close kinds to have committed receipts and PROCESSED delivery state, with no pending award maturity. Open payables, unresolved Recovery and bank evidence not matching payout net prevent financial reconciliation. A PAID label without bank evidence remains BANK_RECONCILING. These changes do not modify Award, Payable, Payout or payment-result history, and do not imply ERP posting.

Verification: API build PASS; focused isolated 3 suites / 31 tests PASS, 162 baseline assertions, fresh 0→117 and cleanup PASS. Evidence logs: `C:\UCell\logs\cr-batch-comp-period-defects-{before,after,build}-20260930.log`. The before run has 6 expected reproduced failures; the after run includes two additional missing/partial bank evidence cases.

Still required in §35: six-kind/canonical-period source integration, source completeness and actual Soft Close evidence, Company/Recovery/Payable reconciliation, explicit unresolved-exception gating, complete four-stream ERP projection/reconciliation and Finance UX. This bounded repair does not certify those missing checks. Full implementation/recertification remain IN_PROGRESS; Stage RC remains NOT_READY.
