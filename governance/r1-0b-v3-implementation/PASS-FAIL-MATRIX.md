# R1.0B v3 pass/fail matrix

| Gate | Result | Evidence |
|---|---|---|
| Decision Register v3 / SSOT pointers | PASS | recordVersion 3; `pendingDecisions=[]` |
| Code Gap Audit | PASS | `GAP_ANALYSIS.md` |
| Prisma v3 evidence schema | PASS | migration 41; validate/preflights; fresh DB |
| Historical GPV no duplicate migration | PASS | sidecar model is additive; migration performs no recognition backfill |
| Calendar/payout pure domain | PASS | 14 tests |
| Global no-redistribution calculation | PASS | 15 focused tests |
| ConsumptionRecognition connected flow | PASS | Serializable worker path and immutable concrete recognition evidence |
| Active same-event/month reset | PASS | boundary, reset and Ball-isolation DB tests |
| Active return replay | PENDING | POSTED-return interval recomputation not yet connected |
| Immediate GPV theory/Binary ledger | PASS | same-transaction Referral/Matching/Binary evidence; 2 DB tests |
| Fixed-generation Matching continuation | PASS | zero evidence, higher-generation continuation; 27 focused tests |
| Settlement/payout persisted anchors | PASS | 10/25 mapping, holiday adjustment, retry and delayed execution DB evidence |
| Reservoir A initial persistence | PASS | Serializable exactly-once/tamper/rollback DB evidence |
| Reservoir A return replay | PENDING | append-only replay delta not yet connected |
| EPV/Active POSTED-return replay | PASS | append-only whole-month accumulator/interval evidence |
| PAID negative replay | PASS | Recovery/CLAWBACK append; original PAID preserved |
| Full v3 mandatory Golden 17 cases | PENDING | implementation in progress |
| Stage redeployment/UAT | BLOCKED | waits for all v3 gates and formal credentials |
| Production promotion | BLOCKED | prohibited by release governance |
