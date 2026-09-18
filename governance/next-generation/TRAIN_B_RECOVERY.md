# Train B recovery checkpoint

Train A stable pushed checkpoint: `323bf85b7c9751585cc03749fec8036dac2c5c6b`.
Upstream integrated before this checkpoint: `755a2a0` (provider production enablement guard).
This file accompanies the Train B non-monetary foundation commit. It is not a claim that the full Next Generation program, formal UAT or production scale acceptance is complete. See TRAIN_B_REPORT.md and TRAIN_B_PASS_FAIL_MATRIX.md.

Implemented: explicit CompanyPrincipal and bitemporal owner intervals; immutable kind; migration 54; three real Company bootstrap balls/seven canonical slots; actual Sponsor chronology; all four old placement writers; lifecycle and SQL evidence consistency; separate Sponsor confirmation; live Entra authorization; bound placement preflight; immutable occupation; full-depth structural counts; bounded original-period GPV plus POSTED reversal evidence; original/replayed Carry reads; leased projection acknowledgement; owner-aware EXIT/retransfer with authenticated approval audit; Admin tree pages and Company-aware qualification display.

Validation checkpoint: API 73 suites / 734 tests, Admin 23 / 75, Member 24 / 142, Shared 5 / 181. Decision v3 T01–T17 passed. Final RC output is preserved after the last authorization change. Twenty-four founding orders, fourteen-generation counts, direct-SQL mismatches, rollback/retry, concurrency, live grant revocation, ownership history and GPV/Carry source boundaries are covered. OpenAPI: 167 operations; prior 159 operations and component schemas unchanged.

Resume with `git status`, `git log -3`, and the PASS/FAIL matrix. Current worktree is C:/UCell/next-generation on integration/member-backend-mvp. Inspect remaining scope in the report before extending it. Original user attachment ends mid-section 37; continuation was requested. Company monetary activation must stay PENDING_MAPPING until approved exact profile binding. Do not invent a plan/rank or extend that blocker to unrelated non-monetary work.

Test environment: dedicated PostgreSQL container ucell-next-generation-tests at 127.0.0.1:55432. Final scratch DB: ucell_train_b_final_test. All original 53 migrations plus the final migration 54 were deployed there. Use `DATABASE_URL=postgresql://ucell:ucell_dev@127.0.0.1:55432/ucell_train_b_final_test?schema=public` with backend/scripts/api-jest-isolated.mjs; it creates/drops a fresh ucell_jest_<uuid> DB. Original port 5432 is not the migration target.

Earlier task scratch databases ucell_admin_test and ucell_train_b_test contain older unpublished drafts of migration 54. Do not deploy the final migration over those drafts or repair their checksum; use a fresh isolated DB. V3 requires a *_test primary DB while the legacy Phase 2 script only accepts ucell_admin_test or ucell_jest_<uuid>. Use a disposable allowed-name clone via PHASE2_TEST_DATABASE_URL; do not weaken those guards.

One initial bare Jest run accidentally omitted isolation environment variables; the legacy inventory test created a synthetic Person on original port 5432/ucell_admin_test before failing on missing Qualification.kind. No migration or destructive cleanup occurred there. Subsequent runs used dedicated port 55432. Details and excluded failed attempts are in the report.

Outstanding: large/skewed scale validation, durable cross-request generation snapshots, aggregate/rebuild/export jobs and later governance/UI/AI integration scope; any continuation of the truncated original instructions. The new metric adapters intentionally return UNAVAILABLE beyond their source bounds. No Stage/Production deployment or monetary activation was performed.
