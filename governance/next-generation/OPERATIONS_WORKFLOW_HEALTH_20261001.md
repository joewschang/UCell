# Workflow monitoring and controlled work — 2026-10-01

Authority: §35 FER-18/19. Operations Control now exposes bounded settlement-job and monthly-recognition windows with exact public references, a fixed creation horizon, current snapshot time and healthy-row-preserving keyset pagination. This supplements the legacy fixed-size invariant query, so a healthy first window no longer prevents traversal to later source work.

- Settlement monitoring reuses the approved operational state calculation: source/recognition/prerequisite waits, award maturity, scheduled retry, expired lease, execution failure and an explicitly supplied overdue threshold. It does not invent an SLA. Completed jobs additionally require a valid immutable replay envelope with matching kind/source/rule/parameter hash and exact source period.
- Monthly recognition candidates use the original due time and only unresolved SCHEDULED/DUE states. Qualification numbers, installment/month, recorded amounts and rule codes are returned without subscription, person, job or event UUIDs.
- Source candidates enter the same audited, idempotent task pipeline after current evidence revalidation. Completing a task cannot complete the underlying job. Both exception APIs require verified job completion or a terminal recognition state before resolution.
- Exact job links open the authorized settlement detail/retry view beyond the first queue page. Query thresholds also apply to an exact job. PAYABLE_PREPARATION jobs link to their compensation control period; a Binary week is not mislabeled as a 10/25 compensation period. Linked period timestamps round-trip through explicitly Taipei-time fields and do not silently apply an aging threshold.
- Eligibility age is labeled as time since approved cutoff/maturity or recognition due time. **It is not an exact stage-entry timestamp.** Historical stage-entry duration remains a separate observability gap; no timestamp is fabricated from a request or period-end time.

## Verification

Initial real PostgreSQL job/work-item run: **2 suites / 27 tests PASS**, fresh 0→121, 162 baseline assertions, cleanup PASS. Includes a real governed period job waiting for monthly recognition, source-safe candidate and task, completion independence, blocked resolution through both APIs, bounded recognition pagination, actual period execution and verified completion followed by explicit exception resolution. Existing period admission/dependency/receipt/financial projection regressions remain covered.

Admin production build and **6 files / 11 tests PASS** cover authority/age labels, empty threshold, paging, exact job lookup, Taipei period deep-link round-trip, no automatic aging assumption and role-restricted retry UI. Final authenticated workflow-read/DTO and job run: **2 suites / 36 tests PASS**. Final exact-job threshold run: **1 suite / 22 tests PASS**, all with fresh 0→121, 162 baseline assertions and cleanup PASS. Final API/Admin builds, OpenAPI generation/preflight and security preflight PASS.

Logs: `C:\UCell\logs\cr-batch-operations-workflow-db.log`, `cr-batch-operations-workflow-final-db.log`, `cr-batch-operations-workflow-admin-test.log` and corresponding build/OpenAPI/security logs.

Company/Reservoir integration, complete compensation stage-duration evidence, broader source drilldown, actual browser journeys and full whole-batch recertification remain IN_PROGRESS. No deployment or Stage-ready claim.
