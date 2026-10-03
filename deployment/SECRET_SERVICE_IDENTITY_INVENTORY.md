# G8 secret and service-identity inventory

**Scope:** Stage metadata captured 2026-09-26. This is an ownership and recovery inventory only. It contains no secret values, connection strings, token material, certificate content, or member data.

| Configuration class | Stage storage/reference | Runtime consumer | Recovery/rotation owner | Current disposition |
|---|---|---|---|---|
| PostgreSQL credential | Stage deployment secret / approved secret store | API, Worker, migration Job | Release + DB operator | Owner and tested Stage restore drill pending |
| PII encryption key | `STAGE_PII_ENCRYPTION_KEY` secret reference | API encryption services | Security/Data owner | Rotation procedure requires controlled continuity test |
| Stage synthetic UAT token | `STAGE_UAT_MEMBER_TOKEN` secret reference | Stage-only API and Member UAT entry | Release operator | Stage-only; never valid in Production |
| LINE Login / LIFF configuration | Stage secret/config reference | Member/API LINE integration | LINE integration owner | Formal credential and callback verification pending |
| Entra configuration | Stage secret/config reference | Admin/API Entra exchange | Identity owner | Formal tenant/client/redirect verification pending |
| Payment/provider credentials | approved secret store reference | Worker/provider adapter | Finance/Provider owner | Provider-specific recovery contact pending |
| Application Insights connection configuration | Azure resource/config reference | API and Worker telemetry | Platform operator | Resource present; alert delivery owner pending |
| Managed identity / workload federation | Azure/GitHub federated identity | deployment and Azure resource access | Platform operator | Least-privilege review and break-glass owner pending |

## Recovery controls

1. Secret values are never written to Git, logs, issues, audit payloads, this inventory, or Google Drive.
2. Rotation must use the approved secret store, verify the affected Stage health path, and retain a controlled release/audit reference.
3. A change of secret, identity, role assignment, or callback/redirect must be recorded as an operational change with owner, scope, tested revision, and rollback disposition.
4. Production has its own independently provisioned secret and identity set; Stage UAT credentials cannot satisfy Production authentication.

## Remaining external operational decisions

- Assign named primary and backup owners for DB/PII, LINE, Entra, payment and platform identities.
- Approve rotation cadence and an RPO/RTO-compatible recovery exercise.
- Configure delivery-capable monitoring receivers; Azure RBAC receiver objects are not alert delivery.
