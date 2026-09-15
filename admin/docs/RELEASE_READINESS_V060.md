# Release Readiness v0.6.0

## Complete in source
- Core operational features v0.1–v0.5.
- Production-oriented Entra exchange flow.
- Admin access allow-list model.
- Fail-closed RBAC.
- UAT scenario/evidence framework.
- Security threat matrix and live security runner.
- Cutover/rollback/backup gates.

## Must still run live
1. pnpm frozen install.
2. Prisma validate/generate.
3. TypeScript build.
4. PostgreSQL migration 0001–0016.
5. DB Golden E2E.
6. API/OpenAPI/HTTP smoke.
7. Entra real tenant login.
8. Security HTTP E2E with separate role accounts.
9. All P0 UAT.
10. All P1 UAT.
11. Zero critical integrity alerts.
12. Backup + restore drill.
13. RC Gate.

No production go-live before all 13 are complete.
