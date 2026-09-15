# Release Cutover Runbook — UCell Backend/Admin R6

1. Freeze writes during final migration window.
2. Record currently deployed release/version hashes.
3. Take PostgreSQL backup and verify artifact checksum.
4. Restore backup into isolated staging and run integrity checks.
5. Deploy backend artifact.
6. Run `prisma validate`, `prisma generate`, TypeScript build.
7. Run `prisma migrate deploy`.
8. Run DB Golden E2E and integrity alerts.
9. Start API; verify `/api/v1/health`.
10. Verify Entra exchange with a designated test admin.
11. Verify role denial cases.
12. Deploy Admin frontend with demo login disabled.
13. Run P0 smoke/UAT:
    - Person/Application/Qualification
    - Payment/GPV
    - Return/Recovery
    - Payout dual approval
14. Confirm zero CRITICAL alerts.
15. Lift write freeze.
16. Monitor error, audit, outbox and payout queues for the first operating window.

No step may be skipped for production cutover.
