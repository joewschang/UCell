# Daily greetings: external Dot PNG push (disabled pending identity setup)

The preferred path is Dot cloud `image_gen` -> PNG -> authenticated publish API. It does not require an Azure image deployment, `AI_AZURE_KEY`, or `DAILY_GREETING_IMAGE_BUDGET_APPROVED`. This PR implements the receiving API; it does not claim that Dot currently has an unattended identity or that production is activated. The separate Azure generation option below stays off.

## External contract

`POST /api/v1/integrations/dot/daily-greetings/publish`

- Bearer: dedicated Entra v2 app-only RS256 token, pinned tenant/audience/client/service-principal object, `idtyp=app`, no delegated scope, sole role `Greeting.Publish`, accepted only before both `exp` and `iat + 3600` (zero grace), with integer times, no future `iat`, and `0 < exp - iat <= 5400`. A `Greeting.Generate` token or combined roles is rejected.
- `Idempotency-Key`: UUID generated once and persisted with the request for retries.
- JSON has exactly `date`, `title`, `message`, `contentBase64`. Title is 1-8 characters, message 1-60; plain trimmed text, no URLs, markup, controls or arbitrary prompts. Date must be the released Taipei date (07:00 boundary), never before 2026-11-17.
- PNG is an **unbranded background**, exactly 1024 x 1024, 8-bit RGB/RGBA, not animated, at most 8,000,000 decoded bytes. No remote image URLs. Do not send a complete poster here: server composition crops the background to the photo area and adds the short title, date, simplified official logo and LINE QR. The admin's explicit `artwork` mode separately preserves already completed artwork.
- Native decode/composition runs in a bounded worker with a 20-second deadline. Missing CJK font fails closed. Canonical pixels are hashed so changing PNG metadata does not bypass the cross-date duplicate check.
- Publication, date reservation and audit are transactional. Same request/actor/payload returns the existing publication. Published content cannot be replaced. For 503 or network uncertainty retry the **same payload and key**, with bounded backoff; do not generate a new image/key to bypass a conflict or manually delete the date reservation.
- `GREETING_PUSH_ENABLED=true` suppresses the legacy template scheduler for this deployment; the external cloud task must own 07:00 scheduling and catch-up. Enable only once actual cloud authentication and delivery are verified.

## Exact one-time setup and current blockers (2026-11-16)

