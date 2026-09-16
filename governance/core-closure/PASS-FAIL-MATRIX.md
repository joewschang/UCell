# Core Closure pass/fail matrix

| Gate | Result | Evidence |
|---|---|---|
| Database package build | PASS | `pnpm --filter @ucell/database build` |
| Backend API build | PASS | `pnpm --filter @ucell/api build` |
| Backend API Jest | PASS | 142 PASS / 42 TODO / 0 FAIL |
| Matching Sponsor traversal | PASS | Live settlement calls `sponsorAncestors`; five historical Sponsor recipients asserted |
| Matching historical replay evidence | PASS | Sealed Sponsor/Active/Qualification evidence accepted; Binary disagreement does not replace Sponsor semantics |
| Missing historical Sponsor evidence | PASS | Fails closed with `HISTORICAL_SNAPSHOT_MISSING` |
| K1/K2 complete period replay | PASS | All sealed Binary and Matching entitlements replayed through convergence |
| Carry convergence/resume | PASS | Immutable period checkpoints, same-run resume, and deterministic convergence boundary |
| Replay maxWeeks safety | PASS | `REPLAY_INCOMPLETE`; zero partial monetary postings |
| Isolated DB Golden | PASS | Fresh DB, 24 migrations, deterministic fixtures and connected assertions |
| Security policy preflight | PASS | Automated policy preflight |
| R1.0B Golden/OpenAPI preflight | PASS | Both gates pass |
| Formal LINE/Entra/UAT | BLOCKED | Operational credentials/evidence unavailable |
| Production promotion | BLOCKED | Release prerequisites remain incomplete |
