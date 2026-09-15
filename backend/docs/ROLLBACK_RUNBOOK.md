# Rollback Runbook

Rollback is a controlled incident action, not an ad-hoc downgrade.

1. Stop incoming writes.
2. Capture current DB and application logs.
3. Classify failure:
   - application-only,
   - migration compatible,
   - migration destructive/data-corrupting.
4. If application-only and schema backward compatible, redeploy prior signed artifact.
5. If schema/data restoration is required:
   - create a final failed-state backup,
   - restore the pre-cutover backup to a new database instance,
   - verify checksums and integrity alerts,
   - repoint application only after approval.
6. Never manually delete ledger, award, recovery, payout or attachment records to “fix” rollback.
7. Create an audit/incident record with correlation IDs and release hashes.
