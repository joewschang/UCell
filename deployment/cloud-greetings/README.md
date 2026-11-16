# Cloud-generated daily greetings (disabled pending activation)

The existing always-running API can generate a new photographic background and directly publish a branded 1080 x 1080 greeting after Taipei 07:00, including startup catch-up. No PC or human per-image approval is required. The existing template path is unchanged while cloud mode is disabled. This implementation is not yet activated in production.

## Verified implementation

- One durable row per released Taipei date, five-minute lease, transactional publication and audit, no replacement of any published image. Dates before 2026-11-17 are excluded to protect the separately managed November 16 image.
- Provider attempts are capped durably per date (default one; configurable 1–3). Retry waits one minute, including after restart; an expired lease can be reclaimed within the cap. A crash after sending a model request may incur a charge without publishing; exact-once external billing cannot be guaranteed. Exhaustion fails closed, with no silent template substitution.
- Fresh provider background requested for each date; a repeated background hash cannot publish on another date. Fixed reviewed Traditional Chinese copy, original scenery prompts, existing simplified admin logo and static official LINE QR `https://lin.ee/pqS11xX`. No member data, invented live weather, arbitrary prompts or image URLs are sent/accepted.
- Bounded HTTPS response, PNG CRC/dimension/decompression validation, native decode and composition in a worker thread, 20-second render deadline. Only sanitized failures are logged. Upstream content filtering must remain enabled.
- Optional machine route: `POST /api/v1/integrations/dot/daily-greetings/generate`, JSON containing only `date`. Tenant, audience, client and service-principal object ID are pinned. Only an RS256 app-only Entra token with the sole `Greeting.Generate` role, `idtyp=app`, no delegated scope and lifetime at most one hour is accepted. Existing `/drafts` remains disabled. Anonymous writes are never enabled.

## Activation blockers observed 2026-11-16

Azure account `ucell-prod-ai-20261022` currently has only deployment `ucell-prod-planner` (gpt-4.1-mini). It cannot generate images. No image deployment, new role grant, credential, paid resource, or live model request was created by this change.

1. Obtain one-time approval for a compatible Azure image deployment and a usage budget, then confirm region/model availability, deployment API support and actual pricing. Text-token limits do not cap image charges. Default maximum is one request per date (up to 31 requests in a 31-day month); increasing attempts increases possible charges. A monetary budget alert is not a hard spending cap.
2. Configure the approved image deployment on the existing account, using the existing API secret reference only if authorized for the new model. Set `DAILY_GREETING_IMAGE_DEPLOYMENT`, `DAILY_GREETING_IMAGE_BUDGET_APPROVED=true`, `DAILY_GREETING_IMAGE_MAX_ATTEMPTS=1`. Keep `DAILY_GREETING_CLOUD_ENABLED` off until release gates and live model UAT pass. Do not print secret values.
3. Keep `DAILY_GREETING_API_SCHEDULER_ENABLED=true` and `DAILY_GREETING_PUBLISHING_ENABLED=true`. Verify the API remains at least one replica and has startup/health recovery; a scale-to-zero API cannot run an in-process timer. Existing font and image assets must be present in the final Linux image. Set cloud mode true only after the additive migration and verified deployment.
4. External Dot access is optional for autonomous API generation. It requires a separately approved dedicated app role/principal or existing appropriately limited principal. Set `GREETING_MACHINE_ENABLED`, `GREETING_MACHINE_TENANT`, `GREETING_MACHINE_AUDIENCE`, `GREETING_MACHINE_CLIENT`, `GREETING_MACHINE_OBJECT_ID` only after that approval. Configure v2 tokens and app `idtyp` claim; prefer workload identity federation/managed identity, without creating a long-lived secret. Do not reuse a broadly privileged deployment identity. Otherwise leave this route disabled; internal scheduling does not require this grant.
5. Reconcile current production-only overlays before building a release. Observed base main was `f27015f`; production API revision was `ucell-prod-api--paper-signature-261116`, image digest `sha256:28c1034e6bea8974fc306f77e8c05340301f5946dfe1d8fb89b4207c731b9ec9`. In particular, do not regress production upload limits or other unrelated functionality by replacing the full image with this checkout uncritically.
6. Run all repository release gates, backup/restore rehearsal, additive migration, staged Linux model generation UAT, actual public/member/admin retrieval and QR checks, cross-replica/restart verification, and rollout monitoring. None of these production/model checks is claimed by local fixture tests. Never touch the November 16 publication. SwaggerHub publishing remains paused.

## Local validation

Prisma generation and API TypeScript build passed. All 21 offline checks in `backend/scripts/ci-gate.sh` passed. The isolated PostgreSQL harness applied all migrations, passed its 162 real database assertions, and ran seven focused suites / 53 tests successfully. Suites include cloud authentication/provider policy/HTTP/concurrent publication and existing scheduler/publication regressions. The harness removed its synthetic databases afterward.

Native compiled-worker rendering was also exercised using the existing kitten fixture (not a newly generated model image): 1080 x 1080, 1,947,952 bytes; official QR decoded exactly; invalid PNG rejected. Visual inspection confirmed readable Traditional Chinese, simplified logo and lower-right QR. `verification.json` records this scope; no real model generation or live publication is implied.

Example local regression command from `backend` with a **local synthetic** `DATABASE_URL`:

```
node scripts/api-jest-isolated.mjs --runTestsByPath test/cloud-greeting-security.e2e-spec.ts test/cloud-greeting-db.e2e-spec.ts test/cloud-greeting-http.e2e-spec.ts test/daily-greeting-scheduler.e2e-spec.ts test/greeting-publishing.e2e-spec.ts test/greeting-scheduler-db.e2e-spec.ts test/greeting-publication-db.e2e-spec.ts
```

## Disable / recovery

Disable cloud mode and external machine access to stop new requests. Keep already published content and audit history. An in-flight request may already be billed or publish; inspect its lease/status and publication before retrying or rolling back. Reverting to the prior revision leaves the additive table harmlessly unused. Do not delete jobs to bypass the daily attempt cap or delete production publications as a rollback. Restore the previous template setting only as an explicit operational choice; it is not fresh image generation.

Provider contract reference: https://learn.microsoft.com/azure/ai-services/openai/how-to/dall-e?tabs=gpt-image-1 (deployment images/generations, API 2025-04-01-preview). Compatibility must be reconfirmed against the approved deployed model.
