# Development Execution Plan — Rebaseline 2026-09-17

Status: ACTIVE ENGINEERING PLAN
Baseline branch: `integration/member-backend-mvp`

## Objective

Preserve the closed R1.0B Core while converting the implemented next-release domain decisions into durable, connected, credential-ready operations. Production Promotion remains blocked.

## P0 — Integrated baseline and Stage currency

Current checkpoint status (2026-09-17): local integrated gates are green. Stage deployment is deliberately pending until the hardened deployment path is reviewed and the required operational credentials/configuration are supplied.

Completed engineering closure:

- Fixed Prisma/import gate parsers and refreshed the authoritative OpenAPI artifact.
- Added the missing Worker poll path for `MEMBER_ORDER_CREATED` with lease-loss, retry and duplicate-delivery regression.
- Replaced the retired mutable golden seed in the RC gate with the deterministic isolated DB Golden runner.
- Split Admin and Member CSP policies and parameterized the connected API origin.
- Corrected Backend LINE/Entra environment names and removed the false non-empty-string credential success signal.
- Hardened Stage deployment around immutable source tags/digests, explicit revisions, bounded migration/health polling and deployment evidence.

Remaining before Stage rollout:

- Supply controlled Stage PII/share-token secrets and formal LINE/Entra configuration through Key Vault/managed identity.
- Execute schema conflict preflight against the existing 25-migration Stage database before applying migrations 26–39.
- Build/push immutable images, deploy a new revision, run browser-connected Admin/Member smoke and prove `MEMBER_ORDER_CREATED -> Worker -> Notification`.
- Preserve `OPERATIONAL_CREDENTIAL_PENDING` when formal LINE/Entra evidence is unavailable.

1. Run Backend, Worker, Admin and Member builds from the consolidated HEAD.
2. Run Prisma validate/generate and migrate a fresh isolated database from zero.
3. Run all Backend Jest, DB Golden, replay, Member/Admin, OpenAPI, Security and release gates.
4. Repair engineering regressions only; do not alter R1.0B rules.
5. Deploy the verified HEAD to the isolated Azure Stage environment and record revision/image digests.
6. Confirm Stage API health, Worker, Admin, Member and migration evidence.

Exit: clean branch, all non-credential gates pass, Stage runs the same commit as the repository checkpoint.

## P1 — Payment and Inventory durable transaction slice

Single Schema Owner controls all Prisma/migration changes.

1. Persist canonical provider identity/hash with a database uniqueness constraint.
2. Persist Payment transition and transactional outbox effect atomically.
3. Add webhook retry, duplicate delivery, lost response and rollback DB tests.
4. Add Warehouse, InventoryItem, InventoryBalance, InventoryReservation and InventoryMovement using forward-only migrations.
5. Implement deterministic row locking and movement idempotency.
6. Prove concurrent final-unit reservation/release against PostgreSQL.
7. Keep PICK/SHIP accounting timing configuration pending until approved.

Implementation packages (single Prisma schema owner):

1. Add forward-only Payment, PaymentAttempt, provider-event evidence, state-transition and operation-claim persistence alongside the legacy `PaymentEvent` during migration.
2. Prove Serializable manual-confirm/webhook races, provider-event uniqueness, payload-hash conflict, rollback and lost-response replay.
3. Add Warehouse, InventoryItem, InventoryBalance, Reservation/Line, append-only Movement and operation-claim persistence with database non-negative checks.
4. Prove canonical lock ordering, final-unit competition, duplicate release, deadlock resistance, rollback and retry.
5. Atomically emit transactional outbox facts from both domains, then connect the checkout-to-reservation slice.

Exit: connected DB evidence replaces pure decision-only evidence; provider credentials remain separately blocked.

## P2 — Member, Qualification and operational identity

1. Complete package purchase to Qualification/Ball setup connected journey.
2. Validate Sponsor prefill/manual selection and Binary placement ownership/concurrency.
3. Connect formal application review without weakening Person/Qualification separation.
4. Configure real Stage LINE OA/LIFF credentials in Key Vault and execute device UAT.
5. Configure Stage Entra applications/roles and execute Admin RBAC E2E.
6. Rerun BOLA/IDOR, expired session, disabled Person and wrong Qualification cases.

Exit: formal Stage identity and cross-end Member/Admin Golden Journey pass; no synthetic credential is reported as formal evidence.

## P3 — Fulfillment launch path

1. Inventory initial stock/count and reconciliation workflow.
2. Allocation, pick, serial/lot binding, packing and QC.
3. Integrate one approved shipping provider before adding the second.
4. Implement invoice provider abstraction and the selected provider adapter.
5. Connect Return/RMA POSTED to refund, invoice adjustment and existing Core replay/recovery.
6. Keep ERP/Dynamics 365 BC as an adapter track, not a prerequisite for ERP-less launch.

Exit: one complete paid-order-to-delivery-to-return Stage journey with provider sandbox evidence.

## P4 — Release readiness

1. Backup/PITR/logical backup and isolated restore drill.
2. Production-scale concurrency/workload evidence and outbox backlog monitoring.
3. Application Insights alerts, incident runbook and reconciliation reports.
4. Non-empty Shadow Settlement with automatic payout disabled.
5. Resolve production cut-off, historical GPV-to-PV/BV migration, and inactive Matching Sponsor semantics.
6. Formal UAT sign-off and manual Go/No-Go.

Exit: RC candidate evidence complete. Production deployment remains protected until formal authorization.

## Deferred

NASL/Sonar analytics, additional payment/logistics providers, LINE Push, large BI, realtime channels, AI recommendations and BC cutover remain behind the operational launch critical path unless promoted by an approved release decision.

## Checkpoint rule

Every stable batch updates its report/matrix, runs relevant focused tests plus the affected integration gates, commits, and pushes normally. No force push and no merge to `main`.
