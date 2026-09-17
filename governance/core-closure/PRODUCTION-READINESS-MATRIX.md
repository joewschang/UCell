# Production readiness matrix

| Gate | Status | Blocker |
|---|---|---|
| Core builds/tests | PASS | Executable TODO gate is zero; Backend Jest 17 suites / 189 tests pass with real DB evidence |
| Replay/carry closure | PASS | Period-wide K1/K2, convergence, max horizon, and resume executable |
| Production calendar | BLOCKED | Exact operational clock values pending |
| Remaining SA decisions | BLOCKED | Production cutoff values, historical GPV to formal PV/BV migration mapping, and Matching inactive-sponsor skip/stop/compression remain undecided; affected paths stay fail closed |
| Formal LINE LIFF | BLOCKED | Formal credentials and device evidence unavailable |
| Formal Entra/RBAC | BLOCKED | Formal credentials/evidence unavailable |
| Security E2E | BLOCKED | Formal identity environments unavailable |
| UAT | BLOCKED | UAT environment and sign-off unavailable |
| Backup/restore drill | BLOCKED | Automation/runbook and isolated restore evidence pending |
| Shadow settlement | BLOCKED | Non-empty production-cycle evidence unavailable |
| Production promotion | BLOCKED | Manual Go/No-Go prerequisites incomplete |
| Isolated Azure Stage infrastructure | PASS | East Asia `rg-ucell-stage`; migrations and public runtime smoke pass |
| Stage operational identity | BLOCKED | Formal LINE LIFF and Entra credentials/device evidence pending |
## Payment-to-Inventory delivery recovery — 2026-09-18

| Capability | Status | Evidence / limit |
|---|---|---|
| Failed delivery lease release and retry | CONNECTED DEV PASS | Real PostgreSQL regression; replenished retry creates one reservation/movement |
| Retry exhaustion | CONNECTED DEV PASS | Attempt 10 becomes `DEAD`; Payment/Order remain `PAID`, no inventory mutation |
| Stale worker lease fencing | CONNECTED DEV PASS | Lost lease returns fail-closed before Inventory effects |
| Production broker/workload execution | BLOCKED | Requires governed UAT/Stage workload evidence |
| Backend regression after recovery coverage | PASS | 43 suites / 382 tests on fresh isolated database; all 43 migrations applied |
