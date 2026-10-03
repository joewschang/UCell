# Compensation aggregate review snapshot — 2026-09-30

Authority: §35 FER-6/8/9/11. This increment provides a Finance-approved provider-neutral review projection, not GL, tax, inventory costing, bank allocation or proof of an ERP voucher.

## Scope and invariants

- Preview requires the actual complete six-kind approved settlement cohort, valid original volume evidence, no unresolved input barriers, maturity, complete typed Payables and reconciled source/Recovery facts. Blocking financial exceptions fail closed.
- Configuration explicitly records compensation period, rule, accounting date, Finance-selected ledger denomination and its business approval reference. Optional payout-batch grouping applies only to period-attributed payable gross. No conversion or currency policy is inferred.
- Aggregate rows contain economic category, metric, amount, source count and optional hashed payout reference. Payable gross and Recovery required/applied/outstanding are separate measures, never added into an invented journal total. Whole shared payout-line net/bank money is excluded. No member, qualification, award or payable UUID is exported.
- Canonical review hash binds configuration, aggregates, exact immutable source references, receipt/snapshot identities and recorded recovery applications. Finance approves the reviewed hash and an approval reference. A changed source or configuration invalidates the preview. Serializable concurrent approval creates one projection, one Outbox and one audit. Audit failure rolls back all writes.
- One revision-one snapshot per compensation period prevents silently duplicating the same period under another date or grouping. Same approved request replays the original immutable result even after a later recovery. Conflicting approval fails. Later corrections require an explicit supplemental-projection workflow, still pending.
- Exact account mapping remains absent. Stored projection is `SUBLEDGER_ACCOUNTING_REVIEW`, mapping is null, and existing database/Worker guards prevent dispatch. No fake account code or live adapter is installed.
- API public output selects approved aggregate fields only. Immutable-source pagination exposes hashed business references and recorded amounts; hash verification precedes output. Finance/Compliance/Super Admin can read financial projections; Order Operations retains Sales/Return access but cannot enumerate or directly read Compensation or its sources. Only Finance/Super Admin can preview/approve.
- Admin requires explicit blank configuration fields, then preview, then a separate approval reference. Editing configuration discards the preview. Period Control independently shows missing, sealed/unmapped, invalid or changed-source ERP evidence, with a direct link to the financial projection. UCell financial lifecycle is not promoted by ERP evidence.

## Verified evidence

- Fresh disposable PostgreSQL **0→119**, **162 baseline assertions**, final settlement/HTTP/period integration **4 suites / 46 tests PASS**, cleanup PASS. Real settlement test includes all six engines, deterministic aggregate, concurrency, stale recovery preview, immutable replay, source privacy, audit rollback and Period Control changed-source detection.
- Final HTTP authorization refinement: **8 tests PASS**, fresh 0→119, 162 baseline assertions and cleanup PASS. Includes Order Operations compensation list/detail/source denial while Sales creation remains permitted.
- Admin **4 files / 9 tests PASS**, including blank actual input, role separation, preview-bound approval, dimension invalidation and retry. Production Admin build PASS.
- Full backend production build (database, settlement, API, Worker, shared/contracts), generated OpenAPI/preflight and security policy checks PASS. No migration was needed; existing immutable projection evidence is reused.
- Logs: `C:\UCell\logs\cr-batch-erp-compensation-final-tests-20260930.log`, `cr-batch-erp-compensation-role-tests-20260930.log`, `cr-batch-erp-compensation-admin-test.log`, `cr-batch-erp-compensation-admin-build.log`, `cr-batch-erp-compensation-backend-build.log`, `cr-batch-erp-compensation-openapi-preflight.log`, `cr-batch-erp-compensation-security.log`.

## Remaining acceptance

Approved mapping attachment/versioning and explicit supplemental projections, payment-specific projection, complete four-stream acceptance, actionable Operations candidates and actual-browser journeys remain internal follow-up work. Exact ERP mapping and live provider transport remain external dependencies. This evidence does not declare the overall batch or Compensation Accounting Projection PASS. Overall implementation/recertification remain IN_PROGRESS; STAGE_RC remains NOT_READY. No Stage/Production deployment occurred.
