# Member sealed Carry HTTP/PostgreSQL verification

Status: PASS. Baseline: 416a9ec. No deployment.

## Reproduction and scope

Run pnpm test:member:explain:isolated from backend. The existing isolated runner now exercises Carry through member-explain-carry-http-cases.mjs inside the same real Nest/Prisma/session/ownership/audit harness as Active. Local random test database restrictions and automatic cleanup are unchanged.

Successful fixtures use the real storeReplaySnapshot function to persist a sealed historical envelope and parameter hash. Batches and envelope contents are synthetic test evidence, not output from an executed settlement engine. A deliberately corrupt snapshot is inserted separately to verify failure handling; original sealed data is never updated.

## Added coverage

- Original FINALIZED BINARY_K1 Carry is selected by explicit Ball and batch.
- Left Carry 9007199254740993.1234 and right Carry 0.0000 survive JSONB, source projection and HTTP serialization as exact strings.
- Finality, period end, parameter hash and both evidence references agree with the stored original batch/snapshot.
- Another recipient and invented tree identifiers are not exposed.
- No-store and metadata-only success audit are retained.
- Foreign Ball, unsupported tree query and absent batch query are rejected.
- Draft batch, missing snapshot, missing recipient, duplicate recipient and unknown batch remain unavailable.
- Corrupt snapshot and numeric Carry values are invalid evidence.
- Each fixture failure persists the expected domain audit outcome and does not release a Carry fallback.
- A final database reread confirms the valid sealed snapshot is unchanged.

## Limitations

This validates an in-process Fastify HTTP pipeline against real PostgreSQL. It does not validate a deployed service, external OAuth, network/TLS middleware, full settlement calculations or replay-corrected Carry. The endpoint still means ORIGINAL SEALED batch evidence. Tree-scoped Carry and Company-specific ownership remain separate pending work.

No application behavior, new migration, economics, Company decision or release status changed. Production remains BLOCKED.

## Results

- Full backend build: PASS.
- All 53 existing migrations applied to a fresh temporary PostgreSQL database.
- MEMBER_EXPLAIN_DB_PASS: 21 source/database assertions.
- MEMBER_EXPLAIN_HTTP_DB_PASS: 65 counted assertions (29 existing Active/auth assertions plus 36 Carry assertions), with six additional explicit error-code assertions.
- MEMBER_EXPLAIN_DB_ISOLATED_PASS and MEMBER_EXPLAIN_DB_ISOLATED_CLEANUP_PASS.
- JavaScript syntax, security policy preflight and TODO gate: PASS.
