# Compensation Period source cohort and sealed-input evidence

Bounded §35 implementation; Compensation Period Control remains IN_PROGRESS.

The control read now resolves its expected source periods from the approved calendar or pinned Payable-preparation manifest. It supports all six kinds, including multiple intact Binary/Matching weeks beginning before a 10/25 period. Global/Welfare are NOT_APPLICABLE when no monthly close belongs to that approved batch. Each completed job must have a verified historical result envelope matching kind, source, rule, parameter hash and exact source period. A receipt label without its sealed result is a blocking discrepancy.

Unstarted requests now mean READY_TO_CLOSE, not SOFT_CLOSED. A full-window verified Referral receipt supplies the original-volume admission boundary established by migration 117. The volume check separately verifies original GPV/EPV event snapshots and RPV recognition snapshots, and detects originals recorded after a relevant source-period receipt. Linked correction rows remain outside original-input checks. Missing/invalid recognition evidence blocks financial completion. The source wait check uses the same readiness function as the Worker.

Bonus and payable reads follow actual source receipt identities, plus direct awards in the selected period. RPV and Global payable sources are included. The canonical real-engine test proves a Binary award from the week ending on the 10th remains intact in the 25th preparation: Award 10 and Payable 10 appear in the control read.

Admin shows explicit blocking evidence, source-job periods, elapsed time since period end and translated business states. The unbatched payable amount is distinct from payout net. Global outstanding/aging uses the current read cutoff and is labeled global; it no longer silently uses the selected historical period end as the current aging clock. Company accounting status remains separate.

Verification:

- Final isolated PostgreSQL/API checks: **5 suites / 57 tests PASS**, fresh **0→117**, **162 baseline assertions**, cleanup PASS.
- Includes actual six-kind empty closure, canonical funded week/batch flow, invalid legacy receipt rejection, missing original recognition evidence, payout-result recovery and negative financial-close conditions.
- API build, generated OpenAPI and security/OpenAPI preflights PASS. Manual generated-schema assertion proves CompensationPeriodJobDto and analytics PeriodJobDto remain separate; this corrects a pre-existing name collision without changing analytics runtime behavior.
- Admin typecheck/build and focused control-page test PASS; the test checks blocking evidence, elapsed time, safe output and separate ERP status.
- No new migration; no source economics or historical evidence rewritten.

Logs: `C:\UCell\logs\cr-batch-comp-period-cohort-{final,build,openapi,openapi-preflight,security,admin-typecheck,admin-test,admin-build}-20260930.log`.

Remaining §35: complete Company/Reservoir, typed RPV/Global Recovery and Payable/line reconciliation; explicit unresolved operational-exception guard; all-family amount bridge; four-stream ERP projections, result/attempt/exception evidence and Finance/ERP journeys. Full local implementation and final recertification remain IN_PROGRESS; Stage RC remains NOT_READY.
