# Stage upgrade candidate — NOT_READY_FOR_STAGE_REVIEW

Review candidate only. Stage deployment/migration/database changes remain STOP awaiting explicit confirmation. Production BLOCKED.

## Source identities

P0 base HEAD: 301a1bb48053472619469d71f5959565fa6d6e76.
Current source after the local LINE foundation is d5420cc21916e6b66a5462880f1a8ebbde5502fe; it adds notification-delivery and LINE event lifecycle migrations. This report remains NOT_READY until current candidate validation, formal credential readiness, and manual UAT evidence are complete.

Read-only observed Stage: resource group rg-ucell-stage; API latest-ready revision ucell-stage-api--r-225957920260917154017.
API image: ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-backend@sha256:afd3082e10f047206e6c01698d7d51b632490b11e1cfb7c83a2efc8b18170a7b.
ACR metadata tag 2259579-20260917154017 resolves to source commit 22595798d30dee1af80aeb832c0d36cede8f5175. This is source-tag evidence, not signed clean-build attestation. Worker/Admin/Member use the same recorded revision suffix; no image was changed.

## Migration / OpenAPI delta

Migration source files: actual Stage applied migration inventory/checksums: NOT_QUERIED. Current repository migration count is 75; this is not an assertion of deployed DB state. Migration 69 corrects PostgreSQL Ball Number validation so ordinals longer than six digits grow naturally instead of being truncated by `lpad`.

New candidate migrations 55–67 cover MVCC tree snapshots, versioned Company LEADER binding, typed final destinations and append-only B, Matching source identity, report snapshots, period jobs/generations/export, safe leaf cycle path, existing owner-exclusion assertion, parent expansion index, publication fence, replay K outputs, partial covering PV reversal index, and immutable job identity. Migration 54 remains unchanged; migration 62 verifies its existing exclusion instead of adding a duplicate GiST index.

OpenAPI: Stage source 134 → 174 (+40); START_HEAD 167 → 174 (+7). All original 167 operations are retained and baseline structural compatibility passes. The older Stage-source raw diff reports one pre-existing operationId rename: GET /api/v1/member/organization/binary, MemberController_binary → memberBinaryOrganization. URL/method unchanged; regenerate/migrate any SDK referencing the old operation name. Do not suppress the retained raw Stage diff failure. Snapshot-aware clients must carry the first-page identity on later pages.

## Environment / Key Vault / secrets

Stage script prepares SWAGGER_ENABLED=true for UAT; it has not been executed. DEV enables Swagger; Production defaults disabled/publicly unavailable. Existing NODE_ENV=staging, UCELL_ENVIRONMENT=STAGE and ADMIN_AUTH_BYPASS=false remain.

Deploy a separately reviewed analytics worker command (pnpm analytics:worker / period-projection-worker.mjs --watch) using the existing database secret. UCELL_PERIOD_WORKER_MAX_JOBS: 1–100, default 1; UCELL_PERIOD_WORKER_POLL_MS: 1000–60000, default 5000. Long rebuilds must not run in the monetary worker. No Stage worker/scheduler was created.

LINE connected delivery requires configured `LINE_MESSAGING_CHANNEL_SECRET`, `LINE_MESSAGING_CONFIG_VERSION`, and `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` in the approved environment secret store. Formal LINE/LIFF and Entra credentials/bindings remain external environment prerequisites; isolated synthetic identity tests do not verify them. No Production bypass is introduced. SwaggerHub target remains EXTERNAL_TOOL_PENDING; no guessed API project or upload.

## Backup / rollback / recovery

Before an approved upgrade, retrieve actual Stage applied migration names/checksums, verify source compatibility, establish a recoverable backup/PITR point and test restore to an isolated database. Record existing image digests/environment and the verified restore point.

Once Company monetary facts exist, an image-only rollback to code without destination semantics is unsafe. Stop economic writers on failure; use reviewed forward recovery or coordinated backup restore plus reconciliation. Never edit/delete sealed awards or B effects. Projections can be rebuilt from facts but are not an economic recovery substitute. Signed replay effects preserve original entries.

## Gate and UAT package

P0 local evidence passes Prisma validate, API/Admin/Member builds, fresh 0→69 migrations, API 776/776, Admin 96/96, Member 149/149, Analytics 58/58, Decision v3 17/17, OpenAPI, Security policy and RC isolated. Full formal HTTP `security:e2e` remains BLOCKED because required credentials infrastructure returns ECONNREFUSED. The user explicitly excluded scale tests. Therefore this candidate is not ready for Stage review.

TRAIN_B_C_UAT_CHECKLIST.md has 32 executable manual cases including Tree creation/#1–#7, placement/Sponsor rules, lifecycle, statistics/snapshot, Reservoir/Return/replay and role/error/session flows. Checklist READY; manual execution PENDING. CUA sandbox ACL failure prevented visual inspection here. This is preparation for Stage UAT review, not completed manual acceptance or Production readiness.

Derived generation physical retention policy and formal identity/publishing setup remain explicit follow-up items. Next Rank Pipeline is SOURCE_NOT_AVAILABLE. No Stage mutation occurred.
