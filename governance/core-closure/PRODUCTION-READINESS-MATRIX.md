# Production readiness matrix

| Gate | Status | Blocker |
|---|---|---|
| Core builds/tests | PASS WITH TODO | 3 executable TODO remain, all Pending Decision; no IMPLEMENTABLE, ENGINEERING or Legacy Test Drift placeholders remain |
| Replay/carry closure | PASS | Period-wide K1/K2, convergence, max horizon, and resume executable |
| Production calendar | BLOCKED | Exact operational clock values pending |
| Formal LINE LIFF | BLOCKED | Formal credentials and device evidence unavailable |
| Formal Entra/RBAC | BLOCKED | Formal credentials/evidence unavailable |
| Security E2E | BLOCKED | Formal identity environments unavailable |
| UAT | BLOCKED | UAT environment and sign-off unavailable |
| Backup/restore drill | BLOCKED | Automation/runbook and isolated restore evidence pending |
| Shadow settlement | BLOCKED | Non-empty production-cycle evidence unavailable |
| Production promotion | BLOCKED | Manual Go/No-Go prerequisites incomplete |
| Isolated Azure Stage infrastructure | PASS | East Asia `rg-ucell-stage`; migrations and public runtime smoke pass |
| Stage operational identity | BLOCKED | Formal LINE LIFF and Entra credentials/device evidence pending |
