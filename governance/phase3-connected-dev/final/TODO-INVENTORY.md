Original baseline: 148. Current TODO: 52. Net placeholder reduction: 96.

The previous 52 TODO claim is invalid. Full behavioral coverage must be reviewed independently.

| File | Line | Case | Classification |
|---|---:|---|---|
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 325 | inactive recipient produces no Binary award | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/bonus-engine-v04.e2e-spec.ts | 338 | Sponsor Tree is used to trace matching uplines | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 22 | non-REPURCHASE order does not create EPV | Pending Decision: eligible scope / formal PV mapping |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 26 | global pool is 5% of period GPV | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 27 | weak thresholds are 300k/600k/1m/2m/4m | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 28 | rank achievement never downgrades | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 29 | monthly payout requires Active and current-month weak side threshold | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 30 | passed levels are cumulative | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 31 | empty rank slice rolls upward to next higher rank | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 32 | welfare 2% is accrued only; no distribution without a formal rule | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 10 | partial return creates proportional negative GPV event | Pending Decision: eligible scope / formal PV mapping |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 13 | PENDING_45D direct referral/equalization becomes REVERSED | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 14 | EFFECTIVE/PAYABLE/PAID direct award creates CLAWBACK and recovery ledger | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 16 | Binary and Matching create settlement recalculation requests instead of rewriting history | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 21 | EFFECTIVE awards become PAYABLE via payout batch | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 24 | mark-paid writes PAID lifecycle events | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/qualification-isolation.e2e-spec.ts | 21 | member share link is bound to selected qualification | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 40 | upgrade has no retroactive bonus effect | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 41 | transfer preserves qualificationId and tree positions | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 42 | exit preserves qualification for company-held re-transfer | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 47 | upgrade creates future plan history and does not alter past awards | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 48 | transfer preserves qualificationId and sponsor/binary positions | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 49 | exit closes holder interval and status becomes EXITED | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 50 | company retransfer opens a new holder interval | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 21 | return discovers every Binary ancestor impacted by descendant GPV | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 22 | period replay recomputes all Binary payable amounts when K1 changes | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 23 | period replay recomputes all Matching payable amounts when K2 changes | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 31 | propagation stops when left/right carry match original snapshots | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 32 | propagation respects maxWeeks safety horizon | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 33 | each replay period is append-only and replay run is resumable | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 34 | positive deltas post compensating awards and negative deltas post recovery | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v062-carry-chain.e2e-spec.ts | 43 | migration 0005 references subscription.subscription, not commerce.subscription | Legacy Test Drift: cancellation table moved to canonical subscription schema in 0006; retained pending coverage |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 45 | Taiwan local time maps to configured settlement week | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 25 | keeps Sponsor and Binary trees distinct | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 26 | validates Referral 15/20/25 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 27 | validates Equalization including Leader G5=10% | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 28 | validates Active First and no compression | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 29 | validates Binary Carry and K1 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 30 | validates Matching source=Binary Paid after K1 | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 31 | validates RPV 5/8/12 on Binary Tree | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 32 | validates EPV on Sponsor Tree | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 33 | validates refund -> replay -> recovery -> payout | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 128 | QUARTER creates exactly 3 recognition rows | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 129 | HALF_YEAR creates exactly 6 recognition rows | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 130 | YEAR creates exactly 12 recognition rows | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 136 | 0 direct unlocks 5 binary generations | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 137 | 1 direct unlocks 8 binary generations | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 138 | 2+ directs unlocks 12 binary generations | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 139 | inactive upline receives 0 and is not compressed | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 140 | higher generation remains independently evaluated | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 143 | worker converts SALE_CONFIRMED to GPV_CREATED per order line | Test implementation; SSOT/evidence review before conversion |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 144 | reprocessing same outbox event does not duplicate GPV | Test implementation; SSOT/evidence review before conversion |
