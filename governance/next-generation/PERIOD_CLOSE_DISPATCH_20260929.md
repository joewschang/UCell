# Period-close authenticated admission and Worker dispatch

Follow-up to PERIOD_CLOSE_JOB_FOUNDATION_20260929.md. This slice connects the durable request to Admin HTTP admission and the existing serial Worker loop. It does not enable the feature in an environment, deploy, or create automatic calendar schedules.

## Shared engine

`@ucell/settlement` owns the seven existing API settlement/calendar/query/rule/persistence implementations. Existing API paths re-export the same classes, preserving Nest dependency injection and direct endpoint compatibility. A normalized comparison against the preceding commit confirmed unchanged implementation bodies; only three explicit return type annotations were added for portable package declarations. API and Worker depend on this workspace package. Root recursive builds and the existing Docker build discover it through workspace dependencies. The static review preflight now reads the shared source.

`executePeriodClose` revalidates the calendar/cutoff and compares the current parameter snapshot to the immutable job before any economic writes. Parameter drift fails closed. The transaction facade directs engine transaction callbacks into the caller's existing leased transaction. The database core still verifies sealed result identity/hash and commits result, job receipt and acknowledgement atomically. Funded regressions now call this production adapter instead of a test-local duplicate.

## Admin contract

- `POST /admin/settlement-jobs`: SUPER_ADMIN or FINANCE, with a real authenticated person ID. Accepts only kind, periodStart, periodEnd, ruleVersionCode, prerequisiteIds and approvalReference. DTO validation rejects unsupported kinds, malformed dates/IDs and caller-supplied actor fields. Existing calendar validation rejects unapproved or premature periods. Existing request conflicts return 409; invalid prerequisite/request semantics return 400.
- `GET /admin/settlement-jobs/:id`: SUPER_ADMIN, FINANCE or COMPLIANCE_AUDIT. Returns request identity, actor/approval, prerequisite IDs, Outbox status/attempt count/availability and receipt. It does not return full parameter snapshots or raw execution errors.
- Actor/role come from the session. New admission writes `PERIOD_CLOSE_REQUESTED` through AuditService in the same transaction as job/Outbox creation. Audit failure rolls back admission. Exact duplicate admission retains the original actor and one creation audit.

Routes use the existing API prefix where configured. This is an API contract; an Admin task UI and list/retry controls remain pending.

## Worker contract and conservative readiness

`PERIOD_CLOSE_WORKER_ENABLED=true` explicitly enables polling. Missing/false disables it; malformed values fail closed. No environment flag was enabled during this change. The existing Worker tick calls the poller after due recognition processing; there is no second timer or independent cron.

The poller selects at most 20 available requests whose prerequisite receipts exist. Unfinished recognition schedules for the same rule before period end are excluded before the limit, avoiding starvation by recognition-blocked jobs. Unresolved economic source Outbox events conservatively block all closes; both PENDING/PROCESSING and DEAD source work prevent execution. Readiness is checked before claim and again inside the leased transaction. Waiting before claim does not consume attempts. A failure uses the existing fenced Outbox retry/dead-letter mechanism with a safe error code. Exact database row fencing and atomic result receipts remain authoritative.

This readiness barrier is intentionally conservative, not a complete source-watermark/freeze protocol. A calendar/dependency planner, late-input policy, Welfare orchestration, maturity/Payable candidate sequencing, operator retry controls and real job-worker process-kill recovery evidence remain pending. Existing direct-service process-kill tests continue to pass but are not relabeled as launched Worker recovery. Finance export/payment approval remains human-controlled. No Stage readiness or automatic-close readiness is claimed.

## Validation

Database/shared-settlement/API/Worker builds PASS; OpenAPI and review-R1 preflights PASS. Focused 4 suites / 44 tests PASS with 108 migrations, 162 baseline assertions and cleanup PASS (`C:/UCell/logs/period-close-dispatch-20260929.log`). The real Worker Binary→Matching dispatch case uses its own disposable local database so unrelated test Outbox records cannot bypass or contaminate the global readiness guard; that database is migrated and dropped by the suite. Full isolated API regression **147 suites / 1,107 tests PASS**, with **108 migrations / 162 baseline assertions / cleanup PASS** (`C:/UCell/logs/period-close-dispatch-full-20260929.log`). Stage remains NOT READY; no deployment or browser acceptance was performed.
