# Compensation source exception gates — 2026-10-01

Three real PostgreSQL regressions reproduced a missing closure gate: unresolved HIGH exceptions using canonical Payout, Payable and Recovery references left financial readiness true. All three failed before the fix and pass afterward.

Period reconciliation now joins exact related Payout, Payable, Recovery and all three Company award source types. Private legacy IDs, historical hashed references and canonical references are recognized. Period and job exception gates remain intact. Unrelated source references remain excluded; matching a recipient or date alone is insufficient.

An unresolved HIGH/CRITICAL source exception blocks readiness even when numeric reconciliation passes. Resolution still runs the owning domain's evidence guard. Monitoring and task completion do not resolve exceptions or change financial records.

Validation: financial/Operations PostgreSQL 2 suites / 21 tests PASS; Company PostgreSQL 1 suite / 11 tests PASS. Each used fresh 0→121 migrations, 162 baseline assertions and disposable database cleanup. Tests cover actual 100 gross / 20 recovery / 80 bank payment, unrelated-source exclusion, controlled resolution, and Bonus/RPV/Global Company exception membership. API build PASS. No API schema, migration or frontend changed.

Logs: `C:\UCell\logs\cr-batch-period-source-exceptions-*.log` and `cr-batch-period-company-exceptions-db.log`.

Full typed recovery journey mapping, detailed period source drilldown, historical stage timing and final whole-batch recertification remain open.