1. **Unresolved cloud identity custody.** The available Dot tools include cloud image generation, but expose no verified Entra/OIDC token issuer, generic secret vault, or credential-backed HTTP connector. The Sites repository credential is unrelated and must not be reused. Do not assume an OIDC issuer/subject or paste a token into chat. A supported cloud runtime must first provide either a verified federation issuer/audience/subject, or secure vault-backed certificate authentication and an HTTP upload capability. No such handoff has been verified here; a manual local token is not a PC-off solution.
2. **Separately approved narrow Entra setup.** Reuse an existing dedicated principal only after verifying its permissions, otherwise obtain approval to create a dedicated API audience and publisher client. Define one application role `Greeting.Publish` on that audience, enable v2 access tokens and the `idtyp` optional claim, assign only that role to the publisher. Runtime needs no member/finance/admin roles, Azure resource RBAC, Microsoft Graph permissions, or deployment credentials. Record the actual tenant ID, API audience, client ID and service-principal object ID from Entra; none are fabricated or provisioned by this PR. Certificate private keys, if approved, belong only in the platform-supported vault, never source, command arguments, logs or chat. Use rotation/revocation and short-lived access tokens. The guard accepts a token only while `iat <= now < min(exp, iat + 3600)` and requires safe integer nonnegative times with `0 < exp - iat <= 5400`. Entra defaults can be 60-90 minutes; these tokens are accepted only during their first hour. No tenant token-lifetime policy change is required. There is no expiry/age clock grace; future `iat` is rejected. A real token-claims check and synchronized server clock remain activation prerequisites. Both the publish and optional generate guards share this rule. See [Microsoft access-token lifetime documentation](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens#token-lifetime) and [external federation prerequisites](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-create-trust).
3. Configure `GREETING_PUSH_TENANT`, `GREETING_PUSH_AUDIENCE`, `GREETING_PUSH_CLIENT`, `GREETING_PUSH_OBJECT_ID` with those verified GUIDs. Leave `GREETING_PUSH_ENABLED=false` until setup and release verification pass. `DAILY_GREETING_PUBLISHING_ENABLED=true` is needed for publication. Keep `DAILY_GREETING_CLOUD_ENABLED=false`, `GREETING_MACHINE_ENABLED=false`, and the Azure image budget switch off for this route.
4. Release the additive generation table migration only after repository release gates, backup/restore evidence and isolated DB UAT pass. Reconcile production overlays before building; do not deploy a whole checkout over them. Main/PR #76 was merged at `d959e7af1bd5721893e86c89b614f43a5dea24fd`, preserving complete-artwork uploads, 3 MiB input and 5 MiB stored-image limits. Production at the last verified artwork rollout: API `ucell-prod-api--artwork-261116`, admin `ucell-prod-admin--artwork-261116`. A later read-only check on November 16 found API `ucell-prod-api--assisted-checkout-261116`, digest `sha256:5362791de6e991d8134bb4cf8c87541bc13c5892fb3e293c5fa4eca9f153ca6e`; the three external/cloud feature flags were absent. Re-read revisions before any future rollout; preserve assisted-checkout, paper-signature and other unrelated overlays. No production migration or feature deployment is claimed here.
5. Verify from the actual cloud runtime: reject anonymous/wrong principal/wrong role; generate a new licensed background, transmit PNG with the dedicated identity, publish one eligible date, retry without duplication, retrieve public/member/admin versions, inspect readable Chinese/logo and decode official QR. Exercise concurrent requests, expired tokens and a stopped local PC. Root owns the Taipei 07:00 cloud schedule; this PR does not create it. Never modify the separately managed November 16 publication.
6. Enable only after the above evidence exists. SwaggerHub publishing remains paused. If identity custody cannot be supplied, keep the route disabled and report that exact blocker; do not broaden credentials or buy an Azure model as a workaround.

## Offline uploader preparation

See [UPLOADER.md](UPLOADER.md) for the secret-free uploader interface, strict PNG subset, mock verification and unverified live-auth boundary. The explicit Node HTTPS adapter and local SQLite journal are prepared, but no token provider, live network integration, durable cross-schedule storage or schedule is configured. See [journal recovery rules](JOURNAL.md).

## Verification scope

New external-route tests cover real JWT signing/verification, role separation, route-specific body limits, disabled/unauthorized behavior, scheduler exclusion, canonical image hashing, malformed PNGs and complete-artwork regression. Isolated database tests exercise concurrent publication, atomic audit, replay, existing-date protection and cross-date reuse. The latest CI result, rather than earlier counts, is authoritative. Native tests use synthetic fixtures, not live generated content.

Earlier autonomous-Azure verification and its separate requirements are retained below for historical scope. They are **not prerequisites for external Dot push** and do not establish that external authentication works.

---

# Cloud-generated daily greetings (disabled pending activation)

The existing always-running API can generate a new photographic background and directly publish a branded 1080 x 1080 greeting after Taipei 07:00, including startup catch-up. No PC or human per-image approval is required. The existing template path is unchanged while cloud mode is disabled. This implementation is not yet activated in production.

## Verified implementation

- One durable row per released Taipei date, five-minute lease, transactional publication and audit, no replacement of any published image. Dates before 2026-11-17 are excluded to protect the separately managed November 16 image.
- Provider attempts are capped durably per date (default one; configurable 1–3). Retry waits one minute, including after restart; an expired lease can be reclaimed within the cap. A crash after sending a model request may incur a charge without publishing; exact-once external billing cannot be guaranteed. Exhaustion fails closed, with no silent template substitution.
- Fresh provider background requested for each date; a repeated background hash cannot publish on another date. Fixed reviewed Traditional Chinese copy, original scenery prompts, existing simplified admin logo and static official LINE QR `https://lin.ee/pqS11xX`. No member data, invented live weather, arbitrary prompts or image URLs are sent/accepted.
- Bounded HTTPS response, PNG CRC/dimension/decompression validation, native decode and composition in a worker thread, 20-second render deadline. Only sanitized failures are logged. Upstream content filtering must remain enabled.
- Optional machine route: `POST /api/v1/integrations/dot/daily-greetings/generate`, JSON containing only `date`. Tenant, audience, client and service-principal object ID are pinned. Only an RS256 app-only Entra token with the sole `Greeting.Generate` role, `idtyp=app`, no delegated scope and accepted only before both `exp` and `iat + 3600` (zero grace), with integer times, no future `iat`, and `0 < exp - iat <= 5400` is accepted. Existing `/drafts` remains disabled. Anonymous writes are never enabled.

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
