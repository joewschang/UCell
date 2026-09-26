# G8 operational readiness status

**Started:** 2026-09-26  
**Authority:** `UCELL_PHASE_1_RELIABLE_MVP_SCOPE_DECISION.md`, sections 12–14.  
**Scope:** G8 only. No Production deployment is authorized by this report.

## Stage evidence received

Stage is deployed at source `6f5e340dc77b0188799a492aefc8cbba24a307ac`. The migration and synthetic UAT-seed jobs succeeded; API, worker, Admin and Member revisions are healthy and digest-pinned. Preliminary human UAT is reported PASS. The 2026-09-26 read-only refresh confirms all four current revisions, Log Analytics and Application Insights are present; see [stage-environment-inventory-20260926-g8-refresh.json](evidence/stage-environment-inventory-20260926-g8-refresh.json) and [stage-monitoring-readiness-20260926-g8-refresh.json](evidence/stage-monitoring-readiness-20260926-g8-refresh.json). This records Stage/G7 progress; it does not substitute for G8 or G9 evidence.

Migration 87 was recovered on Stage under explicit approval using the append-safe reconciliation: historical AuditEvent evidence was preserved, Prisma ledger reconciliation and the current 87-migration chain passed, and the digest-pinned G8 API/Worker revisions are healthy. See [G8_STAGE_MIGRATION_87_RECOVERY_EXECUTION_20260926.md](G8_STAGE_MIGRATION_87_RECOVERY_EXECUTION_20260926.md). Production was not touched.

Formal LINE/LIFF and Entra credentials remain `OPERATIONAL_CREDENTIAL_PENDING`; guarded Stage-only synthetic UAT access is not a Production identity substitute.

## G8 matrix

