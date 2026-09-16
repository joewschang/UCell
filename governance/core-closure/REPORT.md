# Core Closure checkpoint report

Date: 2026-09-16 (Asia/Taipei)

## Subscription schedule cardinality continuation

- TODO: 23 -> 20 (`ENGINEERING` 18 -> 15; pending classifications unchanged).
- QUARTER, HALF_YEAR and YEAR now execute the production `SubscriptionService` and prove exactly 3, 6 and 12 recognition rows with contiguous installment numbers.
- Fresh isolated PostgreSQL evidence verifies the durable row counts through the real service and transaction path; membership/payout evidence increased from 102 to 111 assertions.
- This batch verifies cardinality only. It does not approve the legacy UTC `dueAt` construction or any Production billing/recognition cut-off. Versioned Asia/Taipei subscription scheduling remains an open engineering/release obligation and Production values remain a Pending Decision.
- Backend API: 166 PASS / 20 TODO / 0 FAIL. Backend build and fresh DB Golden with all 25 migrations: PASS.

- Branch: `integration/member-backend-mvp`
- Baseline checkpoint: `cbee775`
- TODO: 51 -> 23 (`IMPLEMENTABLE` 17 -> 0; `ENGINEERING` 28 -> 18; `PENDING_DECISION` 3; `LEGACY_TEST_DRIFT` 2)
- Completed obligation: Matching traversal uses Sponsor Tree and is executable.
- Historical replay now has executable evidence that Matching recipients are validated against sealed Sponsor/Active/Qualification evidence even when Binary ancestry differs.
- Missing or substituted historical Sponsor evidence fails closed; no current-state fallback is introduced.
- K1/K2 now replay all sealed recipients from the original recognition period through subsequent finalized periods.
- Carry replay persists one immutable `SettlementReplayPeriod` per period and resumes the same `SettlementReplayRun` deterministically.
- `maxWeeks` produces `REPLAY_INCOMPLETE`, persists a non-monetary checkpoint, and never partially finalizes awards/recoveries.
- Propagation stops at the first period whose carry and award results match the original sealed boundary.
- Posted returns create idempotent historical Binary/Matching recalculation requests; replay marks them processed without rewriting settlements.
- Pending direct entitlement cancellation appends `REVERSED` without recovery; PAID reduction appends `CLAWBACK` plus recovery while preserving the original PAID row.
- Versioned Asia/Taipei settlement boundaries are now verified against TEST_ONLY parameter snapshots, including the local-midnight boundary and transaction rollback.
- Golden dataset wrappers now execute isolated DB evidence for Sponsor/Binary separation, Active First, K1 carry, historical Matching source, and Return-to-Recovery behavior.
- Frozen Referral 15/20/25, Equalization Leader G5=10%, RPV 5/8/12 Binary allocation, and EPV Sponsor allocation now have executable Golden dataset assertions backed by the frozen constants and isolated historical DB evidence.
- Qualification upgrade, transfer, company-held exit, and company retransfer now execute the production workflow service with future-only history and unchanged Sponsor/Binary placement evidence.
- Payout materialization and mark-paid are executable. Mark-paid appends a PAID lifecycle event in the same Serializable transaction, advances allocated payable entries, and preserves the original Award.
- Backend API: 163 PASS / 23 TODO / 0 FAIL.
- Member: 116 PASS. Admin: 22 PASS. Backend API, Worker, Database, Member, and Admin builds: PASS.
- Database package build: PASS.
- Backend API build: PASS.
- Prisma validate/generate/deploy: PASS; no pending migrations.
- Isolated DB Golden: PASS with all 25 migrations and connected return/outbox, 102 membership/payout, RPV, Member/Admin, and identity assertions.
- Static/schema/migration/source, Security policy, R1.0B Golden, OpenAPI export/preflight: PASS.
- Business-rule changes: NONE. This checkpoint converts an already decided rule into executable verification.
- Production promotion: BLOCKED.

Pending decisions remain limited to production clock values, historical GPV-to-PV/BV migration mapping, and inactive Matching Sponsor edge semantics.
