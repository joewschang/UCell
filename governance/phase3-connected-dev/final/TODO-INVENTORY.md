Original baseline: 148. Current TODO: 109. Net placeholder reduction: 39.

The previous 52 TODO claim is invalid. Full behavioral coverage must be reviewed independently.

| File | Line | Case | Classification |
|---|---:|---|---|
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 5 | G1 STARTER Active receives GPV x 15% theory | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 6 | G1 ELITE Active receives GPV x 20% theory | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 7 | G1 LEADER Active receives GPV x 25% theory | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 8 | inactive G1 generates no referral bonus and equalization base is zero | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 9 | equalization base is same-source G1 referral theory, not GPV | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 10 | STARTER rates G2/G3/G4 are 10/10/10 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 11 | ELITE rates G2..G6 are 20/10/10/5/5 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 12 | LEADER rates G2..G7 are 20/15/10/10/10/5 including G5=10 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 13 | intermediate ineligible generation does not block higher generation | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 20 | Referral + Equalization share 42% pool and K0 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 24 | uses Binary subtree GPV, not Sponsor tree | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 25 | pair = min(left available,right available) subject to weekly cap | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 26 | paired PV deducted from both sides and strong-side carry remains | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 27 | STARTER/ELITE/LEADER weekly caps 450k/900k/1.5m | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 28 | Binary theory = paired PV x 12% | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 29 | Binary Pool is 36% and K1 <= 1 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 30 | inactive recipient produces no Binary award | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 34 | source is actual Binary payable after K1, never Binary theory | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 35 | Sponsor Tree is used to trace matching uplines | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 36 | rates are G1=15,G2=10,G3-G5=5 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 41 | Matching Pool is 15% and K2 <= 1 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 45 | award creates CALCULATED then PENDING_45D events | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 46 | after pending_until latest status becomes EFFECTIVE | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 47 | award row itself remains append-only | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 5 | EPV self share = 50% = 840 when Active | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 6 | EPV Sponsor G1-G5 each 6% when Active | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 7 | EPV does not use Binary tree | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 8 | non-REPURCHASE order does not create EPV | Pending Decision: eligible scope / formal PV mapping |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 12 | global pool is 5% of period GPV | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 13 | weak thresholds are 300k/600k/1m/2m/4m | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 14 | rank achievement never downgrades | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 15 | monthly payout requires Active and current-month weak side threshold | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 16 | passed levels are cumulative | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 17 | empty rank slice rolls upward to next higher rank | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 18 | welfare 2% is accrued only; no distribution without a formal rule | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 10 | partial return creates proportional negative GPV event | Pending Decision: eligible scope / formal PV mapping |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 13 | PENDING_45D direct referral/equalization becomes REVERSED | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 14 | EFFECTIVE/PAYABLE/PAID direct award creates CLAWBACK and recovery ledger | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 16 | Binary and Matching create settlement recalculation requests instead of rewriting history | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 21 | EFFECTIVE awards become PAYABLE via payout batch | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 24 | mark-paid writes PAID lifecycle events | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/organization.e2e-spec.ts | 4 | sponsor tree and binary tree remain independent | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/qualification-isolation.e2e-spec.ts | 21 | member share link is bound to selected qualification | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 2 | return never mutates original Binary settlement | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 3 | return never mutates original Matching settlement | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 4 | replay uses original carry-in and reversal PV events | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 5 | positive delta creates compensating award | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 6 | negative delta creates recovery | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 7 | future subscription recognition is cancelled, not deleted | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 8 | recognized RPV gets explicit reversal event | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 9 | upgrade has no retroactive bonus effect | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 10 | transfer preserves qualificationId and tree positions | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 11 | exit preserves qualification for company-held re-transfer | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 47 | upgrade creates future plan history and does not alter past awards | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 48 | transfer preserves qualificationId and sponsor/binary positions | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 49 | exit closes holder interval and status becomes EXITED | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 50 | company retransfer opens a new holder interval | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 2 | historical week includes later GPV_REVERSAL linked to original event | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 3 | return discovers every Binary ancestor impacted by descendant GPV | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 4 | period replay recomputes all Binary payable amounts when K1 changes | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 5 | period replay recomputes all Matching payable amounts when K2 changes | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 6 | next week carry-in uses prior recomputed carry-out | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 7 | propagation stops when left/right carry match original snapshots | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 8 | propagation respects maxWeeks safety horizon | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 9 | each replay period is append-only and replay run is resumable | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 10 | positive deltas post compensating awards and negative deltas post recovery | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 11 | original BinaryCarry, SettlementBatch and BonusAward remain untouched | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 15 | migration 0005 references subscription.subscription, not commerce.subscription | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 16 | Prisma schema contains adjustment/workflow/replay models | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 17 | RPV reversal anchor uses BonusAwardType.RPV, not EPV | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 2 | Taiwan local time maps to configured settlement week | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 3 | effective BonusAward materializes once | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 4 | RPV award materializes once | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 5 | payout groups by Qualification rather than Person | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 6 | Recovery offsets Gross without changing source Award | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 7 | Net payout never becomes negative | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 8 | temporal holder check denies former holder after transfer | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 9 | RBAC denies unauthorized admin operation | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 5 | keeps Person and Qualification distinct | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 6 | keeps Sponsor and Binary trees distinct | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 7 | validates Referral 15/20/25 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 8 | validates Equalization including Leader G5=10% | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 9 | validates Active First and no compression | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 10 | validates Binary Carry and K1 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 11 | validates Matching source=Binary Paid after K1 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 12 | validates RPV 5/8/12 on Binary Tree | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 13 | validates EPV on Sponsor Tree | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 14 | validates refund -> replay -> recovery -> payout | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 45 | APPROVE creates Qualification + Holder + Sponsor + Binary atomically | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 46 | 1st and 3rd direct-left rule is enforced during approval | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 74 | QUARTER creates exactly 3 recognition rows | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 75 | HALF_YEAR creates exactly 6 recognition rows | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 76 | YEAR creates exactly 12 recognition rows | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 77 | each due recognition creates exactly 1,200 RPV once | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 78 | 0 direct unlocks 5 binary generations | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 79 | 1 direct unlocks 8 binary generations | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 80 | 2+ directs unlocks 12 binary generations | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 81 | inactive upline receives 0 and is not compressed | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 82 | higher generation remains independently evaluated | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 83 | re-running a recognition cannot duplicate RPV or awards | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 7 | creates Person with idempotent command | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 8 | creates Qualification with permanent sponsor sequence | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 9 | rejects 1st direct placed on RIGHT | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 10 | creates order using server-side Product Rule Profile snapshot | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 11 | confirms payment exactly once | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 12 | writes SALE_CONFIRMED to transactional outbox | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 13 | worker converts SALE_CONFIRMED to GPV_CREATED per order line | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 14 | reprocessing same outbox event does not duplicate GPV | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 15 | PV ledger cannot be UPDATEd or DELETEd | Test implementation; SSOT/evidence review before conversion |
