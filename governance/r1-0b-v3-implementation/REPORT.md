# R1.0B Decision Register v3 implementation report

## Immediate theory and historical replay checkpoint — 2026-09-17

- Authoritative GPV recognition now appends G1 Referral Theory, fixed-generation Referral Matching theory/zero evidence and Qualification-scoped Binary ancestor left/right ledger entries in the same Serializable transaction.
- Immediate processing creates no final K0, BonusAward or PAID entitlement. Missing historical Sponsor/Binary/Active/parameter evidence fails closed; retry is exactly once and same-Person Balls remain isolated.
- Referral and Binary Matching now retain fixed historical Sponsor generations. Inactive/unlocked failure produces zero evidence while traversal continues; no compression, substitution, redistribution or backfill occurs. Binary Matching uses Binary Paid and the frozen 15/10/5/5/5 rates/unlock depths.
- POSTED-return replay now appends whole-month EPV/consumption accumulator and superseding Active interval evidence where v3 recognition evidence exists. Pre-v3 facts retain the sealed legacy replay path instead of fabricating history. Existing PAID reductions continue through append-only Recovery/CLAWBACK.
- Database/API/Worker builds PASS; Matching/Return focused regressions 46/46 PASS; immediate GPV PostgreSQL regression 2/2 PASS.
- Remaining blocker: migration 41 cannot represent signed Global/Reservoir/Welfare replay deltas; a forward-only migration and replay integration are required.

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
