# Compensation source drilldown — 2026-10-01

Finance and Compliance can traverse a selected period by economic category and qualification number, then inspect original award, signed Replay, Payable, typed Recovery and payment evidence. The source endpoint uses the existing approved cohort and financial reader in one Repeatable Read transaction. Responses contain at most 100 source rows (25 in the UI), with hashed keyset cursors and a fixed source-creation horizon. Current balances and bank state are reread on each page; the horizon is not a historical balance snapshot.

Exact links open the source's ownership/Reservoir B checks, Payable or Recovery Operations evidence, and the actual payout batch even beyond its first list page. Whole payout-line amounts and source counts are explicit. A source award of 100 can link to a shared line paid 150 without attributing all 150 to that award or period. Bank confirmation uses the maximum cumulative paid result, not the sum of repeated confirmations. Zero-net confirmation count remains visible.

Only whitelisted monetary values, qualification numbers and safe references cross this boundary. No Person/source/payout UUID, name, bank reference, parameter snapshot or private calculation JSON is returned. The reader cannot mutate economic history, tasks, exceptions or financial status.

Validation:

- 3 PostgreSQL/HTTP suites / 36 tests PASS; fresh 0→121, 162 baseline assertions and disposable cleanup PASS.
- Actual shared-line payment, exact business links, family/qualification filtering, later-insert pagination horizon, invalid cursor and payload privacy verified.
- HTTP authentication, financial roles, Order Operations denial and bounded filter validation verified.
- Admin: 2 files / 3 tests PASS, including whole-line warnings, signed adjustment, action links and pagination.
- API/Admin production builds, generated OpenAPI, OpenAPI/security preflights PASS.

Logs: `C:\UCell\logs\cr-batch-period-sources-*.log`.

The response is paginated; the underlying existing financial reconciliation still examines the full selected period. This is not a claim of independently paged database reconciliation or completed browser acceptance. Historical stage-entry timing, complete §35/four-stream journeys and final recertification remain open.