| Requirement | Status | Evidence/disposition |
|---|---|---|
| SOURCE_RECOVERY | BLOCKED_STORAGE_PERMISSION | Full-ref Git bundle and local bare restore verification PASS, but the approved private Azure Storage destination rejected data-plane upload because the operator lacks `Storage Blob Data Contributor`. See [G8_SOURCE_RECOVERY_BLOCKER_20260926.md](G8_SOURCE_RECOVERY_BLOCKER_20260926.md). |
| DB_BACKUP_RESTORE | IN_PROGRESS | Azure Stage PostgreSQL has 7-day automated backup retention; a local disposable restore drill PASS is recorded in [G8_LOCAL_RESTORE_DRILL_20260926.md](G8_LOCAL_RESTORE_DRILL_20260926.md). Stage/Production drill and policy remain required. |
| MIGRATION_REPRODUCIBILITY | PASS (Stage) | Stage migration 87 reconciliation and post-deploy `migrate deploy` passed; Stage is current at 87 migrations. |
| G8_STAGE_AUDIT_DEPLOYMENT | PASS (Stage) | Approved append-safe Stage recovery, postcondition verification, audit integrity checks, ledger reconciliation, normal migration deploy and digest-pinned API/Worker health are PASS. See [G8_STAGE_MIGRATION_87_RECOVERY_EXECUTION_20260926.md](G8_STAGE_MIGRATION_87_RECOVERY_EXECUTION_20260926.md). |
| EVIDENCE_STORAGE_RECOVERY | PENDING | Storage inventory/retention and restored-object reference check must be executed. |
| ENVIRONMENT_INVENTORY | IN_PROGRESS | Read-only Stage inventory was refreshed on 2026-09-26 with non-secret resource, revision, backup and Key Vault metadata. Production inventory remains required before a Production readiness claim. |
| SECRET_RECOVERY | IN_PROGRESS | Non-secret Stage secret/service-identity inventory is recorded in [SECRET_SERVICE_IDENTITY_INVENTORY.md](../../deployment/SECRET_SERVICE_IDENTITY_INVENTORY.md). Named primary/backup owners, rotation cadence and controlled recovery exercise remain external operational work. |
| MINIMUM_MONITORING | DECISION_REQUIRED_RECEIVER_OWNER | Stage has Application Insights/Log Analytics and healthy revision inventory; API health verifies database connectivity and structured errors are queryable. The 2026-09-26 refresh confirms the sole Stage Action Group still has zero delivery receivers, so alertability cannot PASS until a named operational owner and delivery receiver are approved. Evidence: [stage-monitoring-readiness-20260926-g8-refresh.json](evidence/stage-monitoring-readiness-20260926-g8-refresh.json). |
| OPERATIONS_RUNBOOKS | IN_PROGRESS | `deployment/OPERATIONS_RUNBOOK.md` covers required recovery classes; controlled drill evidence remains required. |
| INCIDENT_RELEASE_ROLLBACK_RUNBOOKS | IN_PROGRESS | Rollback and incident sections are present; owner/contact and drill evidence remain required. |
| RPO_RTO | DECISION_REQUIRED | Business owner approval is required. Values must not be invented. |
| LINE_ENTRA_CREDENTIAL_DRILL | BLOCKED_EXTERNAL_CREDENTIALS | Formal Stage LINE/LIFF and Entra credential-backed journeys require separately provisioned Stage credentials and callback/redirect approval. Synthetic Stage UAT access is not a substitute. |
| ERROR_STRUCTURED_LOGGING | PASS (local) | API and Worker emit the privacy-safe `UCELL_STRUCTURED_ERROR` JSON envelope; focused API test and API/Worker builds PASS. |
| TRACE_CORRELATION | PASS (implementation evidence) | API request correlation headers and Worker-generated trace IDs are carried by structured operational events; cross-service Stage exercise remains part of monitoring evidence. |
| ERROR_CODE_CATALOG | PASS | [PHASE_1_ERROR_CODE_CATALOG.md](PHASE_1_ERROR_CODE_CATALOG.md) governs controlled prefixes and operational action. |
| ERROR_FINGERPRINT | PASS (event generation) | Structured events derive a privacy-safe SHA-256 fingerprint from service, controlled code, error class, operation and release; aggregation alert policy remains under monitoring. |
| GITHUB_ISSUE_REPAIR_CONTRACT | PASS (runbook) | [CODEX_REPAIR_RUNBOOK.md](../../backend/docs/CODEX_REPAIR_RUNBOOK.md) requires the sanctioned Issue evidence. |
| SANITIZED_DIAGNOSTIC_PACKAGE | PASS (policy) | Structured envelope and repair runbook prescribe only controlled code, trace, fingerprint and safe references. |
| CODEX_REPAIR_RUNBOOK | PASS | [CODEX_REPAIR_RUNBOOK.md](../../backend/docs/CODEX_REPAIR_RUNBOOK.md) is versioned with the repair boundary. |
| PRODUCTION_AUTO_MUTATION | PASS | No runtime path is authorized to mutate Production. |
| AUDIT_EVENT_CORE | PASS (isolated DB) | Migration `20260926110000_g8_audit_event_core` adds event, environment, trace, result, privacy/retention, hash and evidence fields; isolated persistence test PASS. |
| HIGH_RISK_WRITE_AUDIT | PARTIAL | Domain audit facts exist and now receive controlled event/trace fields; final coverage matrix and Stage exercise remain required. |
| SECURITY_EVENT_AUDIT | PARTIAL | Explicit Admin `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `LOGOUT`, LINE/security/session and controlled HTTP failure events are recorded. A failed audit write cannot mask the original controlled Admin login denial. Admin authentication/role guards and Member BOLA denials persist privacy-safe `ACCESS_DENIED` events. There is no Phase-1 application role-grant mutation command: role/grant changes are deployment/DB-governed operations and require a named operator, controlled change evidence and Stage exercise before `ROLE_OR_PERMISSION_CHANGED` can be evidenced. |
| AUDIT_SEARCH / AUDIT_RBAC | PASS (implementation evidence) | RBAC-protected Admin audit search exists; final Stage verification remains required. |
| APPEND_ONLY_AUDIT | PASS (isolated DB) | Database trigger rejects audit rewrite/delete; isolated persistence evidence is recorded. |
| PII_MINIMIZATION | PASS (focused test) | Audit service redacts sensitive fields and records hashes/field names instead. |

**G8 OPERATIONAL_READINESS = NOT_YET_PASS.** The explicit `RPO_RTO=DECISION_REQUIRED` and independent-source/restore/monitoring evidence prevent a G8 pass. Independent actionable work continues.

