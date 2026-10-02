# ERP Sales / Return controls — 2026-09-30

Authority: §35 FER-3–10 of `UCELL_PHASE_1_RELIABLE_MVP_SCOPE_DECISION.md`. This is bounded implementation evidence, not full four-stream or Stage acceptance.

## Implemented

- Authenticated Admin API and management page can seal paid-order Sales and POSTED ReturnCase projections. Return business references are bound to the requested order. Compliance can read; Finance / Order Operations / Super Admin can command. Projection plus Outbox plus audit commit atomically; source transactions are unchanged.
- List and detail verify immutable payload/drillback hashes. Public output explicitly selects business fields and masks internal identifiers, actors, private source snapshots and provider credentials. Pagination fixes the creation horizon; `dataThrough` describes current mutable status reads.
- Controlled result entry requires a recorded accepted external reference. Currency, amount, unique line references and quantity are validated. Exact, partial and mismatched results remain append-only. Same-key replay returns the original outcome; conflicting reuse fails. Differences create an independent operational exception; a later match does not silently resolve it.
- Failed delivery can be requeued with an audited case reference and durable command key. Concurrency is serialized per projection. Payload, dispatch idempotency key and attempt count remain unchanged. Accepted documents cannot be requeued. A repeated command cannot requeue a later failure. Audit failure rolls back requeue.
- Admin actual values start blank. Users select and enter actual ERP lines; UCell expectations are never copied into submitted results automatically. The page shows expected versus actual currency/amount/quantity, hashes, source verification, open exceptions and retry controls. All displayed times use Asia/Taipei.

## Verification

- Disposable PostgreSQL fresh 0→119: **162 baseline assertions PASS**; HTTP / projection core **2 suites, 15 tests PASS**, cleanup PASS. Includes authentication, role separation, order-scoped Return references, exact command replay, result differences, concurrency, audit rollback, dispatch fencing and external-reference uniqueness.
- Admin **2 files, 5 tests PASS**: read-only controls, blank actual values, partial-line submission, visible unresolved exceptions and reasoned retry.
- API production build, Admin production build, generated OpenAPI, OpenAPI preflight, security policy preflight and diff whitespace checks PASS.
- Logs: `C:\UCell\logs\cr-batch-erp-business-final-tests-20260930.log`, `cr-batch-erp-business-admin-test.log`, `cr-batch-erp-business-api-build.log`, `cr-batch-erp-business-admin-build.log`, `cr-batch-erp-business-openapi-preflight.log`, `cr-batch-erp-business-security.log`.

## Remaining

Compensation aggregation / approved configuration, full four-stream acceptance, actionable Operations drilldowns and actual-browser journey verification remain open. Live EZTooL transport and exact ERP account mapping remain external dependencies. No Stage or Production deployment was performed. Overall local implementation and full recertification remain IN_PROGRESS; STAGE_RC remains NOT_READY.
