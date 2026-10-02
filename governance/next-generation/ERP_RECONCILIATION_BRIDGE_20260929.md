# ERP Reconciliation Bridge — 2026-09-29

Authority: `UCELL_PHASE_1_RELIABLE_MVP_SCOPE_DECISION.md` §35. This is a local implementation checkpoint. It does not authorize EZTooL live transport or any Stage/Production deployment.

## Closed slice

The Admin read model `GET /api/v1/admin/erp-reconciliation` now reads existing immutable fulfillment handoff, Outbox, dispatch-attempt, reconciliation and Shipment facts. It does not create another ERP ledger and does not recalculate history from current product configuration.

The response deliberately separates:

- **UCell authority:** current Order and Fulfillment status;
- **ERP evidence:** stored request format/hash, provider acceptance attempt, stored reconciliation result and mismatch reason;
- **Shipment authority:** separately persisted logistics status and shipment count.

ERP acceptance therefore cannot imply `PAID`, `SHIPPED` or `DELIVERED`. Likewise, UCell `PAID` does not imply ERP acceptance. The UI states these boundaries and displays the three states in separate columns.

## Contract and privacy

- RBAC: `SUPER_ADMIN`, `ORDER_OPS`, `FINANCE`, `COMPLIANCE_AUDIT`; Member, Customer Service and Membership Operations are denied.
- The list accepts public `orderNo`, bounded `take`, lifecycle filter, `asOf` and continuation cursor.
- Page 1 establishes the snapshot cutoff; following pages reuse it. The cursor contains only requested time and public order/fulfillment business references.
- Responses exclude Person, internal Order/Fulfillment/Handoff/Outbox/Dispatch/Reconciliation UUIDs, actor IDs, recipient data, encrypted payloads, credentials, secret references and raw provider payloads.
- Exceptions are exposed only through a deterministic non-reversible safe reference plus stored reason code.
- Expected and actual quantities are read from the historical handoff/result snapshots.
- Generated OpenAPI is the SSOT: 216 paths, 234 operations and 113 schemas after this slice.

## Evidence

- API focused: `erp-reconciliation-bridge.e2e-spec.ts` — 1 suite / 4 tests PASS.
- Real PostgreSQL: `erp-reconciliation-bridge-db.e2e-spec.ts` — 1 suite / 1 test PASS after fresh 0→109 migrations; 162 baseline DB assertions and disposable-database cleanup PASS.
- Admin focused: `ErpReconciliationPage.test.tsx` — 1 test PASS.
- API production build PASS.
- Admin production build PASS.
- OpenAPI generation and preflight PASS.

The real-DB case proves a `PAID` UCell order, `MISMATCH` ERP result and `NOT_CREATED` Shipment remain independent while stored SKU/quantity/serial-count evidence is returned without internal identity or private purchaser data.

## Still open under §35

- `EZTOOL_LIVE_TRANSPORT = BLOCKED_EXTERNAL`.
- `ERP_ACCOUNT_MAPPING_REQUIRED` remains external/accounting authority work.
- Compensation Period Control, accounting projection batches, sales/return bridge streams beyond the existing fulfillment slice, and provider acceptance UAT remain separate work.

No Stage or Production resource was read or changed.
