# UCell AI production release — 2026-10-22

This release integrates the AI branch and its previously production-deployed website, member, sharing and coupon commits into main. The production API is an additive AI overlay on the exact existing production digest, preserving payment, worker-recovery and recognition patches. Admin/member bundles are built from the integrated source with verified production API and identity settings. Website and worker deployments remain at their existing versions.

## Access and environment

`AI_ENABLED=true`, `UCELL_ENVIRONMENT=PRODUCTION`, `NODE_ENV=production` and `AI_ACCESS_MODE=PRODUCTION_ROLES` enable the release. Normal authenticated members with a registered membership state may query only their own scope. Current SUPER_ADMIN sessions with matching, active database grants get executive read/export and knowledge/audit capabilities. Other admin roles require explicit AI capability grants; the initial UI entries are restricted to SUPER_ADMIN. Role/session/account validity is checked again around execution and downloads. Stage UAT identities and admin demo bypass do not authorize production access. No human session is fabricated and no existing human role is elevated.

Dedicated model: `ucell-prod-ai-20261022`, East US 2, `gpt-4.1-mini` version `2025-04-14`, Standard capacity 10, deployment `ucell-prod-planner`. Key is a Container App secret reference. The initial monthly application reservation cap remains 500,000 tokens (8,192 per attempt, at most 61 attempts/month), with existing per-actor minute/day limits. It is not an Azure monetary billing cap.

## Data and knowledge

Only the checksum-verified additive migration `20261022010000_ai_stage_assistant` is applied; unrelated migrations are not run. Operational/financial data and identity roles are not changed. Nine rule explanations are prepared as IN_REVIEW by a clearly identified release automation principal, with no human session or fabricated approval. An authorized different approver must publish them before FAQ answers become available. Production has the coupon source tables and supports coupon receipt queries. Historical headcounts, comparisons and net refund revenue remain unsupported.

## Validation

- Backend build; production admin/member builds and endpoint assertions.
- 249 admin tests; 316 member tests; 25 website tests.
- 66 real-PostgreSQL service/security assertions; 8 rolled-back financial assertions.
- 18 production-access policy assertions in isolated local PostgreSQL.
- 15 HTTP assertions against the exact production API image with an isolated local database.
- Production read-only data and model preflight: member/qualification counts, payment summary and coupon summary returned AVAILABLE. Production Entra callback registration verified. Existing database PITR retention is 35 days.

Artifacts, image hashes and further rollout verification are recorded under `C:/UCell/ai-production-20261022` and the release manifest. Human Microsoft/LINE/Google sign-in is not impersonated by release tests.

## Completed rollout

Source commit `f636f6ed` was fast-forward integrated into remote `main`, including the 26 existing branch commits. All three production components are on `ai-production-20261022-v1`, Healthy with 100% traffic. API health is 200; unauthenticated admin/member AI requests are 401. Production frontend desktop/mobile checks passed against the exact API image with isolated local identities/data; all production API-origin browser requests in that test were intercepted to the local runtime. Separate direct production read-only SQL/model checks passed. Live production Microsoft login initiation uses one tab, the registered production callback, PKCE/state/nonce. Actual human credential/MFA completion remains user verification.

The existing Joe Chang Entra SUPER_ADMIN grant was valid, but its person record was DRAFT, which the AI security policy rejects. The explicitly requested administrator's existing person status was corrected to EFFECTIVE in a guarded transaction and recorded as `EXISTING_ADMIN_ACTIVATED` in AI audit. Membership state remains null, no membership/qualification was created, and no role was changed. The existing UCell Service identity was already EFFECTIVE. `ai-production-activate-existing-admin.cjs` records the scoped correction.

The nine FAQ drafts remain IN_REVIEW. Production model capacity and the initial reservation ceiling are recorded in `releases/ai-production-20261022.json`. Website and worker image digests were confirmed unchanged.

## Deployment and rollback

Use `prepare-ai-production.cjs` after production builds. Build/push the three component contexts; `deploy-ai-production.ps1` guards each current image against the recorded baseline and deploys a digest. Apply `ai-production-migrate.cjs` through the secret-safe runner before the API rollout. Deploy API first, verify healthy readiness, then admin and member. Inspect the three ready revisions, public endpoints and authentication denials after deployment.

Emergency stop: set `AI_ENABLED=false` on `ucell-prod-api` and verify the resulting revision is ready. Image rollback uses the baseline digests in `prepare-ai-production.cjs` / release manifest. Retain the additive AI schema and audit records. Do not roll back or rewrite payment, coupon or worker data. Remove the temporary `ai-release-20261022` PostgreSQL firewall rule after verification.
