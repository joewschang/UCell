# Phase 1 controlled error-code catalog

This catalog governs material operational errors. Codes are stable identifiers for logs, trace correlation, monitoring and sanitized repair evidence; they do not expose secrets, raw request bodies, or unrestricted PII.

| Prefix | Domain | Examples | Owner action |
|---|---|---|---|
| `AUTH_`, `ACCESS_` | authentication, authorization, BOLA | `AUTH_ACCESS_DENIED`, `ACCESS_SCOPE_INVALID` | validate identity/grant and security audit |
| `PAYMENT_` | provider confirmation and persistence | `PAYMENT_CONFIRMATION_FAILED` | preserve provider evidence; idempotent retry only |
| `PLACEMENT_` | pending placement/topology | `PLACEMENT_SLOT_UNAVAILABLE`, `PLACEMENT_AUTHORIZATION_DENIED` | do not allocate Ball or activate Qualification on failure |
| `LINE_LINK_`, `LINE_REBIND_` | LINE identity linkage | `LINE_LINK_TOKEN_INVALID`, `LINE_REBIND_DENIED` | revoke/escalate via account-security flow |
| `RETAIL_REFERRAL_` | Retail attribution/award history | `RETAIL_REFERRAL_PLAN_EVIDENCE_MISSING` | inspect immutable snapshots; no current-state recalculation |
| `RETURN_REPLAY_`, `RECOVERY_` | return/replay/recovery | `RECOVERY_BALANCE_MISMATCH` | use append-only correction/recovery |
| `ERP_HANDOFF_` | enabled ERP handoff | `ERP_HANDOFF_RETRY_REQUIRED` | retry idempotent outbox message only |
| `PROVIDER_` | external webhook/provider worker | `PROVIDER_WORKER_BATCH_FAILED` | inspect inbox/outbox and provider evidence |
| `WORKER_`, `RECOGNITION_` | background work | `WORKER_TICK_FAILED`, `RECOGNITION_PROCESSING_FAILED` | preserve trace and retry classification |
| `INTERNAL_`, `HTTP_` | unexpected technical failure | `INTERNAL_UNEXPECTED`, `HTTP_4XX_REQUEST_FAILED` | use fingerprint and sanitized diagnostic package |

The common `UCELL_STRUCTURED_ERROR` envelope includes controlled code, service, operation, trace ID, release, retryability and a SHA-256 fingerprint. It intentionally excludes raw exception message, stack, request body and secrets. New material codes require this catalog and focused regression evidence.
