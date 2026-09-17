# UCell Provider Integration Foundation

Status: DRAFT — CONNECTED DEV FOUNDATION  
Date: 2026-09-18 (Asia/Taipei)  
Production Promotion: **BLOCKED**

## 1. Purpose and authority

This document defines the provider-neutral boundary for LINE OA/LIFF, online payments, e-invoice and logistics integration. It does not authorize a provider, deploy an endpoint, or change R1.0B monetary semantics.

The governing order remains: filed documents > formally approved company documents > R1.0/R1.0B system specification > SA Decision Log > discussion, poster, legacy documents and legacy tests. Provider documentation governs only its transport, signature and operation identity. It cannot define UCell recognition, volume, bonus, return or replay semantics.

## 2. Non-negotiable boundaries

1. `Person != Qualification`; Qualification ownership is verified by Backend for every scoped command.
2. Order, Payment, Consumption Recognition, Volume Recognition and Bonus are separate facts.
3. A browser return URL, LIFF profile or client claim is not authoritative evidence.
4. Provider evidence may drive a canonical commerce transition only after server-side verification.
5. Provider callbacks never write PV, BV, RPV, EPV, Award, Ledger, Carry or Settlement directly.
6. Return `POSTED` is the canonical trigger for volume/bonus reversal. Payment refund remains a separate lifecycle.
7. Monetary history is append-only. Original Order, Award, Ledger and PAID evidence are not rewritten.
8. Idempotency, transactional outbox, immutable evidence and deterministic retry remain mandatory.
9. Missing provider configuration, historical evidence or approved policy fails closed.
10. No PAN, CVV, track data, provider secret or raw identity token may enter logs, domain events, idempotency responses or ordinary database columns.

## 3. Existing repository foundation

| Capability | Current evidence | Current status |
|---|---|---|
| Member LINE session boundary | Backend token verifier, identity mapping and opaque UCell session | Connected DEV infrastructure; formal credential UAT pending |
| Payment contracts | `modules/payment-hub/payment-provider.adapter.ts` | Implemented provider-neutral contract |
| Payment canonical decision | canonicalizer, transition and provider-event decision pipeline | Implemented and covered by focused tests |
| Payment persistence | `Payment`, `PaymentAttempt`, provider evidence, transition and operation claim Prisma models | Implemented DB foundation |
| Provider enablement | payment registry with `ENABLED`, `CONFIG_PENDING`, `FEATURE_DISABLED` behavior | Fail-closed foundation |
| Shared provider ingress | `ProviderWebhookInbox` stores digest/safe metadata only; raw bytes are transient | Implemented DB foundation; adapter verification still required |
| Reconciliation evidence | `ProviderReconciliationRun` records provider/domain run status and discrepancy counts | Implemented DB foundation; provider query/file adapters pending |
| Invoice | `commerce/contracts/invoice.ts` | Contract only; no certified provider adapter/runtime |
| Logistics | `commerce/contracts/logistics.ts` | Contract only; no certified provider adapter/runtime |
| Return/replay | ReturnCase, POSTED reversal/replay and append-only adjustment infrastructure | Core-owned; provider refund and invoice allowance not yet end-to-end |
| Outbox | transactional outbox and worker lease/retry/dead handling | Existing shared infrastructure; commerce fan-out completion remains a gate |

Existing contracts must be extended rather than replaced with parallel provider-specific domain models.

Migration `20260918193000_provider_integration_foundation` adds only provider-neutral ingress and reconciliation evidence. It does not replace the existing Payment evidence/operation-claim path and does not authorize any provider domain effect.

## 4. Target component model

```text
Member/Admin Client
        |
        v
UCell API authorization + Qualification ownership
        |
        v
Canonical Commerce Application Services
  | Payment | Invoice | Fulfillment | Return/RMA |
        |
        +--> Provider Registry + versioned connection config
        |       +--> LINE Pay / Taishin / ECPay payment adapters
        |       +--> ECPay / CHT invoice adapters
        |       +--> Black Cat / 7-ELEVEN logistics adapters
        |
        +--> Verified Provider Event Inbox
        |       signature -> canonicalization -> identity/hash decision
        |
        +--> Serializable canonical transition
        |       aggregate + operation claim + audit + outbox atomically
        |
        +--> Reconciliation / retry / exception queue
        |
        +--> Core evidence port
                PaymentConfirmed / ConsumptionRecognition / ReturnPosted
                (Core remains monetary authority)
```

## 5. Canonical aggregates

### Identity

`LINE ID Token -> server verification -> ProviderIdentity -> Person -> opaque UCell session -> Qualification authorization`.

The system must reject invalid, expired or replayed exchange tokens, unbound identity, disabled Person, expired UCell session and non-owned Qualification. `liff.getProfile()` is display input only.

### Payment

