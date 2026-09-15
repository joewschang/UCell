# UCell R1.0B — FROZEN SSOT

- Status: FROZEN
- Freeze date: 2026-09-07
- Backend baseline: v0.5.0
- Current increment: v0.6.0

## Governance
1. R1.0B is the only executable compensation-system source of truth.
2. V5.x, V6.x, A1, B1, C1/C2/C3, R1.0A and intermediate versions are historical only.
3. Bug/security/performance/UX fixes may not alter compensation outcomes.
4. Any future economic/rule change requires a new Rule Version; never overwrite R1.0B.
5. Historical ledger, award and settlement facts are immutable. Corrections use reversal, clawback or adjustment facts.
6. Every calculation must be reproducible from Rule Version, parameter snapshot, source events and temporal qualification state.

## v0.6 scope
- Binary/Matching Settlement Adjustment contract
- Subscription cancellation and RPV reversal queue
- Qualification Upgrade / Transfer / Exit / Company Re-transfer workflow contract
- Prospective-only changes; no backdating
