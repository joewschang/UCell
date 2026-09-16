# R1.0B Decision Register v2 TODO Inventory

Original audited baseline: 148. Current executable TODO: 33. Net placeholder reduction: 115.

Classification is governance status, not implementation completion. Pending decisions fail closed and Legacy Test Drift must be corrected without changing the frozen business rules.

| Classification | Count |
|---|---:|
| IMPLEMENTABLE | 0 |
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
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 34 | EFFECTIVE awards become PAYABLE via payout batch | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 37 | mark-paid writes PAID lifecycle events | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/qualification-isolation.e2e-spec.ts | 21 | member share link is bound to selected qualification | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 40 | upgrade has no retroactive bonus effect | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 41 | transfer preserves qualificationId and tree positions | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 42 | exit preserves qualification for company-held re-transfer | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 86 | upgrade creates future plan history and does not alter past awards | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 87 | transfer preserves qualificationId and sponsor/binary positions | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 88 | exit closes holder interval and status becomes EXITED | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v061-replay.e2e-spec.ts | 89 | company retransfer opens a new holder interval | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 41 | validates Referral 15/20/25 | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 42 | validates Equalization including Leader G5=10% | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 57 | validates RPV 5/8/12 on Binary Tree | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v064-golden-dataset.e2e-spec.ts | 58 | validates EPV on Sponsor Tree | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
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
