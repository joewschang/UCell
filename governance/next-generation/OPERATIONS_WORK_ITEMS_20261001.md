# Controlled ERP work items — 2026-10-01

Authority: §35 FER-18/19. This increment connects ERP candidates to audited operational work without changing financial, order, shipment or external-system authority.

- Finance, Compliance Audit and Super Admin can list ERP tasks/exceptions using hashed business references, bounded keyset pages, a fixed creation horizon and separately labeled current-state read time. Internal source/actor UUIDs, summaries, raw worker errors and free-text private notes are excluded.
- Candidate creation re-reads the current ERP evidence in the command transaction. Source/code/evidence must still match. Same-source/same-evidence creation is single-effect; retries retain command identity, audit failures roll back the task and idempotency receipt, and changed evidence requires a new review.
- Tasks support role assignment, an optional Taipei-time due date, audited reassignment and explicit expected-status transitions. Reassignment clears an older individual actor assignment. Completion records operational progress only.
- Exception acknowledgement/investigation is distinct from resolution. Both the business-reference API and the pre-existing API require current matched ERP reconciliation before resolving an ERP exception. Physical checks select the exact order and fulfillment key; another fulfillment in the same order cannot supply its proof. A later matching result never automatically resolves an earlier investigation.
- Legacy task and exception transitions now lock their rows before checking terminal state, preventing a concurrent acknowledgement from resurrecting a completed item. New commands also enforce observed status and actor-scoped idempotency.
- The Operations Control page includes candidate task creation and separate task/exception queues with source evidence links, explicit role/date controls, bounded pagination, request errors and protected retry identity. No source mutation is hidden behind completion.

## Verification

- Fresh disposable PostgreSQL 0→121 and 162 real database baseline assertions PASS. Affected compatibility/HTTP/work-item run: **5 suites / 21 tests PASS**. Final exact-fulfillment/privacy run: **3 suites / 18 tests PASS**. Disposable database cleanup PASS.
- Real tests cover concurrent command replay and unique audit, stale evidence, audit rollback, assignment replay/body conflict, terminal-state rejection, completion independence, private-field exclusion, keyset horizon, actual synthetic adapter acknowledgement plus partial→matched reconciliation, both resolution APIs, exact physical source selection and a concurrent legacy acknowledgement race.
- Authenticated HTTP tests cover Finance/Compliance commands, denied Order Operations/anonymous access, request whitelisting, safe references and stale-state conflicts.
- Admin **2 files / 4 tests PASS**, including uncertain-response retry identity, changed assignment identity, Taipei date conversion, expected status, blocked-resolution explanation and terminal actions. API/Worker/shared/backend and Admin production builds PASS. OpenAPI generation/preflight and security preflight PASS. No migration.
- Logs: `C:\UCell\logs\cr-batch-operations-work-validation.log`, `cr-batch-operations-work-final-db.log`, `cr-batch-operations-work-admin-test.log` and corresponding build/OpenAPI/security logs.

This closes the ERP work-item increment only. Bank/typed-source monitoring, broader Operations integration, source drilldown, complete browser journeys and final whole-batch recertification remain IN_PROGRESS. Stage RC remains NOT_READY; no Stage or Production deployment occurred.
