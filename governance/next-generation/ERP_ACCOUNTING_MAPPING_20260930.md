# Approved ERP mapping attachments — 2026-09-30

Authority: §35 FER-6/8/9/10. Mapping codes and policy references are supplied by Finance. Synthetic test codes are not production accounting decisions. No journal, debit/credit balancing, tax or inventory-cost engine is introduced.

## Implemented

- Migration 121 adds append-only mapping attachments to existing approved Compensation/Payment reviews. Each attachment records its previous mapping, contiguous revision, review/request hashes, approved provider version and approval reference. It does not change the underlying economic projection, its source hash or private drillback.
- Preview requires the latest source projection, an active/effective approved ERP connection version and complete explicit coverage of its aggregate groups. Each group is either mapped to an operator-supplied code or explicitly report-only. Missing, duplicate, unknown and ambiguous groups/connections fail closed. Amounts remain separate source measures, not an additive journal total.
- Approval binds the exact preview hash and reference. Concurrent identical commands produce one mapping and audit. Changed inputs, stale reviews, conflicting replay and unavailable provider versions fail. Audit failure rolls back the attachment. Historical identical replay remains valid.
- Before dispatch, a changed policy/connection can create a new mapping revision. Dispatch and mapping commands lock the same projection; SQL validates the latest attachment's request hash and connection. After dispatch exists, further mapping is prohibited. A correction then requires a separately approved projection; transport history cannot be edited.
- Worker routes by the latest mapping's provider version, verifies source and attachment hashes, and sends the approved public aggregate envelope. Retry retains the same request and stable key; unknown response is resolved by lookup. The live adapter registry remains empty, so real ERP connectivity is still independently blocked.
- Financial read views distinguish missing mapping from missing transport. Admin offers explicit per-group decisions, a separate reviewed approval, immutable history, read-only audit access and a fixed-dispatch explanation. History and transport omit source UUIDs, actor IDs, credentials and arbitrary private source fields.

## Verified evidence

- Disposable PostgreSQL **0→121**, **162 baseline assertions**, **5 suites / 61 tests PASS**, cleanup PASS. Tests include actual HTTP authentication/RBAC, concurrent approval, rollback, provider suspension, changed review, version routing, source supersession, direct SQL stale-dispatch rejection, append-only guards and lookup recovery without a second submit.
- **120→121 preservation/guards PASS**, preserving existing Sales/Return projections, dispatches, accepted claims, attempts, order/Return/fulfillment/handoff evidence and original Compensation reviews. Cleanup PASS.
- Full isolated DB Golden PASS, cleanup PASS.
- Backend workspace build and Admin production build PASS. Admin **7 files / 17 tests PASS**. Generated OpenAPI, OpenAPI, security, schema and migration preflights PASS.
- Logs under `C:\UCell\logs`: `cr-batch-erp-mapping-routing-tests-20260930.log`, `cr-batch-erp-mapping-upgrade-20260930.log`, `cr-batch-erp-mapping-db-golden-20260930.log`, and mapping build/Admin/preflight logs.

The mapping path is local provider-neutral evidence, not live ERP certification. Financial aggregate result reconciliation, complete four-stream/Operations drilldown and browser acceptance remain in progress. Exact real account policy and live transport remain external dependencies. No Stage/Production deployment or whole-batch closure is claimed.
