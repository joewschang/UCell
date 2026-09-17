# R1.0B Decision Register v3 implementation report

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
