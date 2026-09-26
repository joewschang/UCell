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
| MIGRATION_REPRODUCIBILITY | PASS (local candidate) | Frozen baseline has 86 migrations; current G8 candidate has 87 forward-only migrations and fresh isolated DB evidence. Stage remains on the prior 86-migration UAT revision until controlled G8 deployment. |
| EVIDENCE_STORAGE_RECOVERY | PENDING | Storage inventory/retention and restored-object reference check must be executed. |
| ENVIRONMENT_INVENTORY | IN_PROGRESS | Read-only `deployment/collect-environment-inventory.ps1` records non-secret environment metadata. Production inventory remains required. |
| SECRET_RECOVERY | IN_PROGRESS | Stage uses Key Vault and managed identity. Owner/rotation/recovery metadata remains to be recorded without secret values. |
| MINIMUM_MONITORING | EXTERNAL_OWNER_REQUIRED | Stage has Application Insights/Log Analytics and healthy revision inventory; API health verifies database connectivity and structured errors are queryable. The sole Stage Action Group has zero delivery receivers, so alertability cannot PASS until an operational owner/receiver is approved. Evidence: [stage-monitoring-readiness-20260926.json](evidence/stage-monitoring-readiness-20260926.json). |
| OPERATIONS_RUNBOOKS | IN_PROGRESS | `deployment/OPERATIONS_RUNBOOK.md` covers required recovery classes; controlled drill evidence remains required. |
| INCIDENT_RELEASE_ROLLBACK_RUNBOOKS | IN_PROGRESS | Rollback and incident sections are present; owner/contact and drill evidence remain required. |
| RPO_RTO | DECISION_REQUIRED | Business owner approval is required. Values must not be invented. |
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
| SECURITY_EVENT_AUDIT | PARTIAL | Explicit Admin `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `LOGOUT`, LINE/security/session and controlled HTTP failure events are recorded. Dedicated access-denied/BOLA and role-change event coverage plus Stage exercise remain required. |
| AUDIT_SEARCH / AUDIT_RBAC | PASS (implementation evidence) | RBAC-protected Admin audit search exists; final Stage verification remains required. |
| APPEND_ONLY_AUDIT | PASS (isolated DB) | Database trigger rejects audit rewrite/delete; isolated persistence evidence is recorded. |
| PII_MINIMIZATION | PASS (focused test) | Audit service redacts sensitive fields and records hashes/field names instead. |

**G8 OPERATIONAL_READINESS = NOT_YET_PASS.** The explicit `RPO_RTO=DECISION_REQUIRED` and independent-source/restore/monitoring evidence prevent a G8 pass. Independent actionable work continues.
