# Operations ERP health and unresolved investigations — 2026-09-30

Authority: §35 FER-9/18/19. Operational monitoring reads recorded evidence and exposes controlled candidates; it does not mark source transactions, payouts or investigations complete.

- Added a Finance/Compliance/Super Admin Operations Control page and authenticated health API for Sales, Fulfillment, Compensation/Payment and Return streams. Each stream preserves its existing bounded keyset pagination and fixed creation horizon; current-state data-through is shown independently.
- Counts and latest successful reconciliation are explicitly limited to the current page. A healthy page is not a whole-system certification. Next-page traversal does not discard healthy rows or skip the lookahead row.
- Failure, mismatch and unresolved exceptions are actionable without a time threshold. Queued/sent/accepted waiting becomes an overdue candidate only when the operator supplies a 1–8760-hour threshold. No business SLA is invented. Candidate evidence hashes exclude a continuously changing wall-clock value.
- Every item links to the exact financial projection or its fulfillment order. The physical reconciliation page accepts the order deep link. Private worker error strings, actors, credentials and internal source UUIDs are excluded.
- Fixed the physical ERP reader so a later MATCHED result cannot hide an earlier unresolved investigation. A bounded lateral SQL lookup joins exact handoff/result business sources and returns one outstanding exception per displayed item. It avoids ambiguous fulfillment-key prefix matching.
- Dispatch preparation is separately named. Unknown provider responses do not yield an acknowledgement timestamp, and an unrecorded actual send time remains unavailable.

## Verified

- Disposable PostgreSQL **0→121**, **162 baseline assertions**, **4 suites / 22 tests PASS**, cleanup PASS. Includes real authenticated financial access, denied Order Operations/anonymous access, private-error suppression and a persisted mismatch→match case retaining the open exception.
- Final timestamp/health unit verification **2 suites / 11 tests PASS**; final API build PASS.
- Admin **9 files / 23 tests PASS**, production build PASS. Navigation, explicit page coverage, candidate evidence links and next-page creation-horizon preservation are covered.
- OpenAPI generation/preflight and security preflight PASS. No schema migration.
- Logs: `C:\UCell\logs\cr-batch-operations-erp-health-final-tests-20260930.log`, `cr-batch-operations-erp-health-time-tests.log`, and corresponding Admin/build/OpenAPI/security logs.

This is the ERP health/read increment. Controlled Task/Exception commands and queues, bank/typed-source monitor coverage, broader source drilldown and full browser acceptance remain in progress. Whole-batch closure and Stage readiness are not claimed.
