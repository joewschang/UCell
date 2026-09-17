# Provider Integration Foundation Report

Date: 2026-09-18 (Asia/Taipei)  
Branch: `integration/member-backend-mvp`  
Production Promotion: **BLOCKED**

## Completed in this checkpoint

- Preserved the existing Payment Hub, canonical transition, operation-claim and transactional-outbox implementation.
- Added provider-neutral webhook ingress metadata for Payment, Invoice and Logistics. Raw provider bytes are hashed in memory and never persisted by the service.
- Added provider-neutral reconciliation-run evidence with period/count/hash database guards.
- Added a fail-closed reusable registry for Invoice and Logistics adapters.
- Added the dedicated `CHT_EINVOICE` invoice provider identity.
- Added the Backend LINE Login channel variable to the environment template; no credential was supplied or claimed.
- Added architecture, provider matrix, credential checklist and Connected Commerce Golden Journey specifications.

## Database migration

`20260918193000_provider_integration_foundation`

New append-only/evidence-oriented tables:

- `commerce.provider_webhook_inbox`
- `commerce.provider_reconciliation_run`

The migration does not add or modify Award, Ledger, Carry, Settlement, PV, RPV or EPV data.

## Verification

| Gate | Result |
|---|---|
| Prisma format | PASS |
| Prisma validate | PASS |
| Prisma generate | PASS |
| Local migrate deploy (44 migrations) | PASS |
| Provider foundation + existing Payment focused tests | PASS — 24 tests |
| Complete Backend API | PASS — 386 tests / 44 suites |
| Schema / migration / source preflight | PASS |
| Isolated DB Golden | PASS — fresh database, all 44 migrations |
| Backend API build | PASS |
| Admin DEV API build | PASS |
| Local Admin API health | PASS — HTTP 200 |

## Deferred provider work

- Official LINE, LINE Pay, Taishin, ECPay, CHT, Black Cat and 7-ELEVEN adapters and credentials.
- Invoice/Fulfillment/Shipment durable aggregates and operation claims.
- Official signature/checksum vectors, callback acknowledgement rules and provider query/reconciliation ingestion.
- Finance/tax approval for invoice issue, void, allowance and rounding policy.
- Operations approval for inventory deduction, fulfillment and reverse-logistics policy.
- Formal Stage sandbox UAT and real-device LIFF evidence.

All external credentials remain `OPERATIONAL_CREDENTIAL_PENDING`. Provider-neutral tests are engineering evidence only and are not provider certification.

## Business logic changes

**NONE.** R1.0B recognition, monetary calculation, historical replay and Return POSTED semantics are unchanged.

## Invoice durable persistence checkpoint

- Added immutable, versioned Provider Connection records using secret references only.
- Added Invoice projection plus append-only provider evidence, transitions, allowances, voids and operation claims linked to the existing Outbox.
- Added fail-closed operation decisions for disabled/pending providers, missing evidence, changed-payload replay and destructive actions without approval evidence.
- Migration `20260918210000_provider_connection_invoice_persistence` applied successfully; total migrations: 45.
- Focused tests: 13 PASS. Complete Backend API: 395 PASS in 45 suites.
- Schema, migration and source preflights: PASS. Fresh isolated DB Golden: PASS.
- Invoice issue timing, tax/rounding and void/allowance policy remain configuration/approval pending; no policy was inferred.

## Fulfillment and shipment persistence checkpoint

- Added Fulfillment, Parcel and QC evidence persistence with immutable allocation, policy, content and package snapshot references.
- Added Shipment projection plus append-only tracking evidence, state transitions and operation claims linked to a single transactional Outbox event.
- Added fail-closed shipment decisions for provider configuration pending, incomplete QC evidence, changed-content idempotency replay, incomplete atomic claims, foreign callback identity and invalid status regression.
- Stale/out-of-order carrier facts remain evidence but cannot regress the canonical Shipment projection.
- Migration `20260918223000_fulfillment_shipment_persistence` applied successfully; total migrations: 46.
- Focused provider/shipment tests: 21 PASS. Complete Backend API: 407 PASS in 46 suites.
- Backend, Admin DEV API and database package builds: PASS. Schema, migration, source, security, OpenAPI and TODO preflights: PASS. Fresh isolated DB Golden: PASS.
- Inventory deduction timing, split-shipment policy, provider raw-status mappings, warehouse/lot/serial rules and direct-versus-aggregator routing remain pending; no operational policy was inferred.

## Provider verification and reconciliation checkpoint

