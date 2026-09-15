# Reviewed Backend v0.6.10-R4 — Return / Workflow / Payout Operations

No R1.0B compensation percentage or economic matrix changed.

## Operational APIs
- Return queue/detail.
- Workflow queue/detail.
- Recovery aging.
- Payout batch queue/detail.
- Finance/Compliance approval.
- Export state.
- External payment reconciliation / PAID state.

## Correctness fixes found during v0.4 integration review
- Return reversal now uses `SettlementCalendarService`, replacing UTC-Sunday logic.
- Recovery creation initializes outstanding balance.
- Recovery creation made idempotent, with DB unique index.
- Payout requires two distinct approval actors.
- Finance/Compliance role rules enforced in service.
- PayableEntry transitions to PAID when external payment is reconciled.

## Important boundary
The backend records external payment/export references. It does not directly execute bank transfers.
