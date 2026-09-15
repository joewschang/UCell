// The Phase 2 DB suite supersedes the earlier allocation-pending harness.
// Original harness preserved in governance/phase2-return-replay/legacy/.
// Monthly threshold, historical recipients, append-only replay and configured calendar are asserted against PostgreSQL.
await import('./phase2-db-test.mjs');
