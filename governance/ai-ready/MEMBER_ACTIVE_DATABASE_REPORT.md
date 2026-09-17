# Member Active PostgreSQL verification

Status: PASS. Baseline: 789e732. No deployment.

## Reproduction

From backend run: pnpm test:member:explain:isolated

The command builds the backend, creates a randomly named ucell_explain_<32 hex> database on local PostgreSQL, applies all existing migrations, runs the source integration assertions and drops that exact database in finally. Both runner and test child reject remote database hosts; the child also rejects database names outside this test prefix. It does not migrate or seed an existing application database.

## Evidence

Full backend build passed. All 53 migrations applied to the fresh database.
Final successful run:
- MEMBER_EXPLAIN_DB_PASS: 21 assertions; real migrated PostgreSQL and production recognition writer
- MEMBER_EXPLAIN_DB_ISOLATED_PASS
- MEMBER_EXPLAIN_DB_ISOLATED_CLEANUP_PASS

The real recognizeConsumption writer runs in Serializable transactions; the real Active source reader runs in RepeatableRead transactions using the adapter's 500ms maxWait and 1500ms timeout. No Prisma mocks are used in this suite.

Coverage includes absent evidence, excluded consumption producing stored zero, exact 1999.9999 below threshold, 0.0001 crossing to 2000, later consumption retaining Active when thresholdCrossed=false, evidence references and latest sequence, next Taipei month, another Ball without evidence, invalid evidence hash, replayed accumulator, reversal recognition, conflicting ActivePeriod, future recognition, unsupported 1200 threshold and read-only accumulation.

The database append-only trigger is explicitly asserted to reject attempted accumulator updates. Negative fixtures are inserted as separate test evidence, with real foreign keys and constraints retained; no triggers are disabled. Replay and reversal fixtures exercise rejection only, not successful replay economics.

## Scope and limitations

This closes the previous lack of live-database verification for the Active source adapter and its compatibility with the production recognition writer. It does not claim a full HTTP-to-database authentication/audit integration test, deployed verification, or live-database Carry coverage. Prior HTTP tests separately cover routes, validation, authentication/authorization and audit with mocked dependencies.

Initial test runs uncovered a test module-resolution error and an attempted fixture update blocked by the append-only trigger; both test issues were corrected. Cleanup succeeded after those failures and after the final passing run. No application behavior needed modification.

No new migration, Core formula, provider integration, Company decision or Stage/Production release is included. Replay-aware explanation and Company ownership integration remain pending. Production remains BLOCKED.
