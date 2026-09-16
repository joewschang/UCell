# Core Closure pass/fail matrix

| Gate | Result | Evidence |
|---|---|---|
| Database package build | PASS | `pnpm --filter @ucell/database build` |
| Backend API build | PASS | `pnpm --filter @ucell/api build` |
| Backend API Jest | PASS | 182 PASS / 5 TODO / 0 FAIL |
| Member build/tests | PASS | 116 tests |
| Admin build/tests | PASS | 22 tests |
| Worker build | PASS | TypeScript build |
| Prisma | PASS | validate, generate, deploy; 25 migrations, none pending |
| Versioned settlement timezone | PASS | TEST_ONLY Asia/Taipei parameter snapshot; local-midnight boundary; rollback |
| Golden DB-backed wrappers | PASS | Sponsor/Binary separation, Active First, K1 carry, Matching source, Return/Recovery |
| Frozen bonus Golden cases | PASS | Referral 15/20/25, Leader G5=10%, RPV 5/8/12, historical EPV Sponsor allocation |
| Qualification workflows | PASS | Future upgrade, transfer, company-held exit/retransfer; stable Qualification and placement graph |
| Payout lifecycle | PASS | EFFECTIVE materialization, PAID append, allocated entry transition, immutable Award; isolated DB evidence |
| Qualification-bound member share link | PASS | Encrypted Backend token; selected temporal holder only; foreign Qualification denied; configured key/base/TTL fail closed. |
| SALE outbox redelivery idempotency | PASS | Real PostgreSQL, production Worker handler and lease executed twice; one GPV row and one historical snapshot. |
| Matching Sponsor traversal | PASS | Live settlement calls `sponsorAncestors`; five historical Sponsor recipients asserted |
| Matching historical replay evidence | PASS | Sealed Sponsor/Active/Qualification evidence accepted; Binary disagreement does not replace Sponsor semantics |
| Missing historical Sponsor evidence | PASS | Fails closed with `HISTORICAL_SNAPSHOT_MISSING` |
| K1/K2 complete period replay | PASS | All sealed Binary and Matching entitlements replayed through convergence |
| Carry convergence/resume | PASS | Immutable period checkpoints, same-run resume, and deterministic convergence boundary |
| Replay maxWeeks safety | PASS | `REPLAY_INCOMPLETE`; zero partial monetary postings |
| Return recalculation requests | PASS | Historical Binary/Matching periods, idempotent unique key, processed only after replay |
| Pending/PAID negative lifecycle | PASS | Append-only REVERSED or CLAWBACK/recovery; original PAID event immutable |
| Isolated DB Golden | PASS | Fresh DB, 25 migrations, deterministic fixtures and connected assertions |
| Static/schema/migration/source preflights | PASS | All four automated preflights |
| Security policy preflight | PASS | Automated policy preflight |
| R1.0B Golden/OpenAPI preflight | PASS | Both gates pass |
| Formal LINE/Entra/UAT | BLOCKED | Operational credentials/evidence unavailable |
| Production promotion | BLOCKED | Release prerequisites remain incomplete |
| Azure Stage foundation | PASS | `rg-ucell-stage`: PostgreSQL 16, ACR, Container Apps environment, identity, Key Vault, Storage, telemetry |
| Azure Stage Prisma deploy | PASS | `ucell-stage-migrate-8d9rbhq` Succeeded; 25 migrations |
| Azure Stage runtime smoke | PASS | API health 200; Admin 200; Member 200; API/Worker/Admin/Member Running |
| Azure Stage formal identity | BLOCKED | LINE LIFF and Entra Stage credentials not yet supplied; `CredentialsVerified=false` |
