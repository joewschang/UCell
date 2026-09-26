# G8 final blocker matrix — 2026-09-26

| Mandatory gate | Status | Disposition |
|---|---|---|
| Stage migration 87 append-safe recovery | PASS | Stage is current at 87 migrations; postcondition, audit integrity and Prisma reconciliation passed. |
| Stage API/Worker controlled deployment | PASS | Digest-pinned API/Worker healthy; Admin/Member UAT frontend unchanged. |
| Stage isolated DB backup/restore | PASS | Seven-day PITR restore at a pre-87 point, 86 migrations and original append-only audit trigger verified; isolated server deleted. |
| Admin login-failure audit Stage exercise | PASS | Controlled invalid Entra exchange was denied and wrote privacy-safe audit/correlation evidence. |
| Member BOLA-denied audit Stage exercise | BLOCKED_EXTERNAL | Existing guarded Stage synthetic session works, but browser automation cannot access its storage and token export is prohibited. Execute one controlled human UAT denial and verify the resulting safe audit event. |
| Source recovery independent copy | BLOCKED_EXTERNAL | Requires Storage Blob Data Contributor at the approved storage scope. |
| Evidence-storage recovery | BLOCKED_EXTERNAL | Depends on the same data-plane Storage role and restored-object verification. |
| Minimum monitoring alert delivery | DECISION_REQUIRED | Named owner and delivery-capable Action Group receiver are not approved. |
| RPO/RTO | DECISION_REQUIRED | Candidate RPO <= 1 hour / RTO <= 4 hours are not business-approved values. |
| LINE/Entra credential drill | BLOCKED_EXTERNAL | Approved Stage credentials, callback configuration and owner are unavailable. |
| Role/grant change audit exercise | PASS | Controlled Stage synthetic immutable grant revoke/replacement/revoke drill recorded privacy-safe grant/change/revoke audit events with actor/target/trace evidence. |

**G8 OPERATIONAL_READINESS = NOT_YET_PASS.** No Production action is authorized.

