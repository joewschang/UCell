# R1.0B Decision Register v3 implementation report

## Connected evidence checkpoint — 2026-09-17

- `SALE_CONFIRMED` now enters an idempotent ConsumptionRecognition transaction instead of writing GPV directly from payment/order existence.
- The transaction updates the Qualification/Asia-Taipei month accumulator, creates same-event Active evidence at the NT$2,000 threshold, persists only concrete GPV/RPV/EPV classification and rejects generic PV/BV.
- Tests prove pre-threshold inactive, threshold transaction active, subsequent active, next-month reset, Ball isolation and historical GPV no-duplicate reuse.
- Business Calendar persistence now seals immutable version/date evidence, canonical 10/25 settlement classification and nominal/adjusted payout anchors; retry and delayed execution preserve the original anchor.
- Global settlement, member awards and the initial Reservoir A effect commit in one Serializable transaction. Duplicate/concurrent delivery is exactly once; missing/tampered evidence fails closed; Welfare remains accrual-only.
- Database/API/Worker builds PASS. Combined Connected DB regression: 6 suites / 37 tests PASS.
- Remaining v3 closure: immediate GPV Referral/Matching theory and Binary ancestor ledger, fixed-generation zero evidence, POSTED-return Active/Global/Reservoir/Welfare replay, complete mandatory Golden 17 and full gates.

## Evidence foundation checkpoint — 2026-09-17

- Baseline: Decision Register v3, no pending product decisions.
- Added migration 41 with immutable/idempotent ConsumptionRecognition, concrete volume classification sidecar, Qualification-month accumulator, Active interval, fixed-generation theory evidence, Binary volume ledger, BusinessCalendarVersion/date, settlement calendar evidence, payout anchor and Reservoir A ledger effect.
- Historical GPV rows are not duplicated or economically migrated.
- Existing Global/Welfare records and all new evidence receive append-only database protection.
- Global empty rank slices are now undistributed rather than redistributed to later recipients; the pool reconciliation equation remains enforced.
- Added Asia/Taipei Sunday-week, canonical 10/25 settlement and fixed payout-batch domain resolvers with business-day adjustment and fail-closed missing-calendar behavior.
- Validation: Prisma/schema/migration preflight PASS; fresh 0→41 and existing DB Golden PASS; shared calendar 14/14 PASS; Global focused 15/15 PASS.
- Stage deployment: deferred until all v3 service/worker/golden gates pass. Production Promotion remains BLOCKED.

Next: connect recognition/Active/theory/Binary ledger transactions; persist settlement/payout calendar anchors; persist Reservoir A exactly once and extend return replay.
