# R1.0B v3 pass/fail matrix

| Gate | Result | Evidence |
|---|---|---|
| Decision Register v3 / SSOT pointers | PASS | recordVersion 3; `pendingDecisions=[]` |
| Code Gap Audit | PASS | `GAP_ANALYSIS.md` |
| Prisma v3 evidence schema | PASS | migrations 41-42; validate/preflights; fresh 0→42 |
| Historical GPV no duplicate migration | PASS | additive classification; no recognition backfill |
| ConsumptionRecognition / concrete volume | PASS | immutable GPV/RPV/EPV evidence; generic PV/BV cannot award |
| Active same-event/month reset/Ball isolation | PASS | mandatory Golden T01-T03 |
| Immediate GPV theory/Binary ledger | PASS | Serializable Referral/Matching/Binary evidence; no premature K0 |
| Fixed-generation Matching continuation | PASS | zero evidence and higher-generation continuation; no compression |
| Weekly calendar/caps | PASS | Sunday 00:00 boundary; 450k/900k/1.5m caps and display references |
| Settlement/payout persisted anchors | PASS | 10/25 mapping, holiday adjustment, delayed/retry stability |
| Reservoir A initial persistence | PASS | exactly-once/tamper/rollback DB evidence |
| Reservoir A/Welfare replay deltas | PASS | migration 42; 8 DB assertions; signed append-only deltas |
| EPV/Active POSTED-return replay | PASS | full historical month recomputation and interval evidence |
| PAID negative replay | PASS | append-only Recovery/CLAWBACK; original PAID preserved |
| Full v3 mandatory Golden 17 cases | PASS | `v3-mandatory-golden.mjs` and matrix |
| API isolated Jest | PASS | 38 suites / 343 tests |
| Member build/tests | PASS | build; 136/136 |
| Admin build/tests | PASS | build; 31/31 |
| Fresh isolated DB Golden | PASS | 42 migrations; deterministic suites; cleanup PASS |
| OpenAPI preflight | PASS | generated contract and preflight |
| Security policy preflight | PASS | automated policy gate |
| RC gate | PASS | build, Prisma, migrations, DB Golden, OpenAPI, smoke |
| Formal LINE/LIFF verification | BLOCKED | operational credentials pending |
| Formal Entra/RBAC verification | BLOCKED | operational credentials pending |
| Stage deployment harness | PASS | 19 preflight assertions; 7 upgrade/Golden tests; UAT seed guard PASS |
| Stage redeployment/UAT | BLOCKED | fresh interactive Azure login and Stage credentials/secrets required |
| Production promotion | BLOCKED | prohibited pending formal UAT/release decision |
| Boundary B01-B20 | PASS | half-open cut-offs, K0 window, Binary batching, Active/replay, Global conservation, multi-Ball/exit/security |
| Full isolated API after boundary closure | PASS | 39 suites / 354 tests |
| Decision v3 economic invariance | PASS | Mandatory Golden 17/17 on fresh 0→42 database |
| Boundary migration impact | PASS | no new migration; existing 42 deploy cleanly |
| Inventory PICK/SHIP timing | DEFERRED_BY_PRODUCT_OWNER | explicitly outside this Stage UAT batch |
| Stage manual Admin identity | EXTERNAL_CREDENTIAL_BLOCKED | formal Stage Entra test user required; bypass remains disabled |