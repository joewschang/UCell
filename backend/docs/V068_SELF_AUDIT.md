# v0.6.8 Self Audit

## What is now reproducible
- The exact dependency-backed validation order.
- PostgreSQL service setup in CI.
- Golden database seed/check entry point.
- OpenAPI contract gate.
- HTTP health smoke.
- RC promotion gate.

## What is still unverified in this runtime
This environment cannot reach npm registry and does not have PostgreSQL/Docker.
Therefore v0.6.8 does NOT claim:
- `pnpm install` success
- Prisma validate/generate success
- migrations applied successfully to PostgreSQL
- TypeScript/Nest build success
- DB Golden E2E success
- OpenAPI export success
- HTTP smoke success

Those results must come from the new CI/DEV gate before v0.7.0 RC.