Use existing canonical statuses: `CREATED`, `PENDING`, `AUTHORIZED`, `CAPTURED`, `PAID`, `FAILED`, `CANCELLED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`.

Provider observations are evidence, not state by themselves. One logical operation is protected by provider connection, transaction reference, formal operation identity, amount/currency binding and an atomic operation claim. Webhook, query and reconciliation may observe the same operation without multiplying effects.

### Invoice

Canonical status: `REQUESTED`, `ISSUED`, `VOIDED`, `ALLOWANCE_PENDING`, `ALLOWANCE_ISSUED`, `FAILED`.

Invoice issue, void and allowance are separate idempotent operations. An Order becoming PAID does not mean an invoice is ISSUED. Partial refund requires allowance/cumulative-cap handling under approved tax policy.

### Fulfillment and logistics

Shipping method is `HOME_DELIVERY` or `CVS_PICKUP`. Canonical shipment statuses are `READY`, `LABEL_CREATED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `DELIVERY_FAILED`, `RETURNING`, `RETURNED`, `CANCELLED`.

Recipient and pickup-store data are immutable snapshots. Tracking events require provider verification and monotonic normalization. Shipment creation requires approved inventory/QC evidence; no logistics callback may infer a payment or monetary result.

## 6. Ingress verification and persistence

Every provider ingress follows this sequence:

1. Capture raw bytes transiently at ingress with strict size/content-type/rate limits.
2. Resolve one versioned provider connection; missing/disabled config returns a stable unavailable error.
3. Verify signature/checksum/token using the official provider algorithm and referenced secret version.
4. Bind merchant/connection, provider transaction, UCell aggregate, amount/currency and operation identity.
5. Create sanitized evidence and cryptographic digest. Raw sensitive payload is not retained in normal tables or logs.
6. Canonicalize the event and compare its identity/hash with persisted evidence.
7. Exact replay returns the prior safe outcome; changed payload under one identity returns conflict.
8. In one Serializable transaction, persist evidence, claim the business operation, apply the canonical transition, append audit and enqueue outbox.
9. Acknowledge only according to the provider contract. Retry uses the same operation/idempotency identity.

Out-of-order or regressive events fail closed or become no-op according to the canonical transition table. Browser redirects are always non-authoritative.

## 7. Outbound calls and recovery

- External HTTP calls do not run inside a database transaction.
- Create/refund/void/allowance/shipment calls use stable idempotency keys.
- Timeout or lost response becomes `RECONCILE_BEFORE_RETRY` unless the official contract proves same-key retry safety.
- Worker delivery is at-least-once; business effects remain exactly-once through database uniqueness and operation claims.
- Provider outage, rejected signature, amount mismatch, unknown status and reconciliation discrepancy enter a safe exception path with actor/audit evidence.
- Credentials are secret references from environment/Key Vault, never returned by read models.

## 8. Environment and enablement

| Environment | Permitted evidence | Provider status |
|---|---|---|
| LOCAL | contract fixtures and explicit synthetic verifier | No provider PASS claim |
| CONNECTED_DEV | isolated DB, adapter simulators, negative/concurrency tests | No formal credential PASS claim |
| UAT/STAGE | real sandbox or approved UAT endpoint and registered callback | `OPERATIONAL_CREDENTIAL_PENDING` until evidence exists |
| PRODUCTION | production credentials, approval, reconciliation and monitoring | Disabled; Production Promotion BLOCKED |

Provider runtime state must be explicit: `FEATURE_DISABLED`, `CONFIG_PENDING`, `ENABLED`. `ENABLED` is permitted only when required config validates and the corresponding operational approval exists.

## 9. Observability and operations

Record correlation ID, provider, connection/config version, safe operation identity, canonical status, retry disposition, latency and evidence reference. Never log token, secret, full payload, payment card data or full delivery address.

Operations require read-only health and reconciliation views, failed event retry with RBAC, reason and audit, backlog/dead-letter alarms, provider latency/error metrics and daily settlement comparisons. Manual corrections append evidence; they do not edit the original fact.

## 10. Open decisions and blockers

- Formal credentials, merchant contracts, sandbox/UAT accounts, callback registration and official signing test vectors for every provider: `OPERATIONAL_CREDENTIAL_PENDING`.
- Invoice issue trigger, tax/rounding, void/allowance SOP and primary/failover selection require formal finance/tax approval.
- Inventory reservation/deduction point, partial fulfillment/backorder and warehouse/QC policy require formal operations approval.
- Exact provider operation-identity recipes and retry/ack rules must come from each approved provider specification.
- Production operational cut-off remains a separate Pending Decision and is not inferred here.
- Formal LINE/LIFF, payment, invoice, logistics, security E2E, UAT, reconciliation, backup/restore and Go/No-Go evidence remain required before Production.
