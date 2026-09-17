# Connected Commerce Golden Journey

Status: DRAFT TEST SPECIFICATION — NOT EXECUTED AS PROVIDER UAT  
Formal provider evidence: **OPERATIONAL_CREDENTIAL_PENDING**.

## 1. Objective

Prove one deterministic Member transaction across identity, order, payment, invoice and fulfillment without allowing provider state to bypass UCell authorization or Core monetary boundaries. The first implementation may use one approved sandbox route, but each provider adapter is tested and enabled independently.

## 2. Preconditions

- Deploy the exact approved commit to isolated Stage/UAT; record commit and migration set.
- Use non-production Person A with two Qualifications (Ball 1 and Ball 2), Person B with a foreign Qualification, and authoritative Product/Package profiles.
- Stage provider connections are versioned and enabled only after config validation.
- Callback URLs, signing vectors and sandbox accounts are registered; formal credentials currently remain `OPERATIONAL_CREDENTIAL_PENDING`.
- Database, Key Vault, queues/outbox and observability are isolated from Production.
- Test inventory, delivery address/store and invoice buyer data use approved non-real fixtures.

## 3. Primary journey

| Step | Action | Required result/evidence |
|---:|---|---|
| 1 | Open LIFF and exchange a valid LINE ID token | Backend verifies token; returns opaque UCell session; raw token is not persisted/logged |
| 2 | Load Person A Qualifications and select Ball 1 | Backend proves ownership; all following views display Ball 1 context |
| 3 | Load Product/Package offer | Price, ProductProfile, PV/BV fields and eligibility are Backend-authoritative; UI performs no monetary calculation |
| 4 | Create Order using one idempotency key | Server validates product/version/price/Qualification; replay returns same Order; changed request under key conflicts |
| 5 | Create PaymentIntent through configured adapter | Canonical Payment remains pending; provider redirect data is safe and connection version recorded |
| 6 | Return browser to Member UI before callback | UI shows pending/processing; browser parameters cannot mark Payment PAID |
| 7 | Receive signed provider callback | Signature and order/amount/currency/operation binding pass; sanitized evidence and digest persist |
| 8 | Apply payment transition | Evidence, unique operation claim, canonical PAID transition, audit and outbox commit atomically |
| 9 | Redeliver callback and reconcile same transaction | Exact replay/query is no-op; no duplicate Payment effect, recognition or outbox business effect |
| 10 | Execute approved consumption/volume recognition | Separate Core events use versioned product/rule/parameter evidence; provider never calculates PV/BV/RPV/EPV |
| 11 | Request invoice issuance | Invoice remains independent; signed response/callback creates one ISSUED fact or a retryable exception |
| 12 | Reserve/pick/QC and create shipment | Approved inventory/QC evidence required; recipient/store snapshot immutable; one label/shipment claim |
| 13 | Process tracking events through DELIVERED | Verified normalized events are monotonic and idempotent; duplicate/out-of-order delivery cannot regress state |
| 14 | Read back in Member and Admin | Same Order shows canonical payment/invoice/shipment states; Qualification/Person authorization still enforced |
| 15 | Switch to Ball 2, then back to Ball 1 | Ball data remains isolated and Ball 1 read-back is deterministic |
| 16 | Attempt Person B Qualification/order access | Denied with existing 403/404 security policy; no evidence or side effect leaks |

## 4. Return, refund and adjustment extension

1. Create a Return with a unique idempotency key and allowed quantity/value.
2. Progress independently through `REQUESTED -> APPROVED -> RECEIVED -> POSTED -> REFUNDED` when those operational states are implemented.
3. Confirm only `POSTED` emits the canonical recognition reversal/replay trigger.
4. Recalculate original historical period from historical evidence; missing snapshot fails `HISTORICAL_SNAPSHOT_MISSING`.
5. Append delta Adjustment/Recovery/Clawback; do not rewrite original Award, Ledger or PAID record.
6. Send provider refund using a stable operation key. Timeout requires query/reconciliation before retry.
7. Issue invoice allowance/void according to approved policy; it remains separate from the Payment refund and Core replay.
8. If physical goods are returned, create reverse-logistics/receipt evidence separately.
9. Repeated and concurrent partial returns cannot exceed remaining reversible quantity/amount or duplicate clawback/refund/allowance.

## 5. Mandatory negative, retry and concurrency cases

| Case | Expected result |
|---|---|
| Invalid/expired/replayed LINE token | Deny; no session/identity mutation |
| Unbound/disabled Person, missing/wrong Qualification | Fail closed; no commerce mutation |
| Forged or foreign Qualification/order | 403/404 according to policy; no information leakage |
| Browser success without verified callback/query | Payment remains pending |
| Invalid/tampered signature or wrong merchant | Reject; safe audit/metric only |
| Callback amount/currency/order mismatch | Reject and route to exception; no paid transition |
| Exact duplicate callback | Same safe acknowledgement; no duplicate effect |
| Same provider event identity with changed payload | Conflict/security alert; no mutation |
| Webhook/query/reconciliation race | One operation claim and one canonical effect |
| Lost provider response | Reconcile before retry according to official contract |
| Transaction/outbox failure | Whole canonical transition rolls back; same key can safely retry |
| Provider unavailable/unknown status | Stable unavailable/pending result; no inferred success |
| Invoice lost response/duplicate callback | One invoice/action fact; query/reconcile before retry |
| Duplicate/out-of-order tracking | One event effect; terminal state does not regress |
| Concurrent last inventory reservation | At most one winner; losing Order has no partial reservation |
| Refund exceeds captured/remaining amount | Reject atomically |
| Repeated GET/read model request | No monetary or provider side effect |

## 6. Database assertions

- Exactly one canonical aggregate per UCell identity and approved provider reference.
- Provider evidence identity/hash and business operation claim uniqueness hold under real concurrent connections.
- State transition, domain audit and outbox insertion share one transaction.
- No raw secrets, LINE token, PAN/CVV, arbitrary provider payload or full address appear in logs, idempotency responses or ordinary evidence.
- Provider callback produces no direct Award/Ledger/Carry/Settlement write.
- Invoice, Payment, Shipment and Return lifecycles remain independently queryable and correlated.
- Qualification ownership and Ball isolation remain intact throughout mutation and read-back.
- Original monetary facts remain unchanged after return/replay; only append-only adjustments/recovery appear.

## 7. Gate reporting

Report each layer separately:

| Gate | Current disposition |
|---|---|
| Contract/unit tests | Run per adapter implementation; not a provider PASS |
| Isolated DB/idempotency/concurrency | Required before Connected DEV PASS |
| Mock/simulator journey | Useful engineering evidence only |
| Official sandbox/UAT | OPERATIONAL_CREDENTIAL_PENDING |
| Real LINE LIFF device test | OPERATIONAL_CREDENTIAL_PENDING |
| Finance invoice/reconciliation sign-off | OPERATIONAL_CREDENTIAL_PENDING |
| Logistics label/tracking/return sign-off | OPERATIONAL_CREDENTIAL_PENDING |
| Security E2E and UAT approval | BLOCKED |
| Production Promotion | BLOCKED |

The journey may be marked Connected DEV PASS only for the portions actually executed against isolated local/Stage infrastructure. It must not be labeled provider-certified or Production Ready until official credentials, sandbox/UAT evidence and approvals exist.

