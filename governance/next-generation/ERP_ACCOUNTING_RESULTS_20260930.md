# ERP accounting aggregate result reconciliation — 2026-09-30

Authority: §35 FER-6/8/9/12/13. Approved UCell amounts and actual ERP results are independent evidence; no journal engine or allocation of bank money to award periods is introduced.

- Finance records actual ERP amounts only against an accepted external reference and the exact pinned mapping request hash. Unsent projections, another voucher, stale source-payload hashes, duplicate result groups and conflicting command replays fail.
- Each MAP group is compared independently. Report-only groups are not required posting amounts. Missing/underpaid groups yield PARTIAL; currency mismatch, excess or unexpected groups yield MISMATCH; exact required coverage yields MATCHED. Overlapping gross, recovery, net and bank measures are never summed into one purported journal total.
- Result snapshots retain source and mapping references/hashes and append-only actual evidence. Concurrent identical results create one row and audit. Audit failure rolls back the result and exception together.
- Differences open a HIGH operational exception. A subsequent exact result does not resolve it. The Compensation Period ERP checkpoint reports ATTENTION while such an exception remains open, independently of UCell financial reconciliation.
- Public reads and Admin provide per-group actual-versus-sealed comparison, explicit unexpected groups, blank actual inputs, separate report-only decisions and financial RBAC. Input times are explicitly Taipei time. A failed request retains the result key for safe replay. Existing Sales/Return quantity tables and total-amount presentation are not shown for accounting measures.
- Approved mapping transport now includes whitelisted compensation/payout period context, denomination basis and per-group payout scope in addition to deterministic source/drillback hashes. Private source identities remain excluded.

## Evidence

- Fresh isolated PostgreSQL **0→121**, **162 baseline assertions**, **4 suites / 52 tests PASS**, followed by final financial/mapping/HTTP **3 suites / 29 tests PASS** with updated transport context; cleanup PASS.
- Actual governed cross-period payout: gross **150**, recovery **20**, net **130**, cumulative bank paid **130**. Its dual approval, immutable export and source ownership are verified before projection; mapping, synthetic ERP acceptance and independent group reconciliation PASS. Original payout/bank facts remain unchanged. The compensation-period share remains **100**; bank money is not allocated to it.
- Admin **8 files / 19 tests PASS**; Admin and complete backend workspace production builds PASS. OpenAPI generation/preflight and security preflight PASS. No schema migration.
- Logs: `C:\UCell\logs\cr-batch-erp-accounting-result-final-tests-20260930.log`, `cr-batch-erp-accounting-result-payment-tests-20260930.log`, and corresponding result Admin/build/OpenAPI/security logs.

Full typed Recovery acceptance, detailed actionable drilldown, Operations integration, complete four-stream/browser acceptance and final whole-batch recertification remain open. Exact ERP policies/transport and bank-specific formats remain separately external. Stage RC is not ready.
