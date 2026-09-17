# UCell V1.1–V1.3 Sprint Plan
Status: PLANNING BASELINE — implementation gates apply
Date: 2026-09-17

## Gate 0 — Current R1.0B Core closure
Current Core Codex remains priority owner. Next-release schema changes require approved branch/checkpoint unless explicitly isolated. Core monetary modules remain protected.

## Track A — Member / Qualification / Growth
A1 shared contracts/event seams and LINE-first identity.
A2 Network Member registration + consent.
A3 Formal application/KYC/bank evidence.
A4 Configurable Package Management + Member Product Picker (啟航/菁英/領袖/季/半年/年活躍).
A5 Qualifying purchase -> Ball setup; Referral prefill/manual Sponsor selection; first Ball establishes Person referrer.
A6 Sponsor-owner manual Binary placement + 72h monitor/Admin override + system-auto no-referral path.
A7 Referral attribution/share/LIFF bridge.
A8 CMS/share.
A9 Activities.
A10 Inbox/announcements.

## Track B — Commerce & Fulfillment (parallel, domain-isolated)
B1 Commerce contracts/schema owner coordination: Payment/Inventory/Fulfillment/QC/Invoice/Logistics/RMA/ERP outbox; no monetary formula changes.
B2 Taishin online Payment Adapter + webhook/idempotency/reconciliation; Taishin physical POS evidence workflow.
B3 Inventory Lite + warehouse/item/lot/serial + reserve/release/movement concurrency.
B4 Fulfillment UI/API: allocation, pick list, barcode/QR scan, serial/lot binding, pack.
B5 QC gate: SKU/QTY/lot-serial/expiry/package/label checks and exception handling.
B6 Logistics adapters: Black Cat home delivery + 7-ELEVEN pickup (direct or approved aggregator adapter), label/tracking/webhook normalization.
B7 Invoice Hub: ECPay first candidate + provider abstraction; issue/void/allowance/query.
B8 Additional Payment adapters: ECPay and LINE Pay.
B9 Return/RMA integration: receive/serial verify/disposition -> POSTED -> refund/invoice adjustment/Core replay fan-out.
B10 ERP Integration Gateway + Dynamics 365 BC adapter contract, mapping/outbox/reconciliation/cutover tooling. BC deployment itself is later operational gate.

## Track C — Analytics / Operations
C1 Analytics projector/checkpoints/MetricDefinition.
C2 NASL current/transition/cohort/reactivation/churn.
C3 Sponsor Sonar 1–12.
C4 Binary Sonar 1–12.
C5 Growth/package/fulfillment funnels and exception trends.
C6 Health labels/Operations brief/hardening.

## Dependency graph
A4 Package/Product Picker must exist before full A5 qualification-package Golden and before Commerce package checkout Golden.
B2 payment canonical PAID contract must be stable before automatic fulfillment release.
B3 inventory reservation before B4 picking; B4 before B5 QC; B5 before B6 dispatch.
B7 invoice may develop parallel to B3–B6 but release policy must coordinate with paid/return states.
B9 depends on shipment/serial evidence and existing Core Return POSTED/replay contract.
B10 must not change UCell domain contracts; it adapts them to BC.
C analytics consumes source events only after contracts freeze.

## Parallelization / ownership
Track A and Track B may run concurrently after branch/schema ownership is assigned. Only one designated Schema Owner merges Prisma/migration changes; other streams submit schema proposals/patches through that owner. Track B must not modify Bonus/PV/BV/RPV/EPV/Carry/Settlement formulas. Track C does not mutate business truth.

Recommended immediate split after Gate/branch approval:
- Core Closure Codex: R1.0B only.
- Member/Growth Codex: A track.
- Commerce/Fulfillment Codex: B track.
- Analytics may wait or start event/projection scaffolding only.

## Every sprint evidence
REPORT; changed-file inventory; commit SHA; migration-from-zero; OpenAPI; unit/integration/HTTP/DB assertions; DB Golden; RBAC/BOLA; concurrency/idempotency; provider sandbox evidence when applicable; UI screenshots/responsive checks; unresolved decisions; PASS/BLOCKED matrix. Provider synthetic mocks can prove DEV behavior but never Production readiness.

## Production release gates
LINE: real LIFF credentials/device UAT.
KYC: legal/SOP/retention/RBAC.
Payment: provider production credentials, signed callback, refund and reconciliation.
Warehouse: inventory reconciliation, scan/serial/QC workload UAT.
Logistics: label/tracking/cancel/return UAT.
Invoice: issue/void/allowance UAT and accounting SOP.
ERP-less: backup/restore + daily inventory/payment reconciliation.
BC later: mapping/reconciliation/cutover/rollback approval.
Global: Security E2E, monitoring, incident runbook and formal Go/No-Go.