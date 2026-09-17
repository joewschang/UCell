# Core Closure pass/fail matrix

## Latest HEAD Stage/UAT preparation

| Gate | Result | Evidence |
|---|---|---|
| Latest HEAD local preflight/OpenAPI/RC | PASS | 40 migrations and isolated DB Golden |
| Stage deployment static preflight | PASS | 19 assertions |
| Stage UAT seed safety | PASS | environment/host/database/destructive-operation guards |
| Stage Golden Journey runner contract | PASS | mocked API journey 3/3 |
| Latest HEAD Stage redeployment | BLOCKED | existing Stage DB administrator secret unavailable to this session |
| Formal identity Golden Journey | BLOCKED | Stage LINE/LIFF and Entra credentials unavailable |

## P1-E/G connected slice

| Gate | Result | Evidence |
|---|---|---|
| Verified PAID → Inventory reserve | PASS | connected PostgreSQL read-back |
| CAPTURED isolation | PASS | no Order PAID projection or reservation |
| Worker duplicate delivery | PASS | persisted `NOOP_REPLAY`; one reservation/movement |
| Insufficient stock boundary | PASS | payment retained; no reservation or false fulfillment |
| Database/API/Worker builds | PASS | shared inventory implementation compiles in all consumers |
| Connected focused regression | PASS | 7 suites / 47 tests |
| Provider sandbox/UAT | BLOCKED | formal provider adapter/credentials unavailable |

## P1-B/D transaction checkpoint

| Gate | Result | Evidence |
|---|---|---|
| API build | PASS | Nest build after Payment/Inventory merge |
| Payment persistence | PASS | 24 focused tests; Serializable duplicate/lost-response/conflict/rollback evidence |
| Inventory persistence | PASS | 35 focused tests; deterministic locks and persisted replay |
| Inventory PostgreSQL concurrency | PASS | 18 assertions including final-unit race and 20-delivery replay |
| Payment provider sandbox/UAT | BLOCKED | official provider adapter/specification/credentials unavailable |
| PICK/SHIP accounting | PENDING DECISION | intentionally not implemented in this checkpoint |

## P1-A persistence checkpoint

| Gate | Result | Evidence |
|---|---|---|
| Prisma schema/migration | PASS | validate/generate; migration 40; fresh 0→40 deploy |
| Payment persistence constraints | PASS | unique event/operation/idempotency/outbox references; append-only evidence |
| Inventory balance constraints | PASS | DB rejects negative/reserved-over-on-hand state |
| Inventory append-only evidence | PASS | DB rejects movement mutation |
| Existing DEV migration | PASS | migration 40 applied; status up to date |
| Provider/UAT evidence | BLOCKED | no provider-specific credentials/specification verified |

## 2026-09-17 consolidated P0 checkpoint

| Gate | Result | Evidence |
|---|---|---|
| Backend/Worker build | PASS | dependency gate and corrected RC gate |
| Admin build/tests | PASS | 31/31 |
| Member build/tests | PASS | 136/136 baseline |
| Backend API Jest | PASS | 297/297 baseline plus Worker entry regression 3/3 |
| Prisma | PASS | validate, generate, deploy; 39 migrations |
| Isolated DB Golden | PASS | fresh database; 39 migrations; >=690 HTTP/DB assertions |
| Convergence/import/OpenAPI drift | PASS | corrected parsers and refreshed OpenAPI artifact |
| RC gate | PASS | deterministic isolated DB Golden replaces retired seed |
| Stage deployment static preflight | PASS | 16 assertions; PowerShell syntax PASS |
| Stage current-version rollout | BLOCKED | immutable-image redeploy and migrations 26–39 not yet executed |
| Formal LINE/Entra Security E2E | BLOCKED | operational credentials unavailable |
| UAT/Production promotion | BLOCKED | formal credentials, UAT, restore/workload and release evidence incomplete |

| Gate | Result | Evidence |
|---|---|---|
| Database package build | PASS | `pnpm --filter @ucell/database build` |
| Backend API build | PASS | `pnpm --filter @ucell/api build` |
| Backend API Jest | PASS | 184 PASS / 3 TODO / 0 FAIL |
| Member build/tests | PASS | 116 tests |
| Admin build/tests | PASS | 22 tests |
| Worker build | PASS | TypeScript build |
| Prisma | PASS | validate, generate, deploy; 25 migrations, none pending |
| Versioned settlement timezone | PASS | TEST_ONLY Asia/Taipei parameter snapshot; local-midnight boundary; rollback |
| Golden DB-backed wrappers | PASS | Sponsor/Binary separation, Active First, K1 carry, Matching source, Return/Recovery |
| Frozen bonus Golden cases | PASS | Referral 15/20/25, Leader G5=10%, RPV 5/8/12, historical EPV Sponsor allocation |
| Qualification workflows | PASS | Future upgrade, transfer, company-held exit/retransfer; stable Qualification and placement graph |
| Payout lifecycle | PASS | EFFECTIVE materialization, PAID append, allocated entry transition, immutable Award; isolated DB evidence |
| Canonical recognition boundary | PASS | No eligible ConsumptionRecognition means no EPV accumulator input; PaymentConfirmed creates no volume ledger itself. |
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
| Local isolated Admin runtime | PASS | API 3001, Admin UI 4173, `ucell_admin_test`; full-access DEV banner visible |
| Local Member visual runtime | PASS | UI 5174, explicit mock visual fixture; not Connected/UAT evidence |
| Local page capture/user guide | PASS | 31 full-page screenshots: 10 Member at 390px, 21 Admin at 1440px |
| Admin applications envelope regression | PASS | `/applications` renders Backend `{data:[...]}` response; typecheck/build and 31 tests pass |
