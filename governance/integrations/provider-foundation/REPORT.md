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
