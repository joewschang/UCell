# Period job process timing — 2026-10-01

Scope: durable **job process-status** evidence supporting FER-18. This is not full Compensation Period stage-duration certification.

## Implementation

Migration 125 adds trigger-owned append-only `integration.period_job_process_transition` evidence. New period-job Outbox inserts and actual process-status changes record a monotonic per-Outbox revision, old/new status and database clock timestamp in the same transaction as the change. Rollback removes both; same-status attempt/heartbeat changes do not invent a new entry. Concurrent updates serialize on the original Outbox row. Existing period-job Outbox identity cannot be reassigned.

Upgrade observes existing status with **null enteredAt**. It never backfills an entry time from period end, availableAt, createdAt, processedAt or receipt time. A later actual transition starts known evidence. UPDATE/DELETE/direct INSERT of timing evidence are rejected. No historical migration or financial fact is rewritten.

Compensation Period and Operations readers select only the latest revision under their existing Repeatable Read boundary. They expose enteredAt/elapsedSeconds only when that revision agrees with current process status and its database timestamp is no later than the read's data-through. Missing/legacy/inconsistent evidence returns UNAVAILABLE with null time. Private Outbox/transition identifiers, raw payloads and errors are not exposed. Timing is outside controlled Task evidence hashes, so a changing elapsed duration does not alone invalidate a source candidate.

Admin separates process-state timing from approved eligibility age, recognition/dependency waits and the overall financial lifecycle. Existing period-end elapsed time retains its correct label. Status timing does not imply sealed completion, payment, ERP posting, SLA breach or overall financial closure.

## Remaining authority acceptance

FER-18 overall Compensation Period stage entry remains IN_PROGRESS. PENDING process state may include several different dependency/maturity waits; this implementation does not relabel them as one exact business-stage history. Overall PRECHECK/SETTLING/MATURING/payment/blocking transitions still require complete authoritative history and integrated actual-browser acceptance. Full isolated batch recertification and all other open scope remain required. No Stage/Production deployment is authorized or performed in this increment.

## Verification

Final frozen-code isolated PostgreSQL: **10 suites / 116 tests PASS**, including 24 actual Worker process-death/redelivery cases, fresh **0→125**, **162 baseline assertions**, per-suite isolation and cleanup. **124→125 preservation and cleanup PASS** for all four legacy process statuses and unrelated Person data; legacy same-status writes retain unknown entry time.

Admin: **2 files / 5 tests**, typecheck and production build PASS. API/Worker builds and schema, migration, relation, enum, security and generated OpenAPI preflights PASS. Real DB cases cover same-status retry, concurrent single transition, rollback, direct insert/update/delete rejection, immutable identity, unavailable/inconsistent/future evidence, private API projections and real Operations Task/Exception flow.

An earlier overlapping run used an older service type snapshot and also timed out in a Worker teardown hook. Neither is counted as acceptance. The final frozen-code run supersedes both, completes all 10 suites and cleanup without increasing hook timeouts or weakening assertions.

Final log digests are recorded in `evidence/period-process-timing-20261001.json`. Actual-browser review of these new timing labels and complete business-stage monitoring remain open; production build/unit checks are not substituted for that requirement.
