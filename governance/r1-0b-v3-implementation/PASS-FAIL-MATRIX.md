# R1.0B v3 pass/fail matrix

| Gate | Result | Evidence |
|---|---|---|
| Decision Register v3 / SSOT pointers | PASS | recordVersion 3; `pendingDecisions=[]` |
| Code Gap Audit | PASS | `GAP_ANALYSIS.md` |
| Prisma v3 evidence schema | PASS | migration 41; validate/preflights; fresh DB |
| Historical GPV no duplicate migration | PASS | sidecar model is additive; migration performs no recognition backfill |
| Calendar/payout pure domain | PASS | 14 tests |
| Global no-redistribution calculation | PASS | 15 focused tests |
| ConsumptionRecognition connected flow | PENDING | service/worker integration not yet complete |
| Active same-event/month reset/replay | PENDING | service/DB golden not yet complete |
| Immediate GPV theory/Binary ledger | PENDING | service/worker integration not yet complete |
| Settlement/payout persisted anchors | PENDING | persistence/worker integration not yet complete |
| Reservoir A persistence/replay | PENDING | transaction/replay integration not yet complete |
| Full v3 mandatory Golden 17 cases | PENDING | implementation in progress |
| Stage redeployment/UAT | BLOCKED | waits for all v3 gates and formal credentials |
| Production promotion | BLOCKED | prohibited by release governance |
