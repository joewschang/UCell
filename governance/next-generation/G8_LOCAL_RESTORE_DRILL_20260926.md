# G8 Local Disposable Restore Drill Evidence — 2026-09-26

**Classification:** local operational-readiness evidence; no Stage or Production database was used.

| Check | Result |
|---|---|
| Source target | local Docker PostgreSQL `ucell` |
| Restore target | disposable local database `ucell_g8_restore` |
| Backup format | PostgreSQL custom dump with SHA-256 sidecar |
| Restore command | `deployment/restore-verify.sh` |
| Applied committed migrations | 86 |
| Schema integrity | PASS: `identity.person`, `membership.qualification`, `commerce.order`, and `audit.audit_event` present |
| Result | `RESTORE_DRILL_COMPLETED migration_count=86` |
| Cleanup | PASS: disposable database dropped and temporary artifacts neutralized |

The runner validates a backup only after checksum verification, restore into a distinct target, committed-migration count verification, and critical-schema verification. It deliberately does not choose an RPO/RTO, restore into a live environment, or treat this local evidence as a Production backup/restore drill.

Stage automated backup retention is captured separately in [stage-environment-inventory-20260926.json](evidence/stage-environment-inventory-20260926.json). Production backup policy, independent source recovery, object-storage recovery, alerting evidence, and approved RPO/RTO remain G8 work.
