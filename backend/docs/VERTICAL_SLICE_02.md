# Vertical Slice 02 — Membership Application → Active → Subscription → RPV

## 1. Membership Application
Flow:
DRAFT → SUBMITTED → APPROVED/EFFECTIVE

Approval performs one transaction:
- application state check
- Sponsor permanent sequence allocation
- Binary slot validation
- 1st/3rd direct-left validation
- Qualification creation
- Holder History
- Sponsor Relationship
- Binary Placement
- Audit

## 2. Active
Source of truth: `membership.active_period`.
`qualification.active_flag` remains a current projection only.

Historical bonus eligibility:
`active_from <= event_at AND (active_to IS NULL OR active_to > event_at)`

## 3. Prepaid Repurchase
Seeded plans:
- QUARTER: 6,000 / 3 months / 2 boxes
- HALF_YEAR: 12,000 / 6 months / 4 boxes
- YEAR: 24,000 / 12 months / 8 boxes

Every plan:
- 2,000 recognized per month
- 1,200 RPV per month
- never create all future RPV at payment date

## 4. R1.0B RPV
On each monthly recognition:
1. create one RPV ledger event for source Qualification;
2. trace Binary ancestors, maximum 12;
3. for each ancestor independently snapshot effective direct count;
4. direct count 0 => 5 generations;
5. direct count 1 => 8;
6. direct count 2+ => 12;
7. Active First at recognition event time;
8. each eligible generation theory/payable = NT$100;
9. inactive/ineligible generation gets 0;
10. no compression, no skip, no backfill.

## 5. Important implementation note
The current `effectiveDirectCountAt()` still derives qualification validity partly from qualification current status plus effective timestamp.
Before production it must be fully reconciled against temporal qualification status/exit history in the canonical database.
