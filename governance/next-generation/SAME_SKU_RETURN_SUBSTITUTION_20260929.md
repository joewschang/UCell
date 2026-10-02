# Same-order same-SKU returned-unit substitution

Date: 2026-09-29

Authority: `UCELL_PHASE_1_RELIABLE_MVP_SCOPE_DECISION.md` §36

Rule version: `R1.0B_SAME_ORDER_SAME_SKU_V1`

## Result

The warehouse return receiver now accepts an eligible serialized unit from a different original OrderLine only when the physical unit and accepted ReturnLine belong to the same Order and Fulfillment, were bound to the same Shipment, and have the same SKU and Product. Both stored OrderLine rule and Commercial Offering snapshots must permit substitution. The unit must still be `SHIPPED`; recalled, quarantined, previously returned and unshipped units fail closed.

The POSTED ReturnCase and ReturnLine remain the economic authority. The original Fulfillment source allocation, OrderLine, Offering and purpose are never rewritten. Each accepted physical unit creates one append-only `ReturnSerialReceipt` with receipt type, governed rule version, eligibility evidence and evidence hash. The receipt links the accepted economic purpose to the immutable original physical provenance. Existing exact-source receipts retain `EXACT_SOURCE` legacy evidence.

Migration `20260929110000_same_sku_return_substitution` is forward-only. It adds receipt evidence fields and database checks, then replaces the existing insert validator with the approved exact-source or governed-substitution validation. Existing append-only UPDATE/DELETE protection stays enabled. No historical migration or receipt row is rewritten.

The Admin warehouse projection shows accepted quantity, received count, economic purpose and the business serial number. It distinguishes exact-source receipt from governed same-SKU substitution without exposing ReturnCase, ReturnLine, OrderLine, Shipment, allocation or SerializedUnit UUIDs. Warehouse command errors explain ambiguity, ineligible substitution, quantity limits and physical-state rejection.

## Evidence

- Fresh disposable PostgreSQL applied **109 migrations**.
- `fulfillment-serial-provenance-db.e2e-spec.ts`: **11 tests PASS**, including the final read-model privacy assertion.
- Covered exact receipt, same-order/same-Shipment/same-SKU cross-purpose substitution, immutable ReturnCase and physical source, evidence hash/rule, idempotent retry, concurrent quantity limit, stored-rule opt-out, recalled/quarantined rejection, already-returned rejection and privacy-safe Admin projection.
- Admin focused page: **7 tests PASS**; Admin full suite: **37 files / 144 tests PASS**.
- Full isolated API: **147 suites / 1,113 tests PASS**, with fresh 0→109 migrations, 162 baseline DB assertions and cleanup PASS.
- Dedicated 108→109 upgrade Golden preserves a pre-existing exact-source receipt byte-for-field on its historical columns, applies governed legacy defaults, keeps append-only mutation rejection active and cleans up the disposable database.
- Database/API/Worker/Shared/Contracts/Settlement production builds, DB Golden, security policy, migration/schema and generated OpenAPI preflights PASS.

## Boundaries

This change records physical receipt evidence. It does not change ReturnCase amounts, recognition, BonusAward, recovery, settlement or payout calculations. Those effects remain governed by existing append-only return/replay authorities. It does not add ERP internals or a live logistics adapter, and it is not deployed to Stage or Production.
