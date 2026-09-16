# R1.0B Decision Register v2 TODO Inventory

Original audited baseline: 148. Current executable TODO: 3. Net placeholder reduction: 145.

Classification is governance status, not implementation completion. Pending decisions fail closed and Legacy Test Drift must be corrected without changing the frozen business rules.

| Classification | Count |
|---|---:|
| IMPLEMENTABLE | 0 |
| ENGINEERING | 0 |
| PENDING_DECISION | 3 |
| LEGACY_TEST_DRIFT | 0 |

| File | Line | Case | Classification | Reason |
|---|---:|---|---|---|
| backend/apps/api/test/negative-flow-v05.e2e-spec.ts | 13 | partial return creates proportional negative GPV event | PENDING_DECISION | Historical GPV to formal PV/BV mapping is not approved; only this historical conversion remains fail-closed. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 170 | inactive upline receives 0 and is not compressed | PENDING_DECISION | Matching inactive-sponsor skip/stop/compression behavior remains explicitly pending. |
| backend/apps/api/test/vertical-slice-02.e2e-spec.ts | 171 | higher generation remains independently evaluated | PENDING_DECISION | Matching inactive-sponsor skip/stop/compression behavior remains explicitly pending. |
