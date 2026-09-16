# V1.2 External Content Backend Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Implemented

- Added versioned `PublishedContent` and immutable `ContentVersion` persistence.
- Supports `VIDEO_EXTERNAL` and `EXTERNAL_LINK` with HTTPS URLs only.
- Added Admin create, add-version, and publish APIs with role guards, idempotency, audit evidence, and a `CONTENT_PUBLISHED` outbox event.
- Added authenticated Member list/detail APIs. Only network/formal members can read published content inside its publish window.
- Member reads return the highest visible version per content; historical published versions remain append-only.
- Added publish approval reference, content hash, actor, and timestamp evidence.

## Fail-closed scope

Binary media upload is not enabled. Object storage, malware scanning, upload limits, retention, and signed-access policy have no approved production decision, so this release accepts external HTTPS references only. No production content or approval fixture was seeded.

Content share attribution will reuse the existing Qualification-bound referral flow in the following frontend integration slice. The backend does not calculate monetary values.

## Verification

- Fresh PostgreSQL: 35 forward migrations applied with `prisma migrate deploy`.
- Isolated DB Golden: PASS and database cleaned up.
- CMS DB Golden: 8 assertions PASS (versioning, publish window, audience, immutability, latest-version read).
- Existing DB Golden: System Assignment 8, Member/Admin Integration 59, Member Identity 356 assertions PASS.
- Backend and Worker builds: PASS.
- Backend Jest on disposable fresh DB: 17 suites; 185 passed; 3 existing TODO placeholders remain.
- Admin: build PASS; 10 files / 22 tests PASS.
- Member: build PASS; 18 files / 124 tests PASS.
- Static, schema, migration, OpenAPI, and security policy preflights: PASS.

## Release gates

`test:todo:gate` remains BLOCKED by three existing executable placeholders:

- `apps/api/test/negative-flow-v05.e2e-spec.ts`: 1
- `apps/api/test/vertical-slice-02.e2e-spec.ts`: 2

Formal LINE/LIFF credentials, formal Entra/RBAC, Security E2E, UAT, and Production Promotion remain BLOCKED and are not represented as PASS.