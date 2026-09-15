# UCell R1.0B FROZEN — Backend v0.6.7

## Goal
Move from "feature complete prototype" to a reproducible engineering gate before the first real DEV deployment.

## Changes

### Migration convergence
- Removed the legacy `commerce.subscription_cancellation` creation from migration 0005.
- Canonical table remains `subscription.subscription_cancellation` in migration 0006.
- Renamed the duplicate `0010_v066_convergence_guards` migration directory to `0011_v066_convergence_guards`.
- Migration prefix uniqueness is now checked automatically.

These edits are acceptable only because no production migration has yet been declared successfully deployed.

### Audit registration
The AuditInterceptor existed but was not actually registered globally.
v0.6.7 registers it through Nest `APP_INTERCEPTOR`.

### Correlation ID safety
`AuditEvent.correlation_id` is UUID.
Incoming `x-correlation-id` is now accepted only when it is a valid UUID; otherwise the server generates one.

### Offline engineering gates
Added dependency-free checks:
- schema-preflight
- migration-preflight
- source-preflight
- expanded R1.0B golden regression

`ci-gate.sh` first runs all offline gates, then runs Prisma validate/generate/build when pnpm exists.

### Honest deployment gate
A separate `dev-smoke.sh` requires:
- DATABASE_URL
- pnpm
- installed dependencies
and runs Prisma validate, generate, migrate deploy, TypeScript build, and Golden regression.

## Next
v0.6.8 / v0.7.0 candidate:
- execute dependency-backed gate in a real DEV environment;
- repair every Prisma/TypeScript error found;
- PostgreSQL migration smoke;
- seed database;
- turn Golden dataset into database E2E;
- export OpenAPI and run HTTP smoke.
