# Provider Integration Matrix

Status: DRAFT — no provider is certified or production-enabled.  
All formal credentials: **OPERATIONAL_CREDENTIAL_PENDING**.

| Domain | Provider/channel | Repository boundary | Contract/runtime status | Credential/UAT status | Next executable slice |
|---|---|---|---|---|---|
| Identity | LINE Login + LIFF + OA | LINE token verifier, ProviderIdentity, opaque Member session | Connected DEV infrastructure exists | OPERATIONAL_CREDENTIAL_PENDING | Register Stage LIFF/callback; valid/invalid/expired/replay/unbound/disabled/session-expiry UAT |
| Payment | LINE Pay | Existing `PaymentProviderAdapter` (`LINE_PAY`) | Contract only; no certified adapter/runtime enablement | OPERATIONAL_CREDENTIAL_PENDING | Official signature/query/refund adapter plus sandbox Golden |
| Payment | Taishin e-commerce | Existing adapter enum `TAISHIN_ECOM`, canonical decision and persistence | Canonical foundation only; no certified bank adapter | OPERATIONAL_CREDENTIAL_PENDING | Obtain merchant/API version and official signing vectors; implement verification/query/refund/reconcile |
| Payment | Taishin POS | Existing adapter enum `TAISHIN_POS` and controlled evidence concept | Contract/foundation only | OPERATIONAL_CREDENTIAL_PENDING | Approve terminal/batch reconciliation SOP and authoritative paid threshold |
| Payment | ECPay | Existing `PaymentProviderAdapter` (`ECPAY`) | Contract only; no certified adapter/runtime enablement | OPERATIONAL_CREDENTIAL_PENDING | Build payment adapter independently from invoice/logistics adapters |
| Invoice | ECPay e-invoice | `InvoiceProviderAdapter` | Contract only | OPERATIONAL_CREDENTIAL_PENDING | Approve issue/void/allowance policy; implement sandbox adapter and reconciliation |
| Invoice | Chunghwa Telecom | `InvoiceProviderAdapter` provider `CHT_EINVOICE` | Dedicated provider identity added; adapter/runtime not implemented | OPERATIONAL_CREDENTIAL_PENDING | Freeze official product/API revision; add adapter without changing canonical invoice lifecycle |
| Logistics | Black Cat | `LogisticsProviderAdapter`, provider `BLACK_CAT` | Contract only | OPERATIONAL_CREDENTIAL_PENDING | Confirm direct/aggregator route, service constraints, label/tracking/cancel/return UAT |
| Logistics | 7-ELEVEN | `LogisticsProviderAdapter`, provider `SEVEN_ELEVEN` | Contract only | OPERATIONAL_CREDENTIAL_PENDING | Store validation/snapshot, label/tracking/return-to-sender UAT |
| Logistics | ECPay Logistics | Provider `ECPAY_LOGISTICS` | Contract only; optional route | OPERATIONAL_CREDENTIAL_PENDING | Decide whether approved route is direct or aggregator; do not duplicate shipment truth |

## Capability coverage

Legend: **FOUNDATION** = canonical code exists; **CONTRACT** = interface only; **GAP** = not implemented; **PENDING** = needs external/operational evidence.

| Capability | LINE | Payments | Invoice | Logistics |
|---|---:|---:|---:|---:|
| Provider-neutral contract | FOUNDATION | FOUNDATION | CONTRACT | CONTRACT |
| Versioned connection/config | Partial | FOUNDATION | Registry foundation | Registry foundation |
| Official signature/token verifier | PENDING | PENDING | PENDING | PENDING |
| Reference-only certification harness | FOUNDATION | FOUNDATION | FOUNDATION | FOUNDATION |
| Canonical event identity/hash | Token exchange foundation | FOUNDATION | Shared ingress foundation | Shared ingress foundation |
| DB persistence/unique operation claim | Session/token evidence | FOUNDATION | GAP | GAP |
| Transactional outbox bridge | Session flows present | Payment foundation present | GAP | GAP |
| Query/reconciliation | N/A for login | Contract/foundation | Contract only | Contract only |
| Refund/void/allowance/return | N/A | Contract only | Contract only | Contract only |
| Concurrent duplicate delivery evidence | Connected DEV tests | Focused DB tests exist | GAP | GAP |
| Official sandbox/UAT | PENDING | PENDING | PENDING | PENDING |
| Production enablement | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

## Provider-specific evidence required before enablement

### LINE

- OA, Login Channel and LIFF ownership and linkage.
- Channel/LIFF IDs and secret/reference in Stage Key Vault.
- Registered HTTPS endpoints and official ID-token verification evidence.
- Identity binding/recovery SOP and real-device LIFF tests.

### Payment providers

- Approved API/product version, merchant identity and currency support.
- Exact signature/checksum canonicalization, encoding, timestamp/nonce and key rotation.
- Provider transaction and operation identity rules for pay/capture/cancel/refund.
- Callback retry/ack behavior, query API, settlement/reconciliation files and sandbox vectors.

### Invoice providers

- Approved provider/product/API version, business identity and number-track responsibility.
- Buyer/tax/carrier/donation policy, issue trigger, rounding and retention.
- Void, partial/full allowance, lost-response retry and reconciliation rules.

### Logistics providers

- Direct or approved aggregator route, account/service codes and service limits.
- Store validation/map behavior for CVS, immutable store snapshot requirements.
- Label format, tracking event identity/order, cancel, return-to-sender and reverse-logistics behavior.

## Explicit non-claims

- Provider-neutral unit/DB tests do not equal provider certification.
- An adapter class or sandbox fixture does not equal a signed provider UAT PASS.
- ECPay payment, invoice and logistics remain separate adapters even if one vendor supplies all three.
- No provider may directly create Consumption/Volume/Bonus facts.
- Production remains blocked until formal credentials, security E2E, reconciliation, UAT and approval evidence pass.
