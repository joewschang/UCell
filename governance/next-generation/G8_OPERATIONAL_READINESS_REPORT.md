# G8 operational readiness status

**Started:** 2026-09-26  
**Authority:** `UCELL_PHASE_1_RELIABLE_MVP_SCOPE_DECISION.md`, sections 12–14.  
**Scope:** G8 only. No Production deployment is authorized by this report.

## Stage evidence received

Stage is deployed at source `6f5e340dc77b0188799a492aefc8cbba24a307ac`. The migration and synthetic UAT-seed jobs succeeded; API, worker, Admin and Member revisions are healthy and digest-pinned. Preliminary human UAT is reported PASS. This records Stage/G7 progress; it does not substitute for G8 or G9 evidence.

Formal LINE/LIFF and Entra credentials remain `OPERATIONAL_CREDENTIAL_PENDING`; guarded Stage-only synthetic UAT access is not a Production identity substitute.

## G8 matrix

| Requirement | Status | Evidence/disposition |
|---|---|---|
| SOURCE_RECOVERY | PENDING | Independent full Git mirror/archive and restore drill have not yet been provisioned. |
| DB_BACKUP_RESTORE | IN_PROGRESS | Azure Stage PostgreSQL has 7-day automated backup retention; a local disposable restore drill PASS is recorded in [G8_LOCAL_RESTORE_DRILL_20260926.md](G8_LOCAL_RESTORE_DRILL_20260926.md). Stage/Production drill and policy remain required. |
| MIGRATION_REPRODUCIBILITY | PASS (local) | 86 forward-only migrations and fresh isolated DB evidence are frozen. Stage migration succeeded. |
| EVIDENCE_STORAGE_RECOVERY | PENDING | Storage inventory/retention and restored-object reference check must be executed. |
| ENVIRONMENT_INVENTORY | IN_PROGRESS | Read-only `deployment/collect-environment-inventory.ps1` records non-secret environment metadata. Production inventory remains required. |
| SECRET_RECOVERY | IN_PROGRESS | Stage uses Key Vault and managed identity. Owner/rotation/recovery metadata remains to be recorded without secret values. |
| MINIMUM_MONITORING | IN_PROGRESS | Stage has Application Insights/Log Analytics and health probes. Alert rules, dashboard/query evidence and worker/domain failure coverage remain required. |
| OPERATIONS_RUNBOOKS | IN_PROGRESS | `deployment/OPERATIONS_RUNBOOK.md` covers required recovery classes; controlled drill evidence remains required. |
| INCIDENT_RELEASE_ROLLBACK_RUNBOOKS | IN_PROGRESS | Rollback and incident sections are present; owner/contact and drill evidence remain required. |
| RPO_RTO | DECISION_REQUIRED | Business owner approval is required. Values must not be invented. |
| ERROR_STRUCTURED_LOGGING | IN_PROGRESS | Current API/worker logging and request correlation exist; common G8 envelope remains to be completed. |
| TRACE_CORRELATION | PARTIAL | Request/worker/domain correlation exists; cross-service verification remains required. |
| ERROR_CODE_CATALOG | PARTIAL | Domain codes exist; controlled catalog/report must be consolidated. |
| ERROR_FINGERPRINT | DEFERRED_WITH_APPROVED_REASON_PENDING | Monitoring backend aggregation policy/approval is not yet recorded. |
| GITHUB_ISSUE_REPAIR_CONTRACT | IN_PROGRESS | Authority defines the contract; repository template/evidence must be completed. |
| SANITIZED_DIAGNOSTIC_PACKAGE | IN_PROGRESS | Runbook requires sanitization; executable packaging/checklist remains required. |
| CODEX_REPAIR_RUNBOOK | IN_PROGRESS | Authority workflow exists; repository runbook must be finalized. |
| PRODUCTION_AUTO_MUTATION | PASS | No runtime path is authorized to mutate Production. |
| AUDIT_EVENT_CORE | PARTIAL | Append-oriented audit store and RBAC search exist; G8 contract reconciliation remains required. |
| HIGH_RISK_WRITE_AUDIT | PARTIAL | Domain audit facts exist; coverage matrix remains required. |
| SECURITY_EVENT_AUDIT | PARTIAL | LINE/security/session audit exists; catalog/coverage reconciliation remains required. |
| AUDIT_SEARCH / AUDIT_RBAC | PASS (implementation evidence) | RBAC-protected Admin audit search exists; final Stage verification remains required. |

**G8 OPERATIONAL_READINESS = NOT_YET_PASS.** The explicit `RPO_RTO=DECISION_REQUIRED` and independent-source/restore/monitoring evidence prevent a G8 pass. Independent actionable work continues.

