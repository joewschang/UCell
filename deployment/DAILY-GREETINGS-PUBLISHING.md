# Greeting publishing and social sharing — release draft

Tracking: #53. Builds on draft PR #54 (`a2dbdd374348855fd55ee09cdc5c294548445d97`). This implementation is not merged, deployed, scheduled in production, or connected to dot.

## Implemented

- Admin → 影音／連結內容 → 每日問候圖上稿: date, title, copy, PNG upload, private preview, approval reference, publish, withdraw, and reapprove an archived immutable version for rollback. SUPER_ADMIN / ORDER_OPS can write; COMPLIANCE_AUDIT can inspect only, using the existing authenticated Admin guards. The UI requires preview and an approval reference before offering publication. Server-side role checks and approval validation remain authoritative.
- Strict RGB/RGBA 8-bit, non-interlaced PNG input: 600,000 bytes, 256–2048px per side. PNG signature, chunks/CRC, bounded decompression and scanline filters are checked. SVG, HTML, JPEG, animated/palette PNG and malformed files are rejected. Uploaded pixels are re-encoded in a bounded native worker; metadata is discarded. Artwork fits without cropping in the upper 1080×880 area; the exact official 16:9 logo is appended below it. Upload unbranded artwork to avoid a duplicate logo. Preview the final 1080×1080 image before approval.
- Additive `learning.daily_greeting_publication` table contains immutable PNG bytes/hash and metadata. Drafts never have public image access. A partial unique index allows only one published version per date. Existing idempotency transactions and audit records cover upload, approval, replacements, withdrawal and restoration. Replacement IDs and actor subject are recorded; image data and tokens are not logged.
- Approved future versions become visible at 07:00 Asia/Taipei through database time filtering, without a browser needing to stay open. Today's version is immediately available after approval when that boundary has passed. Public URLs bind ID + SHA-256; bytes are never overwritten. Archived URLs return 404; external platforms may retain previews they cached before withdrawal. Older versions remain available privately for reapproval.
- Public current lookup selects the most recent released approved version and preserves its real date if today's generation failed. With no published records it uses the reviewed deterministic template. API restart/warm-up failures retry from 30 seconds up to a 15-minute cap. Normal request rendering retains its separate bounded queue.

## Storage and activation

This release deliberately uses bounded PostgreSQL bytea storage in a dedicated content table, rather than guessing an Azure Blob account, container or credential. It does not add a storage service, paid image provider, or long-lived integration secret. Assess database growth/backup capacity before activation (each stored version can be up to 3 MB; actual template PNGs are much smaller). Retain versions needed for rollback; a future object-store adapter can replace the byte storage while keeping the ID/hash contract.

`DAILY_GREETING_PUBLISHING_ENABLED` defaults off. Apply the additive migration and pass the real isolated PostgreSQL tests before setting it to `true`. When off, the Admin API reports `GREETING_PUBLISHING_NOT_CONFIGURED` and existing template delivery continues. Leave the table in place when rolling back code; do not drop published assets or audit evidence. Back up and exercise restoration before release per PRODUCTION.md.

## Independent cloud generation

The built backend image now contains a one-shot entry point:

```
node /app/apps/api/dist/daily-greeting-job.js
```

It uses the existing database configuration, CJK font and official logo packaged in that image. It opens no HTTP listener, uses no member data, sends no member messages, calls no generative-AI provider, and creates no cloud resources. It retries three times with 5/10-second delays, exits nonzero on failure, and uses stable date/version idempotency keys. A manually published version for that date wins over the template job, including a check inside the date lock.

After the operator verifies the existing Azure environment, image digest, database access, backup plan and release gates, host this command as a separate scheduled Container Apps Job (or the existing approved cloud scheduler), **concurrency 1**, UTC cron `0 23 * * *` = daily 07:00 Taipei, bounded platform retries and failure alerts. Run once immediately after deployment to seed today's record. A late run resolves the currently released Taipei date. It does not backfill an unlimited outage history. The job must run in cloud infrastructure, not on the developer laptop. No job or schedule was provisioned here, and exact dispatch timing has not been validated.

