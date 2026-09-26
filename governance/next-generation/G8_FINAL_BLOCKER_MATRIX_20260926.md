# G8 final blocker matrix — 2026-09-26

| Mandatory gate | Status | Disposition |
|---|---|---|
| Stage migration 87 append-safe recovery | PASS | Stage is current at 87 migrations; postcondition, audit integrity and Prisma reconciliation passed. |
| Stage API/Worker controlled deployment | PASS | Digest-pinned API/Worker healthy; Admin/Member UAT frontend unchanged. |
| Stage isolated DB backup/restore | PASS | Seven-day PITR restore at a pre-87 point, 86 migrations and original append-only audit trigger verified; isolated server deleted. |
| Admin login-failure audit Stage exercise | PASS | Controlled invalid Entra exchange was denied and wrote privacy-safe audit/correlation evidence. |
| Member BOLA-denied audit Stage exercise | CONTROLLED_MANUAL_STAGE_UAT | Execute one controlled human UAT denial from an authenticated synthetic member session; then verify the privacy-safe `ACCESS_DENIED` / BOLA event through authorized Admin Audit. Token export is prohibited. |
| Source recovery independent copy | BLOCKED_STORAGE_PERMISSION | Full-ref bundle and isolated restore are PASS; Azure AD data-plane upload to the approved private container was denied. Requires `Storage Blob Data Contributor` for the recovery operator. See `G8_SOURCE_RECOVERY_EXECUTION_20260926.md`. |
| Evidence-storage recovery | BLOCKED_STORAGE_PERMISSION | Depends on the same Blob data-plane write role and remote-object restore verification. |
| Minimum monitoring alert delivery | DECISION_REQUIRED | Named owner and delivery-capable Action Group receiver are not approved. |
| RPO/RTO | PASS | Business-approved RPO <= 1 hour and RTO <= 4 hours are supported by the Stage PITR capability assessment and isolated restore drill. |
| LINE/Entra credential drill | BLOCKED_EXTERNAL | Approved Stage credentials, callback configuration and owner are unavailable. |
| Role/grant change audit exercise | PASS | Controlled Stage synthetic immutable grant revoke/replacement/revoke drill recorded privacy-safe grant/change/revoke audit events with actor/target/trace evidence. |

**G8 OPERATIONAL_READINESS = NOT_YET_PASS.** No Production action is authorized.
