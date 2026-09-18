# Member Active HTTP and PostgreSQL integration

Status: PASS. Baseline: 70cfd16. No deployment.

## Recovery and execution

After the second power outage, the checkout was clean and the previous commit intact. Docker Desktop was stopped and port 5432 was unavailable. Docker Desktop was restarted; the existing backend-postgres-1 container returned to healthy. No existing database volume was recreated.

The existing pnpm test:member:explain:isolated command now also runs member-explain-http-db-test.mjs. It rebuilds the backend, creates a local randomly named temporary database, applies existing migrations, executes source and HTTP integration suites, and drops only that database in finally.

## HTTP coverage

This suite uses Nest's real Member Explain controller, DTO validation, authentication and context guards, qualification access, token hashing/session service, LINE identity binding lookup, Explain service, shared gateway, source adapter, envelope interceptor and PrismaService. All database calls go to the temporary PostgreSQL database. There are no mocked providers.

Fastify inject sends requests through the in-process HTTP route pipeline; no external listening port is needed. Sessions and LINE bindings are synthetic local fixtures issued through the actual token service. This does not call LINE OAuth or claim to validate LINE's external identity provider.

Assertions cover:
- Missing/unknown bearer, unbound identity, expired/revoked session and ADMIN_LOCAL session rejection.
- Unsupported query fields.
- Owned Ball with no evidence returning 422 and persisting the unavailable outcome.
- Original recognition at 1999.9999 returning BELOW_THRESHOLD and another 0.0001 returning Active.
- Evidence references, explicit Ball scope, no-store, and absence of token/LINE subject in responses.
- Real audit persistence for successful reads and service-level ownership denial; metadata-only payload and correlation identity.
- Another holder's Ball rejected by the context guard; disagreement between holder history and current owner rejected by the service.

## Boundaries

This closes the prior Active HTTP-to-database session/ownership/audit integration gap. It does not cover main application HTTP audit middleware, external network/TLS/proxy transport, provider OAuth, concurrency fault injection, database audit outage injection, deployed environments, or Carry HTTP-to-database integration. Earlier mocked HTTP tests retain coverage for audit failure and ownership/session changes during a read.

No application source behavior, schema, migration, economic calculation, Company bootstrap decision or release state changed. Production remains BLOCKED.

## Verification result

- Full backend build: PASS.
- All 53 existing migrations applied successfully to the fresh temporary database.
- MEMBER_EXPLAIN_DB_PASS: 21 source/database assertions.
- MEMBER_EXPLAIN_HTTP_DB_PASS: 29 HTTP/database assertions.
- MEMBER_EXPLAIN_DB_ISOLATED_PASS and MEMBER_EXPLAIN_DB_ISOLATED_CLEANUP_PASS.
- JavaScript syntax, security policy preflight and TODO gate: PASS.
