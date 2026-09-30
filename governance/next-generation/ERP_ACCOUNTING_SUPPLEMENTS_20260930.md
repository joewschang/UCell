# Append-only ERP accounting supplements — 2026-09-30

Authority: §35 FER-6/8/9/10. A subsequent recovery or bank result changes current review evidence; it cannot overwrite an approved projection or imply ERP acceptance.

## Implemented

- Finance can preview and approve a supplemental period or whole-payout snapshot. Preview binds the exact latest parent reference and payload hash to newly reconciled source evidence. It compares known monetary totals without exposing private drillback fields.
- Approval requires the reviewed hash, approval reference and reason reference. Changed source evidence rejects a stale preview. Unchanged evidence cannot create another supplement. Concurrent identical approvals have one effect; conflicting approval parameters fail. Audit failure rolls back projection and Outbox together.
- Migration 120 enforces a contiguous Compensation revision chain at the database boundary. Missing/wrong parents, skipped revisions and Sales/Return supplements fail. Existing projections, payloads, dispatches, attempts and external-reference claims remain unchanged and append-only.
- Period Control reads the latest approved review revision while retaining independent UCell and ERP states. Admin routes existing sources to their latest sealed revision and provides a financial-role-only comparison/approval form. Compliance can read but cannot approve; Order Operations cannot read or approve financial evidence.
- Every supplemental revision remains blocked for transport until approved mapping evidence exists. Neither this change nor a bank PAID result creates an ERP voucher.

## Verification

- Disposable PostgreSQL fresh **0→120**, **162 baseline assertions**, affected **5 suites / 70 tests PASS**, cleanup PASS.
- **119→120 preservation/guards PASS**, including historical projection, dispatch, claim, attempt, order, Return and fulfillment evidence; cleanup PASS.
- Full isolated DB Golden PASS, including migration deployment and cleanup.
- Admin **6 files / 14 tests PASS**; production build PASS. Backend workspace production build PASS. Generated OpenAPI, OpenAPI preflight, security, migration and schema preflights PASS.
- Logs under `C:\UCell\logs`: `cr-batch-erp-supplement-final-tests-20260930.log`, `cr-batch-erp-supplement-upgrade-20260930.log`, `cr-batch-erp-supplement-db-golden-20260930.log`, and `cr-batch-erp-supplement-*` build/preflight logs.
- A final privacy/HTTP rerun was interrupted by loss of the local PostgreSQL server. Its failure is infrastructure evidence, not a passing verification; the recovery rerun is recorded separately below.
- PostgreSQL completed crash recovery without rebuilding its volume. Final privacy/HTTP rerun: **2 suites / 23 tests PASS**, 162 baseline assertions and cleanup PASS (`cr-batch-erp-supplement-recovered-tests-20260930.log`).

Approved mapping attachment/versioning, complete four-stream reconciliation and browser journeys remain internal work. Exact account mapping and live ERP transport remain independent external dependencies. Whole-batch closure and Stage readiness remain unclaimed.
