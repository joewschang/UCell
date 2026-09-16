# Core Closure pass/fail matrix

| Gate | Result | Evidence |
|---|---|---|
| Database package build | PASS | `pnpm --filter @ucell/database build` |
| Backend API build | PASS | `pnpm --filter @ucell/api build` |
| Backend API Jest | PASS | 134 PASS / 50 TODO / 0 FAIL |
| Matching Sponsor traversal | PASS | Live settlement calls `sponsorAncestors`; five historical Sponsor recipients asserted |
| Matching historical replay evidence | PASS | Sealed Sponsor/Active/Qualification evidence accepted; Binary disagreement does not replace Sponsor semantics |
| Missing historical Sponsor evidence | PASS | Fails closed with `HISTORICAL_SNAPSHOT_MISSING` |
| K1/K2 complete period replay | IN PROGRESS | Existing period-wide arithmetic is executable; run/checkpoint/convergence closure remains |
| Carry convergence/resume | IN PROGRESS | Existing continuation DB evidence passes; persisted convergence/resume remains |
| Formal LINE/Entra/UAT | BLOCKED | Operational credentials/evidence unavailable |
| Production promotion | BLOCKED | Release prerequisites remain incomplete |
