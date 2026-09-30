# Period calendar planner and approved cutoff compatibility

Authority: CR-BATCH-01 Priority B and `R1_0B_PRODUCT_OWNER_BOUNDARY_DECISIONS_20260917.md`. No new scheduler, payment engine or business cutoff is introduced.

## Runtime and enablement

The existing Worker tick runs bounded discovery before Period Job execution. Migration 116 adds one durable cursor per rule/kind. It advances only after the corresponding immutable job exists; a crash between job commit and cursor advancement reuses the job. Cursor configuration cannot be overwritten, and progress cannot move backward.

Explicit deployment configuration is required:

| Variable | Meaning |
| --- | --- |
| `PERIOD_CLOSE_PLANNER_ENABLED=true` | Opt into discovery; absent/false is disabled |
| `PERIOD_CLOSE_WORKER_ENABLED=true` | Required when planner is enabled |
| `PERIOD_CLOSE_PLANNER_RULE_VERSION` | Approved rule version; no implicit default |
| `PERIOD_CLOSE_PLANNER_FROM` | Initial discovery horizon; each kind resolves its containing approved period |
| `PERIOD_CLOSE_PLANNER_APPROVAL_REFERENCE` | Immutable operator approval reference |
| `PERIOD_CLOSE_PLANNER_MAX_PERIODS_PER_KIND` | Operational work bound, default 4, range 1–52 |

Approved `settlement.timezone`, `settlement.period` and `settlement.cut_off` parameters remain mandatory. Missing/changed configuration fails closed. No Stage configuration or deployment has been performed.

## Canonical 10/25 boundary

`SETTLEMENT_10_25` explicitly selects the existing shared Asia/Taipei 10th/25th resolver. It requires count 1 and Asia/Taipei; midnight boundaries remain half-open. Binary/Matching retain intact approved weeks and use the existing `resolveBinaryWeekBatch` rule: a Sunday closing exactly on the 10th belongs to the 25th batch.

For canonical preparation, Referral uses the exact 10/25 period. Other engines contribute their approved closes in that half-open window; an engine without a close in the window is not invented as a prerequisite. All expected predecessor windows must exist, and unexpected or missing dependencies are rejected. Source selection then follows those immutable prerequisite receipts, not a containment test that would split or omit a crossing week. Direct EPV/RPV/retail sources still use the preparation event window.

The earlier generic-period preparation acceptance remains covered, but its full-containment selection was insufficient for canonical Binary cutoffs. This change repairs that compatibility gap without altering the Binary calculation or historical awards.

## Verification

Build, schema/migration/security preflights, regenerated OpenAPI/preflight and 115→116 preservation/guard/cleanup: PASS.

Focused **5 suites / 36 tests PASS**, including bounded discovery, approved cutoff, simultaneous planners, restart after job commit, missing/changed configuration, DST, maturity/source-boundary regressions, and a funded Sunday May 10 Binary close carried intact into the May 25 preparation. The real Binary award of 10 is materialized exactly once. Fresh **0→116**, **162 baseline assertions**, and cleanup PASS.

Full DB Golden: PASS with cleanup. The six-kind actual Worker death/restart matrix was rerun after receipt-based source selection changed: **24 cases PASS**, including cleanup.

Before commit, a missing local Git pack prevented tree construction. Changes/index were backed up, remote objects were recovered from a separate mirror, stale orphan pack metadata was preserved outside `.git`, full fsck passed, and all 16 changed files matched their backup hashes. No source or economic evidence was reset during repair.

Logs: `C:\UCell\logs\cr-batch-period-planner-*-20260930.log`.

Remaining orchestrator requirements: late-input fail/route policy, overdue invariant and final operational read. Whole-batch status and Stage RC remain IN_PROGRESS / NOT_READY.