- Added a provider-neutral webhook verification decision boundary that accepts only an explicit adapter `VERIFIED` verdict with complete event identity, payload digest, safe evidence, configuration version and canonical UTC timestamps.
- Added configured signature-age and future-skew checks without assuming any provider signing algorithm, canonical header format or callback acknowledgement contract.
- Exact durable redelivery is a no-op; changed payload, evidence, configuration or verification time under the same event identity fails closed.
- Added provider-neutral reconciliation ingestion with deterministic input/output/evidence hashes, exact replay, changed-run conflict and concurrent unique-insert recovery.
- Reconciliation writes only reconciliation evidence and exposes no monetary aggregate mutation path.
- Added isolated Shipment persistence DB verification: 21 assertions for append-only tables, claim/outbox uniqueness, provider-event uniqueness, immutable snapshot guards and CVS store evidence.
- Complete Backend API: 431 PASS in 48 suites. Shipment DB assertions, fresh DB Golden, builds and all existing preflight gates: PASS.
- Official provider signing vectors, mappings, callbacks, credentials and sandbox UAT remain `OPERATIONAL_CREDENTIAL_PENDING`.

## Webhook persistence and shipment integrity checkpoint

- Connected provider-neutral verification decisions to durable `ProviderWebhookInbox` state with compare-and-set concurrency protection.
- Persisted only safe verification hash and signed timestamp evidence; raw callback bytes, signatures and secrets remain excluded.
- Rejected callbacks remain terminal evidence but do not claim the unverified provider event identity, preventing forged rejection from blocking a later genuine event.
- Added composite Shipment foreign keys so Parcel and QC evidence must belong to the same Fulfillment.
- Added database guards binding Shipment provider/connection identity to its versioned LOGISTICS Provider Connection.
- Added real PostgreSQL reconciliation assertions for exact replay, changed-evidence conflict, eight-way concurrent ingestion, rollback and absence of monetary side effects.
- Focused provider regression: 49 PASS. Complete Backend API: 470 PASS in 51 suites. Shipment isolated DB: 27 PASS.
- Added migrations `20260918233000_provider_webhook_verification_evidence` and `20260918235000_shipment_aggregate_integrity`.

## Provider inbox lifecycle and connection identity checkpoint

- Added an explicit provider-neutral Inbox state machine and database trigger that prevents invalid status regression and protects verification evidence after leaving `RECEIVED`.
- Added real PostgreSQL verification persistence tests for VERIFIED/REJECTED replay, eight-way concurrent verification, forced rollback and provider-event identity collision.
- Added database guards that bind Webhook Inbox and Reconciliation evidence to the exact versioned Provider Connection domain/provider/connection key and prevent referenced connection identity drift.
- Rejected evidence continues to retain a null canonical provider event identity.
- Added migrations `20260919013000_provider_webhook_inbox_lifecycle` and `20260919020000_provider_ingress_connection_identity`.
- Provider identity DB: 11 PASS. Focused state/persistence/reconciliation tests: 52 PASS. Complete Backend API: 509 PASS in 53 suites.
- Fresh isolated database deployed all 51 workspace migrations; DB Golden, builds and existing release preflights PASS.

## Recoverable webhook worker lease checkpoint

- Added atomic `FOR UPDATE SKIP LOCKED` claiming for verified, due retry, and expired processing Inbox rows.
- Added paired lease owner/expiry evidence, attempt counters and database-clock compare-and-set finalization so a stale or foreign worker cannot commit an outcome.
- Successful work becomes `PROCESSED`; configured retryable failures become `RETRY_PENDING`; permanent, exhausted, or unknown outcomes become `MANUAL_REVIEW`.
- Lease recovery is deterministic after worker failure and finalization clears the lease without changing verification or provider identity evidence.
- Added provider-neutral outcome decisions only. Provider acknowledgement contracts, raw status mapping and domain or monetary side effects remain unimplemented until approved adapter contracts exist.
- Migration `20260919023000_provider_webhook_worker_lease` applied to the local Connected DEV database; fresh isolated databases deploy all 52 workspace migrations.
- Focused worker/lifecycle regression: 57 PASS across 3 suites. Worker PostgreSQL assertions: 30 PASS.
- Complete Backend API: 550 PASS in 57 suites. Isolated DB Golden: PASS with all 52 migrations.
- Corrected Windows/Jest test isolation: provider DB tests accept generated `ucell_jest_*` databases, and Phase 2 suites write separate evidence files instead of racing on one shared file.

Business logic changes: **NONE**. No provider policy, acknowledgement, mapping, monetary result or R1.0B rule was inferred.

## Provider consumer boundary and operations visibility checkpoint

