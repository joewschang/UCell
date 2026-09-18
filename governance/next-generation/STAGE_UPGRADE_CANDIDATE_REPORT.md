# Stage upgrade candidate — NOT_READY_FOR_STAGE_REVIEW

Stage deployment STOP. Production BLOCKED. No Stage update, migration job or database mutation has been performed.

## Observed deployment
Read-only Azure query: resource group rg-ucell-stage.
API latest-ready revision: ucell-stage-api--r-225957920260917154017.
API image: ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-backend@sha256:afd3082e10f047206e6c01698d7d51b632490b11e1cfb7c83a2efc8b18170a7b.
ACR digest metadata tag: 2259579-20260917154017.
Tag resolves in this repository to 22595798d30dee1af80aeb832c0d36cede8f5175.
This identifies the tagged source revision; no signed build attestation or clean-build provenance was retrieved.
Worker/Admin/Member revisions share suffix r-225957920260917154017; their images remain unchanged.

## Candidate and deltas
START_HEAD: 26fa675da0132646484b4a8806a8d5ab55e0e6f6.
Candidate HEAD: NOT_ASSIGNED — implementation remains uncommitted; current recovery checkpoint is c0c25fe.
Source migration counts: Stage-tagged commit 42; START_HEAD 54; working candidate 65.
Thus source deltas are +23 versus the Stage tag and +11 versus START_HEAD.
Stage database applied migration inventory: NOT_QUERIED. Do not equate repository files with database deployment.
OpenAPI operation counts: Stage-tagged source 134; START_HEAD 167; generated working artifact 174.
Structural diff against START_HEAD passes; a separate Stage-source compatibility review remains required.

## Environment and secrets
Existing Stage script sets NODE_ENV=staging, UCELL_ENVIRONMENT=STAGE, ADMIN_AUTH_BYPASS=false.
Prepare SWAGGER_ENABLED=true for approved Stage UAT; DEV example enables it, Production defaults disabled.
Period projection/export runner needs the existing database connection and an approved execution schedule; no new monetary provider credentials are introduced.
UCELL_PERIOD_WORKER_MAX_JOBS controls bounded operator runs, 1–100. Current runner exits when queue is empty.
Formal LINE/LIFF and Entra operational credentials remain external blockers; no production bypass.
Key Vault/secrets delta for this foundation: no new secret type identified. Existing deployment identity, database and formal identity bindings still require environment validation.
SwaggerHub target is EXTERNAL_TOOL_PENDING; do not create a guessed API project.

## Database backup and recovery prerequisites
Before any approved Stage migration: retrieve actual applied migration names/checksums, confirm source compatibility, take a verified recoverable database backup/PITR point, and test restore to an isolated database.
New source changes include versioned Company binding, immutable monetary destinations/B ledger, fixed snapshots, aggregate generations/jobs and replay K metrics.
Migration 54 already installs btree_gist/owner exclusion; unpublished migration 62 verifies that existing exclusion rather than adding a duplicate index.
Retain old deployment image digests and configuration evidence. An image-only rollback after Company monetary facts exist is not assumed safe: old code lacks the destination semantics.
On failure, stop economic writers and use reviewed forward recovery or a coordinated backup restore with reconciliation; never delete/edit authoritative awards or B effects.
Projection generations may be rebuilt from facts; they are not economic recovery substitutes.

## Review gate
Not ready: populated monetary scale workload/HTTP/DB memory, complete security and RC gates, remaining economic invariance coverage, UI review and final candidate commit.
See TRAIN_B_C_UAT_CHECKLIST.md (32 authored cases), TRAIN_B_CODE_REVIEW.md and TREE_SCALE_REPORT.md.
Only all required local/isolated gates passing may change this report to READY_FOR_STAGE_REVIEW. Deployment still needs explicit confirmation.

## Updated candidate checkpoint

Current source migration count: 67 (+13 from START_HEAD, +25 from Stage-tagged source). Migration 66 adds the PV reversal lookup index; 67 protects derived job identity. Recheck actual Stage applied migrations and backup/PITR before any approved change.

Stage deployment script now prepares SWAGGER_ENABLED=true; it was not executed. Dedicated analytics --watch command is available; UCELL_PERIOD_WORKER_POLL_MS defaults to 5000 and accepts 1000–60000. It uses existing database credentials; a separate worker process/environment must be reviewed.

START_HEAD OpenAPI structural comparison passes. Old Stage source comparison flags a pre-existing SDK operationId rename (MemberController_binary → memberBinaryOrganization), documented in OPENAPI_CONTRACT_REPORT.md. No URL/method change is introduced here.

RC isolated 3 and full App security pass at their recorded checkpoints; final 67-migration RC and full populated 12-cell scale matrix remain pending. Candidate status stays NOT_READY_FOR_STAGE_REVIEW until the remaining gates and commit are complete.
