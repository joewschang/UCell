# Period Orchestrator bounded acceptance

Authority: CR-BATCH-01 priority B and the frozen settlement calendar. Period Orchestrator = PASS for the required local implementation matrix below. Full-batch implementation, final isolated recertification and Stage RC remain unfinished; no deployment is authorized.

| Required invariant | Evidence |
| --- | --- |
| DUE_JOB_DISCOVERY | Durable six-kind planner, bounded catch-up, resumable cursor and concurrent admission in PERIOD_CALENDAR_PLANNER_20260930.md |
| CUTOFF_ENFORCED | Historical approved timezone/cutoff, DST and exact Asia/Taipei 10/25 boundary tests; intact Sunday weeks |
| SINGLE_WINNER_CONCURRENCY | Serializable admission with fresh-transaction retries; one manifest, Outbox record and audit |
| RETRY_IDEMPOTENT | Immutable identity/dependencies, fenced leases, sealed-result receipt and exact replay |
| WORKER_RESTART_RECOVERY | Six kinds × empty/funded × before-seal/after-commit: 24 actual process-kill/restart cases; rerun under migration 117 PASS |
| K2_AFTER_K1 | Matching admission requires its exact Binary job; Worker waits for the committed Binary receipt |
| GLOBAL_SINGLE_EFFECT | Original Global snapshot and one monetary effect survive retries and process death |
| WELFARE_SINGLE_EFFECT | Same-period Global dependency, one accrual/effect, atomic original envelope; PERIOD_WELFARE_CLOSURE_20260930.md |
| PAYABLE_PREPARATION_SINGLE_EFFECT | Complete approved prerequisites, actual intact-week receipt sources, maturity gate, one source identity per payable; PERIOD_PAYABLE_PREPARATION_20260930.md |
| LATE_INPUT_FAILS_OR_ROUTES_BY_AUTHORITY | Migration 117, linked correction exceptions, exact-redelivery boundary and real writer/close lock contention; PERIOD_LATE_INPUT_20260930.md |
| PERIOD_JOB_OVERDUE_DETECTED | Read-only period candidates using an explicit 1–8760 hour operator threshold; fixed evidence hashes and safe references |

## Operational read and recognition dependency

The Worker and operational read share economic-source and due monthly-recognition readiness. Recognitions are scoped by rule and strictly before period end. The real database check proves another rule and the exact next-period boundary do not block the job, while an unresolved due recognition does. Reads and waits consume no lease attempts.

Settlement-job list/detail use Repeatable Read and expose completed, ready, running, prerequisite/source/recognition/maturity waits, retry scheduling, expired lease, failed execution and inconsistent evidence separately. The API replaces raw failure strings with a fixed code. Parent references are hashed; the Admin page displays business labels, waiting counts and parent completion rather than database identities. Finance/Super Admin retain audited retry rights; Compliance remains read-only.

Without an operator threshold, overdue is explicitly unassessed. With a threshold, the anchor is the later of approved cutoff and applicable positive member-award maturity. Normal maturity waits do not become false overdue warnings. The period invariant read detects dead jobs, expired leases, inconsistent receipt/status evidence and overdue unfinished work. It does not mutate Tasks, Exceptions or source economics.

## Latest verification

- Isolated PostgreSQL / HTTP / Worker delivery checks: 4 suites / 36 tests PASS; 162 baseline assertions, fresh 0→117, disposable cleanup PASS.
- Backend build and Admin typecheck/build PASS. Admin full regression: 42 files / 158 tests PASS, including explicit threshold application and safe waiting-state presentation.
- Generated OpenAPI and security/OpenAPI preflights PASS. Optional threshold query preserves old requests. No schema change in this final read slice.
- The earlier migration-117 verification includes full DB Golden and 116→117 historical preservation, plus 3 suites / 46 tests including all 24 process-recovery cases. These results are bounded evidence, not the final full-batch recertification.

A historical pre-1970 fixture exposed an overdue-anchor default bug; the default now uses the actual cutoff rather than Unix epoch. A test that counted every receipt in its disposable database was scoped to its own two jobs after new recognition evidence added a legitimate third receipt. The final listed runs include both corrections.

Local missing Admin dependencies were restored from the unchanged frozen lockfile and fresh package store; the previous directory was retained outside the repository. No version change was introduced.

Logs: `C:\UCell\logs\cr-batch-period-operational-*-20260930.log`. Whole-journey browser review remains in priority I. Priority C now owns six-kind Compensation Period integration and financial reconciliation correctness; a Period Job receipt alone does not certify financial reconciliation.
