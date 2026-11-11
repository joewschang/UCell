# Daily greeting publishing: next Codex handoff

Tracking: https://github.com/joewschang/UCell/issues/53

## Latest user direction

The system must support both automatic publishing and manual publishing in the management backend. A cloud schedule must continue when the Codex/developer computer is off. The user also wants dot to generate a greeting image and publish it through the backend when authorized. Every outward-facing image must use the supplied official gold UCell logo, with its original proportions.

## What this branch does and does not do

Phase 1 provides the Explore card, dated public PNG/share endpoints, brand template renderer, official logo, scheduled in-process 07:00 Taipei date switch, and member-initiated LINE sharing/saving. See DAILY-GREETINGS.md for passed checks and limits.

It does **not** implement an admin upload form, upload or publishing API, persistent media repository, publishing approval history, external cloud scheduler, generative-AI image provider, or a dot login/integration. Nothing is deployed. Do not close issue #53 on the basis of this phase alone.

## Recommended next implementation

1. Inspect current production revisions and the existing content/Admin authorization workflow before changing it. Reuse the existing content DRAFT/PUBLISHED/ARCHIVED concepts, idempotency guard, audit service and permitted roles rather than bypassing review with direct database writes.
2. Add a date-keyed daily-greeting publication record with asset/version, category, title, public copy, Taipei publication time, status, creator and approver, hash and audit references. Prevent two active versions for the same date. Use a backward-compatible migration and verified rollback plan.
3. Add image upload to authenticated Admin only. Validate MIME by decoded bytes, allow PNG/JPEG only, limit size/dimensions and pixel count, reject SVG/HTML and malformed inputs, remove unnecessary metadata, and store drafts privately. Verify the actual official logo is present in the final preview; do not distort or re-generate the official artwork.
4. Add a management screen for upload, preview, choose date/time, save draft, publish/schedule, inspect status/failure, replace and withdraw. A published version should use an immutable image URL. Keep prior versions for rollback. Make publication/retry idempotent and do not expose drafts through the public API.
5. Move automatic generation/publishing into an independently hosted Azure scheduled job or an equivalent existing cloud scheduler. A provisional daily target is 07:00 Asia/Taipei; prepare and validate before the release boundary. Reuse the tested template as an operational fallback. If adding a generative-AI provider, confirm service, credentials, cost cap and content review requirements before enabling billable calls. No member data is needed.
6. Adapt the current endpoint to resolve the latest published/approved record first. An unavailable/failed new image should keep the previous published image with an honest displayed date and status, not silently claim it is today's. Define fallback priority and alerting without sending unsolicited member notifications.
7. For dot publishing, use the user's approved UCell Admin identity and the same upload/publish path, or a separately authorized least-privilege integration limited to greeting assets and draft/publish actions. Do not reuse database, payment, broad admin or personal account secrets. Obtain any required credential/access approval using the supported secure setup. No current login, integration credential or standing authentication grant has been verified here.

The user's request covers publishing UCell greeting artwork to the UCell member frontend and their explicit manual/automatic upload workflow. It does not cover unrelated third-party uploads, sharing member data, signing up for a paid image service, bypassing review gates, or granting broad persistent system access. Any materially broader destination, cost or permissions require confirmation.

## Required acceptance tests

- Admin permissions, wrong-role rejection, file validation, preview and non-public draft access.
- Idempotent scheduling, parallel attempts, retries, version replacement, cancellation/withdrawal and rollback.
- Taipei 07:00, restarts, scheduler outages and developer computer powered off.
- Official logo integrity/proportion and Traditional Chinese rendering in every output path, including uploaded and generated images.
- Authorized dot upload and publish through the same audited interface; no assumption that creating a ChatGPT reminder publishes to UCell.
- Actual LINE image picker/send/cancel, normal-browser link fallback, iOS/Android save flow and public image/OG fetch.
- Exact committed CI, database/security/UAT/release gates, image digests, deployment revisions and read-only production smoke. Keep source-level success separate from production activation.

## Execution blockers in this environment

Azure CLI/publishing identity and production revision access were not available. No existing connected UCell desktop or saved UCell cloud configuration was listed; only this temporary cloud workspace was available. Chromium could not launch because the host denied its socket setup. Git CLI had no GitHub credential; the connected GitHub integration is used only to publish the review branch/PR. These are access/verification limits, not evidence of a production outage.
