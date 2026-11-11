# Greeting publishing and social sharing — release draft

Tracking: #53. Base feature PR #55 is merged at `0da4e75b`; production-preserving overlay and API scheduler are tracked in PR #56. Production deployment, schedule activation and dot authorization remain incomplete. See `greeting-overlay/verification.json` for current evidence.

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

The preferred host is the existing always-on API, with `DAILY_GREETING_API_SCHEDULER_ENABLED=true` and publication enabled after backup, restore and UAT gates pass. Keep API minReplicas at least 1. This creates no separate resource and uses the API's existing identity and database connection. Bootstrap returns immediately and queues current-date catch-up; native image work runs on the existing bounded worker-thread queue. The scheduler uses Asia/Taipei release dates (07:00 boundary), retries failures from 30 seconds up to 15 minutes, and shares version/date idempotency keys and PostgreSQL publication locks across replicas. A manually approved publication wins. Restart or lost acknowledgments do not duplicate publication or audit records. It does not backfill unlimited missed dates. Disabling the scheduler flag and restarting stops future dispatches.

The one-shot command remains available for an authorized manual catch-up; no separate Container Apps Job is required or provisioned. Production activation and the next actual Taipei 07:00 run remain unverified.

By default either entry point creates a draft requiring human review. To automatically publish the fixed reviewed template only, the operator must separately configure both `DAILY_GREETING_TEMPLATE_AUTO_APPROVAL=true` and a nonempty `DAILY_GREETING_TEMPLATE_APPROVAL_REFERENCE` identifying the approved template/content policy. These are not configured here. Never use this switch to bypass review for arbitrary AI-generated uploads. Changing template/brand content requires a renderer version change and new review.

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

Current isolated validation: backend build; 6 focused API suites / 37 tests plus 162 database assertions; 18 member and 2 admin tests; browser smoke at 320/390/768/1280 widths; mocked admin upload/preview/approval and role boundaries; actual candidate-image CJK/official-logo PNG rendering; synthetic database backup/restore; dual-process scheduler convergence to one published row and one upload/publish audit pair. The event-loop heartbeat continued during native rendering. Original production API and frontend files were compared against pinned image digests; only the intended module-registration/index hooks change.

These are isolated results, not proof of production deployment or real-device social posting. A production backup/restore and full candidate boot against the restored production schema are still required: main alone lacks tables used by the live notification overlay. Workstation database connection is refused and a temporary single-IP firewall exception is awaiting explicit user authorization. No firewall change, production migration/deployment, new Job, new secret holder or dot credential was applied. Follow PRODUCTION.md, then validate real front/back-office workflows and the next Taipei 07:00 run. Detailed current evidence: `greeting-overlay/verification.json`.
