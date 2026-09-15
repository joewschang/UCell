# Backend Reviewed R6 Self Audit

## What changed
No R1.0B economic rule changed.

R6 adds:
- explicit `AdminAccessGrant`,
- Microsoft Entra JWKS/issuer/audience/tenant validation,
- short-lived opaque backend sessions,
- logout/revocation,
- global `/admin/*` authentication,
- fail-closed RBAC,
- UAT/security/release preparation gates.

## Important review correction made during R6
The first version of the global Admin Authentication Guard matched any URL containing `/admin/`.
That would also have matched `/api/v1/auth/admin/entra/exchange` and blocked the public Entra-to-UCell session exchange.

It was corrected to protect only the actual Admin API namespace:
`/api/v1/admin/*` (or equivalent `/admin/*` request path),
while leaving `/api/v1/auth/admin/*` available for authentication exchange.

This is now checked by `SECURITY_POLICY_PREFLIGHT_PASS`.

## Security properties
- Entra token must pass cryptographic verification through Microsoft JWKS.
- issuer, audience and tenant are verified.
- valid Microsoft identity alone is insufficient: an ACTIVE AdminAccessGrant is required.
- Admin backend session TTL is configurable and defaults to 3600 seconds.
- revoked/expired sessions fail authentication.
- every `/admin/*` controller needs role metadata.
- missing metadata fails closed with `ROLE_POLICY_MISSING`.
- payout dual approval still requires separate Finance/Compliance actors.

## Known limitations / hard gates
Not executed in this offline environment:
- dependency installation,
- real TypeScript compilation against `jose`,
- Prisma Client generation for `AdminAccessGrant`,
- PostgreSQL migration 0016,
- real Entra tenant/JWKS network verification,
- live Security E2E,
- human UAT,
- backup/restore drill.

Therefore R6 remains PRE-PRODUCTION.
