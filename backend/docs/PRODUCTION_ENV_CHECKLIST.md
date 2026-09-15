# Production Environment Checklist — R6

## Secrets / Identity
- `NODE_ENV=production`
- `ADMIN_AUTH_BYPASS=false`
- `ENTRA_TENANT_ID=<production tenant>`
- `ENTRA_CLIENT_ID=<production admin application>`
- Database credentials injected by secret manager, never committed.
- Only HTTPS origins are allowed in CORS.
- Swagger disabled unless explicitly protected.

## Database
- PostgreSQL 16+.
- `prisma migrate deploy` from a release artifact only.
- Pre-deploy backup completed and restore-tested.
- Read/write DB user separated from backup operator where practical.
- No direct production DDL outside controlled migration.

## Admin Access
- Every production admin must have:
  1. Person row.
  2. Entra Identity / Object ID.
  3. ACTIVE `AdminAccessGrant`.
  4. Correct role code.
- No shared administrator identities.
- FINANCE and COMPLIANCE approval must use different actors.

## Browser/Admin
- `VITE_ENABLE_DEMO_LOGIN=false`
- Entra tenant/client configured.
- Admin token kept in session scope, never as a permanent credential.
- No production API keys in browser bundle.

## Go-live
- Zero CRITICAL integrity alerts.
- All P0 UAT PASS.
- Security E2E PASS.
- Backup/restore drill PASS.
- RC Gate PASS.
