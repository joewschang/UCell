# V1.2 Content Cross-end Integration Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Delivered

- Admin content route and navigation for external video/link drafts, immutable new versions, and approval publishing.
- Admin version-history API with newest-first immutable evidence.
- Corrected content authorization to existing roles: `SUPER_ADMIN` and `ORDER_OPS` may write; `COMPLIANCE_AUDIT` is read-only.
- Member content list and detail routes show only Core-authorized published content inside its publish window.
- Shareable content creates the existing server-issued, Qualification-bound referral link and adds a validated content destination.
- Referral landing records the existing 30-day attribution before routing to the content detail. Content destination never changes Sponsor or attribution ownership.
- Content IDs and route parameters use UUID validation; missing, expired, foreign-audience, or unpublished content fails closed.

## Storage boundary

Only HTTPS external references are supported. Binary media upload remains blocked until object storage, malware scanning, size/type limits, retention, and signed-access policy are formally approved.

## Verification

- Backend and Worker production builds: PASS.
- Admin production build: PASS; 10 files / 22 tests PASS.
- Member production build: PASS; 18 files / 126 tests PASS.
- Fresh DB: 35 migrations deployed; isolated database cleaned after test.
- Content DB Golden: 10 assertions PASS, including Admin immutable history and Member latest-visible version.
- Existing connected gates: Member/Admin 59, Member Identity 356, System Assignment 8 assertions PASS.
- Static, schema, migration, OpenAPI, and security policy preflights: PASS.

## Remaining release blocks

The existing three executable Jest placeholders remain release-blocking. Formal LINE/LIFF credentials, formal Entra/RBAC, Security E2E, UAT, approved binary-media policy, and Production Promotion remain BLOCKED.