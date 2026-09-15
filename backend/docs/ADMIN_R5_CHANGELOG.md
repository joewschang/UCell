# Reviewed Backend v0.6.10-R5 — Operations Ready

No R1.0B compensation rate, matrix, pool percentage, Active rule, Sponsor/Binary rule or lifecycle economics changed.

## Added
- Immutable DocumentAttachment metadata with SHA-256/version/supersede.
- Audit search.
- Operations report.
- Integrity alerts.
- Qualifications / Orders / Payouts CSV export.
- Global `/admin/*` authentication guard.
- Non-production-only `ADMIN_AUTH_BYPASS`.

## Integrity alerts
- Recovery arithmetic mismatch.
- Payout net mismatch.
- Active flag without an effective ActivePeriod.
- Current plan vs PlanHistory mismatch.
- EFFECTIVE MembershipApplication without Qualification.
- Paid Order without GPV after grace window.

## Storage boundary
Document bytes are not stored in PostgreSQL. The core stores immutable metadata and hash; actual bytes live in configured external storage such as Google Drive or Azure Blob.

## Security boundary
R5 protects every `/admin/*` endpoint with an authenticated backend session by default.
DEV bypass requires `ADMIN_AUTH_BYPASS=true` and is ignored in production.
Formal Entra/JWT verification and MFA remain future production gates.
