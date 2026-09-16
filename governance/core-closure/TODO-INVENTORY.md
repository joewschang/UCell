# R1.0B Decision Register v2 TODO Inventory

Original audited baseline: 148. Current executable TODO: 42. Net placeholder reduction: 106.

Classification is governance status, not implementation completion. Pending decisions fail closed and Legacy Test Drift must be corrected without changing the frozen business rules.

| Classification | Count |
|---|---:|
| IMPLEMENTABLE | 9 |
| ENGINEERING | 28 |
| PENDING_DECISION | 3 |
| LEGACY_TEST_DRIFT | 2 |

| File | Line | Case | Classification | Reason |
|---|---:|---|---|---|
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 22 | non-REPURCHASE order does not create EPV | LEGACY_TEST_DRIFT | DEC-001 makes ConsumptionRecognitionEvent and eligible consideration authoritative; order purpose alone cannot decide eligibility. |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 26 | global pool is 5% of period GPV | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 27 | weak thresholds are 300k/600k/1m/2m/4m | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 28 | rank achievement never downgrades | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 29 | monthly payout requires Active and current-month weak side threshold | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 30 | passed levels are cumulative | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 31 | empty rank slice rolls upward to next higher rank | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 32 | welfare 2% is accrued only; no distribution without a formal rule | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 10 | partial return creates proportional negative GPV event | PENDING_DECISION | Historical GPV to formal PV/BV mapping is not approved; only this historical conversion remains fail-closed. |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 13 | PENDING_45D direct referral/equalization becomes REVERSED | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 14 | EFFECTIVE/PAYABLE/PAID direct award creates CLAWBACK and recovery ledger | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 16 | Binary and Matching create settlement recalculation requests instead of rewriting history | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 21 | EFFECTIVE awards become PAYABLE via payout batch | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 24 | mark-paid writes PAID lifecycle events | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/qualification-isolation.e2e-spec.ts | 21 | member share link is bound to selected qualification | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 40 | upgrade has no retroactive bonus effect | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 41 | transfer preserves qualificationId and tree positions | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 42 | exit preserves qualification for company-held re-transfer | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 76 | upgrade creates future plan history and does not alter past awards | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 77 | transfer preserves qualificationId and sponsor/binary positions | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 78 | exit closes holder interval and status becomes EXITED | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 79 | company retransfer opens a new holder interval | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v063-golden-path.e2e-spec.ts | 45 | Taiwan local time maps to configured settlement week | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 25 | keeps Sponsor and Binary trees distinct | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 26 | validates Referral 15/20/25 | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 27 | validates Equalization including Leader G5=10% | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 28 | validates Active First and no compression | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 29 | validates Binary Carry and K1 | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 30 | validates Matching source=Binary Paid after K1 | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 31 | validates RPV 5/8/12 on Binary Tree | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 32 | validates EPV on Sponsor Tree | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 33 | validates refund -> replay -> recovery -> payout | IMPLEMENTABLE | Decision Register v2 and Core Logic Addendum v2 provide the governing rule; implementation and evidence remain. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 128 | QUARTER creates exactly 3 recognition rows | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 129 | HALF_YEAR creates exactly 6 recognition rows | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 130 | YEAR creates exactly 12 recognition rows | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 136 | 0 direct unlocks 5 binary generations | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 137 | 1 direct unlocks 8 binary generations | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 138 | 2+ directs unlocks 12 binary generations | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 139 | inactive upline receives 0 and is not compressed | PENDING_DECISION | Matching inactive-sponsor skip/stop/compression behavior remains explicitly pending. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 140 | higher generation remains independently evaluated | PENDING_DECISION | Matching inactive-sponsor skip/stop/compression behavior remains explicitly pending. |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 143 | worker converts SALE_CONFIRMED to GPV_CREATED per order line | LEGACY_TEST_DRIFT | The assertion names a superseded schema/event boundary and must be rewritten against the canonical model. |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 144 | reprocessing same outbox event does not duplicate GPV | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
