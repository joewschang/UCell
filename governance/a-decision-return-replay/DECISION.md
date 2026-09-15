# SA A Decision — Return/Replay

Authority: user SA ruling in this task, 2026-09-15. This decision supplements SA-20260915-01/02 and does not authorize promotion.

1. K0/RPV replay uses the original transaction recognition month's historical Qualification, Binary Tree, Active and Parameter snapshots. EPV uses the original calculation period's Sponsor Tree, Active, Qualification and Parameter snapshots. Current state is never a substitute. Missing evidence must fail closed with HISTORICAL_SNAPSHOT_MISSING.
2. Historical entitlement corrections append only. Cumulative correction equals recalculated historical entitlement minus originally posted entitlement. Each additional event posts only the difference from corrections already posted. Original ledger and awards remain unchanged; PAID differences use clawback/offset without duplicate recovery.
3. Cumulative effective transaction state drives PV/BV/RPV/EPV and downstream awards. Original remaining reversible amount caps partial returns. Return event IDs and idempotency keys are unique.

## Traceability and implementation status

- Historical Qualification plan: `BonusQueryService.qualificationPlanAt` removes the current-plan fallback. Regression verifies the current lookup is never called. Isolated DB assertion verifies a current LEADER qualification without history is rejected.
- Historical EPV parameters: `ReversalService.processReturn` requires the original recognition audit snapshot. Missing snapshot is rethrown and rolls back the transaction instead of being converted into a successful pending marker. Regression verifies no processed audit or outbox is emitted.
- Return caps: `ReturnService.post` enforces cumulative original net amount, cumulative full-return status, duplicate-line rejection and global return-key collision detection. Existing Serializable idempotency transaction keeps failed writes atomic. Regression covers quantity-valid monetary over-return and successive partial full return.

## Remaining blockers — implementation not complete

- Complete immutable historical Qualification/Tree/Active envelopes are not captured by every original recognition/settlement path. Temporal-table queries alone do not prove the original snapshot. K0/RPV/EPV entitlement replay must not be declared complete.
- No shared append-only per-entitlement cumulative correction journal yet; multiple-return carry replay still has the existing guard. Do not remove that guard until incremental baseline and duplicate clawback assertions pass.
- Worker return/RPV handlers require the same snapshot validation and correction owner; API safeguards do not establish Worker coverage.
- RPV partial refund allocation across subscription recognition months and fixed award entitlement eligibility needs explicit SSOT support. Do not assume proportional fixed-100 awards.
- BV mapping is not represented by the existing GPV/RPV/EPV enum; no BV alias is inferred.
- Requested complete regression and DB assertions for historical routing changes, paid recovery and repeated partial entitlement replay remain outstanding. The added tests cover safeguards only.

Release/Production remain blocked. No RC2, merge, push or force push is authorized.
