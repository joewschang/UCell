# G8 Stage isolated PITR restore drill — 2026-09-26

**Result:** `PASS` for the isolated Stage restore drill. Production was not touched.

- Source server: Stage Azure PostgreSQL Flexible Server 16, Burstable, seven-day automated PITR retention.
- Restore point: `2026-09-26T09:30:00Z`, intentionally before Migration 87 reconciliation.
- Isolated target: separately named Stage restore server; never promoted or connected to Stage applications.
- Network: source firewall allowlist was copied to the isolated target only after the initial reachability check demonstrated it is not inherited by PITR restore.
- Verification: controlled job reused its existing secret only in-process, changed only the hostname to the isolated target, and exported no credential.
- Integrity: `86` completed migrations, pre-Migration-87 audit schema, and the original append-only trigger verified.
- Cleanup: isolated target deletion was initiated immediately after successful verification.

This proves a selected Stage PITR point can be restored and verified in isolation. It does not approve RPO/RTO values; those remain business decisions.
