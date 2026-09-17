# UCell Commerce & Fulfillment Golden Journeys
Status: ACCEPTANCE BASELINE
Date: 2026-09-17

## C1 Online Taishin -> home delivery
Member confirms server-priced order/package selections and home delivery. Payment Hub creates TAISHIN_ECOM payment. Browser return alone does not mark paid; verified provider evidence/query/webhook establishes PAID idempotently. Inventory reserves. FulfillmentOrder allocated. Picker scans required SKU/lot/serial. QC passes. Invoice policy requests invoice. Black Cat adapter creates shipment/label. Parcel dispatch -> SHIPPED; tracking -> DELIVERED. Member sees tracking/invoice. All transitions auditable.

## C2 7-ELEVEN pickup
Member selects CVS_PICKUP and validated store snapshot. Paid order allocates inventory. Pick/QC/pack. Logistics adapter creates 7-ELEVEN shipment and label. Tracking normalized to domain states. Store change after shipment creation requires explicit provider-supported workflow, never silent address mutation.

## C3 Taishin physical POS
Authorized staff records order then card is processed on Taishin physical terminal. UCell stores only safe terminal/batch/transaction references and amount, not PAN/CVV. Payment evidence remains pending reconciliation until policy threshold satisfied. Duplicate manual entry cannot create duplicate payment/recognition. Provider/batch reconciliation detects difference.

## C4 ECPay payment
Same canonical Payment flow through ECPAY adapter. Provider-specific callback fields never leak into Order domain. Signature verification + idempotency mandatory. Switching provider does not change downstream Fulfillment/Invoice/Recognition contracts.

## C5 LINE Pay
Same canonical Payment contract through LINE_PAY adapter when enabled. Cancel/refund maps to canonical states/evidence. Provider credentials/configuration are environment-bound.

## C6 Serial/lot trace
Picker scans serial S1001 for SKU A. Backend validates SKU/lot/status/reservation and atomically binds it to FulfillmentLine. Duplicate scan/use on another shipment is rejected. After SHIPPED, trace query can answer product/SKU/lot/serial -> shipment/order/member under authorized masked access. Returned serial becomes RETURNED/QUARANTINED/RESTOCK per inspection policy.

## C7 QC fail
Pick complete but expiry/package integrity check fails. QcInspection=FAIL/HOLD; shipment creation/dispatch blocked. Supervisor resolves via replacement/re-pick/quarantine with evidence. No fake SHIPPED status.

## C8 Invoice issue and return
Invoice issued through ECPay/other adapter under invoice policy. Later Return reaches POSTED. Inventory/recognition reversal occurs at POSTED under Core policy. Payment refund and invoice allowance/void execute as separate idempotent actions; one failure does not erase other historical evidence and enters exception/retry queue.

## C9 Payment webhook race
Browser callback, webhook and reconciliation query arrive concurrently. Unique provider event/idempotency and Payment transition rules result in one canonical PAID transition and one downstream recognition/fulfillment trigger. No duplicate Ball, PV/BV, invoice or shipment.

## C10 Inventory race
Two paid orders compete for final unit. Transactional reserve grants one; other enters allocation/backorder exception according to policy. Available never negative. Do not promise shipment without reservation.

## C11 ERP-less operation
ERP Provider=NONE. UCell Inventory Lite is operational SoR for stock/reservation/movements, while Payment/Fulfillment/Invoice/Logistics run normally. Daily reconciliation/adjustment controls exist. Company can operate before BC deployment.

## C12 Dynamics 365 BC cutover
Integration is enabled for selected domains. Existing UCell IDs map to BC external IDs. Outbox sync is idempotent. Reconciliation passes before SoR switch. After approved cutover, BC is authoritative for configured Item/Inventory/Accounting domains; UCell local inventory becomes projection/cache/operational reference. Member/Qualification/Sponsor/Binary/Package/Bonus remain UCell. No historical UCell order/serial/payment evidence is rewritten.

## C13 BC outage
BC unavailable after cutover. Outbox queues events with retries; no synchronous dual-write rollback fiction. Behavior for new allocation/shipment follows configured fail-closed/degraded-mode policy. Recovery replays idempotently and reconciliation proves convergence.

## C14 RMA serial return
Member requests return. RMA approved/received; warehouse scans returned serial and checks it belongs to original shipment and has not already returned. At POSTED, disposition recorded. Refund/invoice/bonus replay workflows fan out independently with correlation ID.

## Required cross-gates
Payment provider signed evidence; exact-once business effect under at-least-once delivery; inventory non-negative; scan/serial uniqueness; QC required before dispatch; invoice lifecycle independent; shipment tracking normalized; RMA POSTED canonical; RBAC/manual overrides audited; BC outbox/reconciliation deterministic.