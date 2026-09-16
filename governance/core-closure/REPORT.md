# Core Closure checkpoint report

Date: 2026-09-16 (Asia/Taipei)

- Branch: `integration/member-backend-mvp`
- Baseline checkpoint: `cbee775`
- TODO: 51 -> 29 (`IMPLEMENTABLE` 17 -> 0; `ENGINEERING` 28 -> 24; `PENDING_DECISION` 3; `LEGACY_TEST_DRIFT` 2)
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
- Backend API: 157 PASS / 29 TODO / 0 FAIL.
- Member: 116 PASS. Admin: 22 PASS. Backend API, Worker, Database, Member, and Admin builds: PASS.
- Database package build: PASS.
- Backend API build: PASS.
- Prisma validate/generate/deploy: PASS; no pending migrations.
- Isolated DB Golden: PASS with all 25 migrations and connected return/outbox, membership, RPV, Member/Admin, and identity assertions.
- Static/schema/migration/source, Security policy, R1.0B Golden, OpenAPI export/preflight: PASS.
- Business-rule changes: NONE. This checkpoint converts an already decided rule into executable verification.
- Production promotion: BLOCKED.

Pending decisions remain limited to production clock values, historical GPV-to-PV/BV migration mapping, and inactive Matching Sponsor edge semantics.
