# R1.0B Decision Register v2 TODO Inventory

Original audited baseline: 148. Current executable TODO: 10. Net placeholder reduction: 138.

Classification is governance status, not implementation completion. Pending decisions fail closed and Legacy Test Drift must be corrected without changing the frozen business rules.

| Classification | Count |
|---|---:|
| IMPLEMENTABLE | 0 |
| ENGINEERING | 5 |
| PENDING_DECISION | 3 |
| LEGACY_TEST_DRIFT | 2 |

| File | Line | Case | Classification | Reason |
|---|---:|---|---|---|
| backend/apps/api/test/epv-global-v05.e2e-spec.ts | 46 | non-REPURCHASE order does not create EPV | LEGACY_TEST_DRIFT | DEC-001 makes ConsumptionRecognitionEvent and eligible consideration authoritative; order purpose alone cannot decide eligibility. |
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 13 | partial return creates proportional negative GPV event | PENDING_DECISION | Historical GPV to formal PV/BV mapping is not approved; only this historical conversion remains fail-closed. |
| backend/apps/api/test/qualification-isolation.e2e-spec.ts | 21 | member share link is bound to selected qualification | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 40 | upgrade has no retroactive bonus effect | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 41 | transfer preserves qualificationId and tree positions | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/v060-adjustment-lifecycle.e2e-spec.ts | 42 | exit preserves qualification for company-held re-transfer | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 170 | inactive upline receives 0 and is not compressed | PENDING_DECISION | Matching inactive-sponsor skip/stop/compression behavior remains explicitly pending. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 171 | higher generation remains independently evaluated | PENDING_DECISION | Matching inactive-sponsor skip/stop/compression behavior remains explicitly pending. |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 143 | worker converts SALE_CONFIRMED to GPV_CREATED per order line | LEGACY_TEST_DRIFT | The assertion names a superseded schema/event boundary and must be rewritten against the canonical model. |
| backend/apps/api/test/vertical-slice.e2e-spec.ts | 144 | reprocessing same outbox event does not duplicate GPV | ENGINEERING | The governing behavior is already approved; remaining work is implementation or executable verification. |