By default the job creates a draft requiring human review. To automatically publish the fixed reviewed template only, the operator must separately configure both `DAILY_GREETING_TEMPLATE_AUTO_APPROVAL=true` and a nonempty `DAILY_GREETING_TEMPLATE_APPROVAL_REFERENCE` identifying the approved template/content policy. These are not configured here. Never use this switch to bypass review for arbitrary AI-generated uploads. Changing template/brand content requires a renderer version change and new review.

## Reserved dot interface

`POST /api/v1/integrations/dot/daily-greetings/drafts` is reserved and always returns HTTP 503 `DOT_GREETING_AUTHORIZATION_NOT_CONFIGURED`. No header, Admin token or feature flag enables it. dot cannot currently upload through this endpoint.

Before enabling it, implement and verify a separate short-lived workload identity with issuer/audience/expiry checks, a named subject, revocation, rate limits and `daily-greetings:draft:create` / own-draft-read scope only. It must call the same validated media/draft/audit path. Publishing is a distinct separately approved scope, not implied by upload access. Require an idempotency key and record actor, source, request ID, content hash and outcome. Never reuse payment, database, broad Admin, or personal persistent credentials. The current user request authorizes reserving this interface, not provisioning such credentials. A human can still use their existing authorized Admin session for manual upload.

## Platform behavior

| Platform | Implemented entry | Image-post alternative |
| --- | --- | --- |
| LINE | LIFF image picker when available; explicitly labeled link fallback otherwise | Save PNG then select it in LINE |
| Facebook | Public URL in Facebook link composer; user confirms | Save PNG, create a post, select the file |
| Threads | Public URL plus greeting title in Threads post intent; user confirms | Save PNG and attach it in Threads |
| X | Public URL plus title in X web intent; user confirms | Save PNG and attach it in X |
| Instagram | Expandable save-and-post instructions; open Instagram explicitly | Save PNG, create a post in the app or desktop website, select file and confirm |

Opening a composer is not a successful post. No platform OAuth permission or automatic posting is requested. Platform login may still be required. Link cards use OG/Twitter card metadata, but platforms control rendering/caching. The UI offers a selectable public URL and PNG/manual fallback if a composer fails. It does not promise that a phone's share sheet contains a particular app. iOS/LINE webviews may require open-original and long-press save; Android/download managers and desktop browsers vary. Real iOS, Android, desktop sessions and account-specific platform behavior remain unverified.

Primary references checked 2026-11-11 (Meta documentation fetches were partly rate limited; no live account posting tested):
- https://developers.facebook.com/documentation/sharing/web
- https://developers.facebook.com/documentation/threads/threads-web-intents
- https://docs.x.com/x-for-websites/web-intents/overview
- https://help.instagram.com/442418472487929/
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share

## Verification and release blockers

Passed locally: additive Prisma schema validation; backend build; 18 focused backend tests; 18 greeting/member tests and member typecheck/build; admin build and content-regression checks; visual inspection of normalized PNG and official logo proportions. Full member/admin suite totals are recorded in the PR.

PGlite 0.5.16 SQL adapter smoke passed migration, private drafts, public release, replacement/reapproval, future-date embargo, manual precedence and audit-call payloads. This is **not** proof of Prisma transaction isolation, durable audit persistence or concurrent-replica behavior. Five real PostgreSQL acceptance tests are included and skip locally without the guarded isolated harness; CI must run them. A broad initial API invocation failed database-dependent suites because no isolated PostgreSQL URL was present; do not treat that run as a passing full backend suite.

Chromium browser smoke remains blocked by host `socket() Operation not permitted` even with the available execution escalation. The updated isolated smoke covers 320/390/768/1280 widths and social labels/manual IG instructions and blocks real social writes, but its execution has not passed here.

No Azure CLI, Docker, production deployment identity/revision readback, real PostgreSQL instance, dot identity setup, cloud scheduler execution, or real-device social account confirmation was available. Keep this PR draft until required CI/OpenAPI/security/UAT/database/backup/release gates pass. Follow PRODUCTION.md to reconcile current deployed revisions before building API/member/admin images, record exact source/digests and rollback revisions, apply the compatible migration, deploy sequentially, activate approved settings and verify the next Taipei 07:00 run. No production or third-party publishing was performed.
