# UCell R1.0B FROZEN — Backend v0.6.2

## Purpose
Close the most important historical-refund gap: a returned sale can alter a Binary ancestor's
weekly Pair and Carry, and that carry difference can affect later weeks.

## What changed

### 1. Economic attribution
A refund reversal may be posted weeks after the original sale.
Historical replay now selects the ORIGINAL GPV events in the target period and adds every
linked GPV_REVERSAL regardless of the later reversal timestamp.

### 2. Multi-ancestor impact
A descendant sale contributes volume to every Binary ancestor above it.
Return processing now creates recalculation requests for every impacted Binary ancestor,
not only for the purchasing qualification.

### 3. Period-wide K1 / K2 replay
When one or more Binary theory amounts change, K1 can change for every Binary award in that week.
v0.6.2 therefore recomputes:
- impacted Binary theories;
- period-wide K1;
- every Binary payable;
- Matching theory from recomputed Binary Paid;
- period-wide K2;
- every Matching payable.

### 4. Carry-chain propagation
For each impacted qualification:
recomputed carry-out of week N becomes replay carry-in of week N+1.
Replay continues until:
- carry equals the original snapshots for every impacted qualification; or
- no subsequent finalized Binary period exists; or
- maxWeeks is reached.

Original BinaryCarry rows are never modified.

### 5. Immutable replay trace
Added:
- `ledger.settlement_replay_run`
- `ledger.settlement_replay_period`

Every replay week stores K1/K2, impacted qualifications, carry delta and award delta snapshots.

### 6. Adjustment posting
Positive delta => compensating EFFECTIVE Award.
Negative delta => Recovery.
Original settlements and awards remain immutable.

### 7. Schema convergence fixes
- migration 0005 now references `subscription.subscription`;
- Prisma schema now includes v0.6 adjustment/workflow models;
- RPV reversal technical anchor uses dedicated `BonusAwardType.RPV`.

## Remaining before calling compensation core production-ready
1. First real `pnpm install` / Prisma generate / TypeScript compile / migration smoke in a network-enabled DEV environment.
2. Golden dataset with multiple ancestors, K1<1, K2<1 and multi-week carry propagation.
3. Reconcile timezone/week-boundary policy to the legal/operational settlement timezone (Taiwan) instead of relying on UTC-week helper code.
4. Payout integration for Global Pool and RPV award recovery under one unified payable ledger.
5. Production Auth/RBAC.
