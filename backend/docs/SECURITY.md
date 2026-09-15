# Security baseline

- Admin MFA / Entra ID-ready.
- Member LINE token must be verified server-side.
- BOLA/IDOR testing is P0.
- Qualification ownership must be checked server-side.
- No raw national ID/bank account in logs.
- PII uses encryption + masking.
- Swagger PROD disabled or protected.
- Secrets in Key Vault, never in repo.
- Integration webhooks require signature/OAuth + replay protection.
- Rate limit public referral and auth endpoints.
