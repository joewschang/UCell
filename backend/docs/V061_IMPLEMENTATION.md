# UCell R1.0B FROZEN — Backend v0.6.1

## Completed in this slice
1. Deterministic Binary replay from:
   - original carry-in
   - immutable historical GPV ledger including negative reversal events
   - original weekly cap
   - frozen R1.0B pair rate
2. Recomputed K1 with adjusted impacted-member theory while preserving all other original theory.
3. Matching replay from recomputed Binary Paid and original per-award matching rates.
4. Recomputed K2 using adjusted source Matching theory.
5. Adjustment posting:
   - positive delta => compensating EFFECTIVE award
   - negative delta => Recovery
   - original settlement/award/carry remain untouched
6. Subscription cancellation:
   - future SCHEDULED recognitions => CANCELLED
   - affected RECOGNIZED months => `RPV_REVERSAL_REQUIRED`
7. Worker handles `RPV_REVERSAL_REQUIRED`:
   - creates immutable negative RPV ledger event
   - creates recovery facts for previously paid RPV-upline amounts
   - schedule => REVERSED
8. Qualification workflow APIs for UPGRADE / TRANSFER / EXIT / COMPANY_RETRANSFER.

## Explicit remaining engineering work
- Carry-chain propagation across weeks after a historical Binary adjustment.
  v0.6.1 computes the affected-period recomputed carry-out and records it in adjustment trace;
  v0.6.2 must propagate that carry delta into subsequent weekly replays until convergence.
- Global Pool / welfare payout unification with PayoutBatch.
- Formal auth/RBAC implementation and first full compile/migration smoke test in a network-enabled DEV environment.
