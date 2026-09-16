# Core Closure pass/fail matrix

| Gate | Result | Evidence |
|---|---|---|
| Database package build | PASS | `pnpm --filter @ucell/database build` |
| Backend API build | PASS | `pnpm --filter @ucell/api build` |
| Backend API Jest | PASS | 147 PASS / 39 TODO / 0 FAIL |
| Matching Sponsor traversal | PASS | Live settlement calls `sponsorAncestors`; five historical Sponsor recipients asserted |
| Matching historical replay evidence | PASS | Sealed Sponsor/Active/Qualification evidence accepted; Binary disagreement does not replace Sponsor semantics |
| Missing historical Sponsor evidence | PASS | Fails closed with `HISTORICAL_SNAPSHOT_MISSING` |
| K1/K2 complete period replay | PASS | All sealed Binary and Matching entitlements replayed through convergence |
| Carry convergence/resume | PASS | Immutable period checkpoints, same-run resume, and deterministic convergence boundary |
| Replay maxWeeks safety | PASS | `REPLAY_INCOMPLETE`; zero partial monetary postings |
| Return recalculation requests | PASS | Historical Binary/Matching periods, idempotent unique key, processed only after replay |
| Pending/PAID negative lifecycle | PASS | Append-only REVERSED or CLAWBACK/recovery; original PAID event immutable |
| Isolated DB Golden | PASS | Fresh DB, 25 migrations, deterministic fixtures and connected assertions |
| Security policy preflight | PASS | Automated policy preflight |
| R1.0B Golden/OpenAPI preflight | PASS | Both gates pass |
| Formal LINE/Entra/UAT | BLOCKED | Operational credentials/evidence unavailable |
| Production promotion | BLOCKED | Release prerequisites remain incomplete |
