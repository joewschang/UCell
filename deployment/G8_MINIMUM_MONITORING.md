# G8 minimum monitoring specification

**Scope:** Stage and future Production must use the same controlled event envelope and alert surfaces. This document does not contain secrets, connection strings, raw PII or alert-recipient values.

## Required monitored surfaces

| Surface | Signal | Severity/action |
|---|---|---|
| API | `/api/v1/health` response and `UCELL_STRUCTURED_ERROR` | Any database-connectivity failure or 5xx: investigate release/revision and trace. |
| Worker | `UCELL_STRUCTURED_ERROR` where `service=worker` | Any `WORKER_*`, `PROVIDER_*`, `RECOGNITION_*` failure: inspect worker revision and outbox/provider evidence. |
| Payment | `PAYMENT_*` structured error and provider inbox backlog | Preserve provider evidence; retry only idempotent governed path. |
| Placement | `PLACEMENT_*`, overdue placement evidence | No Ball allocation/activation on failure; escalate Membership Operations. |
| Award/Return/Replay/Recovery | controlled error plus Admin integrity alerts | Never rewrite historical Award; use append-only correction/recovery. |
| LINE | `LINE_LINK_*`, `LINE_REBIND_*`, LINE provider failure | Revoke/escalate according to account-security runbook. |
| ERP | `ERP_HANDOFF_*` when enabled | Retry approved outbox handoff only. |

## Log Analytics query templates

```kusto
// G8 material structured errors by code, release and trace
ContainerAppConsoleLogs_CL
| where Log_s has 'UCELL_STRUCTURED_ERROR'
| extend event=parse_json(Log_s)
| project TimeGenerated, tostring(event.severity), tostring(event.errorCode), tostring(event.service), tostring(event.operation), tostring(event.releaseVersion), tostring(event.traceId), tostring(event.fingerprint)
| order by TimeGenerated desc
```

```kusto
// Stage application revision health / failures
ContainerAppSystemLogs_CL
| where Reason_s in ('Failed','BackOff','Unhealthy') or Log_s has 'unhealthy'
| project TimeGenerated, ContainerAppName_s, RevisionName_s, Reason_s, Log_s
| order by TimeGenerated desc
```

## Alert policy

- A material `ERROR`/`CRITICAL` structured event, unhealthy revision, or health endpoint failure is actionable immediately.
- Every alert must route to a named operational owner through a delivery-capable Action Group. Azure RBAC-only receivers do **not** satisfy alertability.
- Alert content must contain release/revision, controlled code, fingerprint and trace only. It must not contain raw request payloads, secret values or unrestricted PII.
- Initial alert rule deployment requires the selected Action Group ID and named owner; these are external operational inputs. The repository validates the requirement but does not invent recipients.
