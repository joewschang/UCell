# UCell R1.0B FROZEN — Backend v0.6.8

## Objective
Create the first dependency/database-backed release gate for the Backend MVP Release Candidate.

## Added

### CI with PostgreSQL
GitHub Actions now provisions PostgreSQL 16 and runs:
1. install
2. offline preflight
3. Prisma validate
4. Prisma generate
5. migrate deploy
6. build
7. golden seed
8. DB Golden E2E
9. OpenAPI export/preflight

### DB Golden E2E
A dependency-backed script verifies the deterministic A/B/C/D/E Golden dataset,
the Sponsor/Binary tree presence, and frozen-rule invariants when the corresponding
runtime parameters exist.

### OpenAPI gate
The generated OpenAPI document must contain:
- health endpoint
- payout endpoints
- settlement adjustment endpoints

### RC Gate
`bash scripts/rc-gate.sh` runs the full DEV smoke, starts the built API,
waits for health, and then runs HTTP smoke.

## Promotion rule
v0.7.0 RC may only be declared after a real dependency-enabled environment returns:
- OFFLINE_PREFLIGHT_PASS
- Prisma validate PASS
- Prisma generate PASS
- migrate deploy PASS
- build PASS
- DB_GOLDEN_E2E_PASS
- OPENAPI_PREFLIGHT_PASS
- HTTP_HEALTH_PASS
- RC_GATE_PASS