- Added a provider-neutral batch runner that claims durable leases, requires an explicit registered handler outcome, and delegates all terminal/retry decisions to the existing versioned retry configuration.
- Missing handlers and unclassified exceptions fail closed to `MANUAL_REVIEW`; stale lease finalization is counted separately and cannot be reported as processed.
- The runner does not start itself, acknowledge provider callbacks, map provider status, or mutate payment, invoice, shipment or monetary aggregates.
- Added RBAC-protected read-only Admin endpoints for webhook health and backlog, including due work, expired leases, manual-review count and status/domain/provider aggregates.
- Operational responses intentionally exclude raw payload, payload/evidence hashes, safe evidence references and lease-owner identity.
- Focused Provider runner/lease/outcome regression: 29 PASS. Provider operations HTTP/service regression: 9 PASS.
- Complete Backend API: 571 PASS in 60 suites. Backend build, OpenAPI export/preflight, schema, migration, source, security and TODO gates: PASS.
- Fresh isolated DB Golden: PASS with all 52 migrations.

Business logic changes: **NONE**. Provider-specific handlers remain disabled until approved contracts, mappings and credentials exist.

## Admin Provider Operations console checkpoint

- Connected the approved read-only webhook health and backlog APIs to `/provider-operations` in the Admin Operations Console.
- Added health metrics, domain/provider/status/limit filters, searchable bounded DataGrid, truncated-result notice and shared loading/error/empty states.
- Page RBAC matches the Backend roles: `SUPER_ADMIN`, `ORDER_OPS`, `FINANCE`, and `COMPLIANCE_AUDIT`.
- Frontend contracts do not expose payload hashes, verification hashes, safe evidence references, raw callbacks or lease-owner identity.
- Complete Admin regression: 63 PASS in 22 files. Admin production build: PASS.
- At this checkpoint the UI remained read-only because a direct `MANUAL_REVIEW → PROCESSING` action would bypass worker ownership and audit guarantees. The later governed-retry checkpoint adds a safe `MANUAL_REVIEW → RETRY_PENDING` command instead.

Business logic changes: **NONE**.

## Governed manual webhook retry checkpoint

- Added a `SUPER_ADMIN`-only manual retry command for Inbox rows already in `MANUAL_REVIEW`.
- The command requires an idempotency key and an operator reason, writes append-only audit evidence, and schedules `RETRY_PENDING` without acquiring or impersonating a worker lease.
- The worker remains the only component allowed to claim the row and enter `PROCESSING`; the original error code and verification evidence remain immutable.
- The Admin console exposes the command only for eligible rows and uses the shared confirmation dialog with a mandatory reason.
- Real PostgreSQL assertions cover exact replay, changed-payload conflict, concurrent commands, audit/idempotency cardinality, forced rollback, lifecycle guards, and subsequent worker claim: 22 assertions passed.
- Complete Backend API: 573 PASS in 60 suites. Admin: 67 PASS in 22 files; typecheck and production build PASS. OpenAPI, schema, migration, source, security and TODO preflights PASS.
- Fresh isolated DB Golden deployed all 53 workspace migrations and passed deterministic fixtures, timezone, concurrency, return/outbox, membership, RPV, placement, checkout, Member/Admin integration, identity and replay-pool assertions.

Business logic changes: **NONE**. This is an operational recovery control and does not interpret provider status or write domain/monetary results.

## Safe Provider Inbox detail checkpoint

- Added an RBAC-protected read model for one Provider Inbox item with a bounded 50-event append-only operational audit history.
- The response exposes lifecycle, provider/connection identity, timestamps, correlation, retry count and sanitized actor/reason evidence only.
- Raw callback payload, signature, payload/verification hashes, safe evidence references and worker lease-owner identity remain excluded.
- Added a connected Admin Detail Drawer with shared Loading, Error and Empty states; the view is read-only and does not infer provider status.
- Backend focused regression: 12 PASS; complete Backend API: 574 PASS in 60 suites on isolated PostgreSQL. Admin: 68 PASS in 22 files; typecheck and production build PASS. OpenAPI and all schema, migration, source, security and TODO preflights PASS.

Business logic changes: **NONE**.

## Provider Worker runtime wiring checkpoint

- Moved the already verified provider-neutral outcome, lease and batch-runner primitives into the shared database package so API and Worker use one implementation.
- Wired the real Worker tick to the shared runtime with an explicit environment opt-in; the default is disabled.
- An enabled runtime requires an exact domain/provider/connection handler registry. Empty, duplicate or ambiguous configuration fails before any Inbox row is claimed.
- Lease duration, batch size, maximum attempts and retry backoff are bounded and validated. No provider acknowledgement, raw-status mapping or domain/monetary effect was introduced.
- Database, Worker and API builds PASS. Focused runtime/runner/lease/outcome regression: 33 PASS across 4 suites. Complete Backend API: 578 PASS in 61 suites on isolated PostgreSQL; schema, migration, source, security and TODO preflights PASS. Fresh Provider worker lease DB: 30 concurrency, reclaim, exclusion, retry and rollback assertions PASS.

Business logic changes: **NONE**. The registered handler list remains empty until an approved provider contract and credentials exist.
