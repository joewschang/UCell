# Durable Payable preparation

This is the Payable preparation slice of the required CR-BATCH-01 Period Orchestrator. It does not authorize automatic payment or Stage deployment.

## Runtime

- Migration 115 extends the immutable job kind constraint with `PAYABLE_PREPARATION`.
- Admission requires gap-free, non-overlapping coverage of the requested period by Referral, Binary, Matching, Global and Welfare jobs under the same rule. All receipts must exist before claim.
- Pending member award maturity is a dependency wait. Claim and Worker discovery leave it unleased and do not consume delivery attempts. The executor checks maturity again inside the fenced transaction.
- API and Worker share the existing materialization logic, including positive amounts, rule/cutoff boundaries and Company/Reservoir B exclusion. Worker preparation additionally restricts the source period. No new accounting or payout engine is added.
- Eligible award maturity, Payable creation, sealed source evidence, receipt and Outbox completion commit together. Delivery retry cannot create a second effect. The receipt captures original Payable identity/amount/availability, not later mutable payout allocation status.
- This job does not create a PayoutBatch, approve an export or send money.

## Verification

- Backend build: PASS.
- Real PostgreSQL 114→115 upgrade: PASS. Existing five job kinds, receipts and Outbox rows remain identical, with append-only guards preserved; preparation admission is accepted. Cleanup PASS.
- Schema, migration, security and regenerated OpenAPI/preflight: PASS.
- Focused real-DB and shared materialization: **7 suites / 51 tests PASS**, including exact cutoff, foreign rule, historical period exclusion, empty preparation, missing prerequisites, maturity wait without attempts, atomic rollback and once-only replay. Fresh **0→115**, **162 baseline assertions**, cleanup PASS.
- Actual six-kind Worker death/restart matrix: **24 cases PASS**, covering empty/funded inputs and before-seal/after-commit termination. Preparation recovers maturity and Payable creation without duplicate economic rows or receipts. Cleanup PASS.
- Full DB Golden: PASS, including cleanup.
- The initial focused run exposed missing synthetic Binary cap parameters after the newly funded Welfare fixture introduced a historical Qualification. The fixture now supplies explicit approved test parameters. The existing materialization contract assertion still verifies its exact rule/maturity filter while allowing deterministic source ordering. Final rerun is PASS.

Logs: `C:\UCell\logs\cr-batch-payable-preparation-*-20260930.log`.

## Remaining scope

Period Orchestrator remains IN_PROGRESS for calendar due discovery, late-input policy, overdue detection and the final operational read. These results do not declare full isolated recertification or Stage RC readiness.
