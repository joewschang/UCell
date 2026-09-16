# V1.1 Formal Member Application Draft Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Delivered

- Added Person-owned Formal Member application records and append-only encrypted snapshots.
- Added Member APIs for effective Formal Member contracts, consent, encrypted draft save, and masked current-draft read.
- Added Member UI for formal contract review and the requested legal name, gender, birth date, national ID, communication address, phone, email, bank code, bank account, and account-holder fields.
- Sensitive draft payloads use the existing AES-256-GCM PII service and configured key version.
- Ordinary responses expose only national-ID and bank-account last four digits.
- Audit and outbox evidence contain IDs, version, hash, and completeness only; no national ID, bank account, address, phone, email, or document bytes.
- Each edit appends a new immutable snapshot. Lost-response retries retain one effect.

## State boundary

Saving a draft does not submit KYC, change `NETWORK_MEMBER`, create a Qualification, alter Sponsor/Binary history, or claim bank/provider verification. `FORMAL_PENDING` and `FORMAL_MEMBER` transitions remain unavailable in this slice.

## Fail-closed Production blocks

Document upload and KYC submission remain blocked until these approved prerequisites are configured:

- exact required ID document sides and legal/capacity policy;
- versioned retention classes and verified retention periods;
- private object storage, signed access, size/type checks and malware scanning;
- authoritative bank master/account validation and manual-review SOP;
- production PII key management and KYC reviewer RBAC mapping.

SMS OTP and Google OIDC remain `DISABLED_CURRENT / FUTURE_WEB_APP` under `NEXT_RELEASE_AUTH_CHANNEL_DECISION_APPROVED.md`; this slice does not enable them.

## Verification

- Fresh PostgreSQL: 36 forward migrations deployed and isolated database cleaned.
- Formal Application DB Golden: 12 assertions PASS.
- Existing connected Golden gates: Content 10, Member/Admin 59, Member Identity 356, System Assignment 8 assertions PASS.
- Backend and Worker builds: PASS.
- Member production build: PASS; 19 files / 127 tests PASS.
- Prisma generate/format, schema, migration, OpenAPI, static, and security policy preflights: PASS.

The existing three executable Jest placeholders and formal LINE/LIFF, Entra/RBAC, Security E2E, UAT, and Production Promotion gates remain BLOCKED.