# Stage recovery, LINE integration and first UAT gate

Authority: user master instruction dated 2026-10-01, “Interrupted Work Recovery + LINE Integration + UAT Readiness”. This supersedes the old expansive batch backlog for this release. ERP selection/integration and real bank payout are excluded; existing code/history remain preserved.

## A–C. Recovery and reconciliation

Starting HEAD: `55d0eb2d6c9c2730f24b01fd27c6454714bd3179`, branch `integration/member-backend-mvp`, origin `https://github.com/joewschang/UCell.git`. Initial status, diff, staged diff and untracked inventory were empty. The historical 22-file/behind-one state does not describe this checkout.

`git fetch` uncovered a corrupt local remote-tracking ref containing zero bytes. Preserved verbatim at `C:\UCell\logs\stage-recovery-corrupt-remote-ref-20261001.bin`. GitHub `ls-remote` independently confirmed the exact HEAD above. Restored only that tracking ref, fetched successfully, and compared both directions: no local-only or remote-only commits. No pull, merge, rebase, clean, reset, discarded changes or overwritten source files.

Recovery classifications: **A completed** learning/event/message/growth and sealed-rank commits through `55d0eb2`; **B partial / E repair needed** previously reproduced unplaced-qualification DTO/frontend failure; **C existing** core MVP, LINE authentication/linking, messaging inbox and deployment tools; **D prior task** committed economic-lineage, returns and period processing; **F overlap** none (remote exact match). There was no uncommitted work to recover. All prior commits retained.

## D–F. Actual repository audit and bounded backlog

“DONE” below means implemented with automated repository evidence, not a claim of real credential-backed Stage UAT. Those items are removed from the coding backlog.

| Area | Status | Evidence / remaining boundary |
|---|---|---|
| Backend/API/database | DONE baseline | Nest API, worker, Prisma; 124 existing migrations; isolated baseline and per-suite DB runner. No new schema in this release. |
| Member/Admin | DONE baseline, PARTIAL repaired here | Existing product/order/account/organization/bonus surfaces; unplaced qualification parser and labels repaired; real browser rerun. |
| Authentication/members | DONE code, BLOCKED live LINE configuration | Verified LINE ID-token exchange, IdentityLink, sessions, effective/security-state guards; company-approved linking and one-use rebind with revocation. |
| Products/orders | DONE baseline | Catalog/package checkout, order economic evidence, idempotent writes and existing Admin operations. |
| PV/BV and sponsor/placement | DONE baseline | Authoritative volume/economic ledgers and sponsor/tree services with ownership isolation; no client-side economic calculation. |
| Qualification/rank | DONE after repair | Effective ownership and interval evidence; sealed Global next-rank progress; unplaced qualifications retain public qualification number without inventing Ball number. |
| Bonus/wallet | DONE scoped baseline | Calculation, recorded status/read models and reversal/recovery; real transfer deliberately excluded. |
| Return/refund/reversal/audit | DONE baseline, regression rechecked | `a-decision-return`, `return-substitution-closure-db`, `test.repurchase-partial-return-db`, `gpv-immediate-effects-db`, `epv-lineage-closure-db`, order evidence and recovery tests exercise volume, qualification, award and wallet/recovery effects. Append-only historical audit preserved. |
| OpenAPI | DONE update | Canonical webhook and public qualification number exported; legacy route retained. |
| CI/CD/Azure | DONE foundation; incremental release pending verification | Existing workflow and G8 incremental script retained/extended for frontends; no new pipeline, DNS or TLS. Before-state evidence saved separately. |
| Tests | PARTIAL tooling | Builds, unit/DB/HTTP/browser checks run below; pre-existing lint script has Windows glob quoting issue and repository lacks ESLint configuration. This is reported, not represented as lint PASS. |
| Governance/release | UPDATED | Current domains, narrowed scope, manual LINE gate and evidence recorded here. |
| LINE webhook | DONE code, BLOCKED real secret | Exact raw HMAC, durable metadata receipt, follow/unfollow/text, malformed rejection, retry deduplication; official verify with empty events supported. |
| Rich Menu | TODO optional | Does not block webhook/login gate. |

Reverse chain evidence is automated with synthetic/disposable data: cancellation/return → authoritative PV effects → qualification/Active effects → replay/award reversal → recovery/payable-wallet projection → audit. Real phone-to-return UAT remains after the manual gate; no claim that a real bank transfer or ERP integration was tested.

## G–H. Changes

Exact implementation file list: [change manifest](evidence/stage-line-change-manifest-20261001.json), committed as `cda80e1`. Subsequent deployment-only adjustments add reuse of already-built images and a local Docker/BuildKit-secret fallback within the same script.

Auth transport/controller/ingress/adapter/status and worker metadata observer; canonical `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` with legacy aliases. Shared bootstrap prefix exception exposes **POST /api/line/webhook**, retains **POST /api/v1/integrations/line/messaging/webhook**, uses raw request bytes and constant-time comparison before persistence. Empty verification and duplicates are successful no-ops. Metadata contains event identity/type/time, hashed source subject and payload hash; no text, raw payload, token or secret is persisted. Worker acknowledgement does not create/bind members or monetary effects. Supported text messages are received/observed, not automatically replied to.

Member qualification DTO/parser and public labels support `UNPLACED` only with a positive public qualification number; tree lookup skips a nonexistent Ball number and explains the pending placement. Ball-number validation remains strict elsewhere. Browser test covers the unplaced-to-placed transition.

Deployment domains/runbook updated and existing incremental script extended; existing Stage synthetic entry retained. No Production access/modification, real member edits, new ERP code or banking integration.

## I. Validation

- Initial baseline: full API 181 suites / 1,317 tests, 124 migrations, 162 DB assertions (previous committed checkpoint).
- This release focused LINE/security/linking: **8 suites / 27 tests PASS**, including actual Fastify HTTP and PostgreSQL persistence; isolated cleanup PASS.
- Backend build, Member **182 tests/build**, Admin **188 tests/build**, OpenAPI preflight, security policy preflight and deployment preflight **25 assertions PASS**.
- Full API regression: **182 suites / 1,324 tests PASS**, 124 migrations, 162 baseline DB assertions and isolated cleanup PASS (`C:\UCell\logs\stage-line-full-api.log`).
- Final real Edge browser verification PASS, including unplaced Growth → binary-organization pending-placement explanation → actual placement → sealed Global progress, plus existing engagement journeys; disposable DB/temp cleanup PASS. Public qualification numbers are lossless decimal strings, matching the BigInt database field.
- Lint: attempted existing `pnpm lint`; quoted glob is passed literally on Windows. Direct ESLint invocation is also checked and its actual diagnostic retained in `C:\UCell\logs\stage-line-lint-direct.log`. No lint standards were disabled or replaced to manufacture a pass.

## J–K. Stage deployment/status

Existing before revisions and image digests: `evidence/stage-line-before-20261001.json`. Azure PostgreSQL is Ready with seven-day backup retention. Existing incremental migration/app update is used; no seed/reset or foundation recreation. Completion evidence to be appended after deployment.

Direct read-only migration inventory from the local host could not initialize a Prisma connection to the Stage database. No firewall changes were made. Source comparison against the deployed `0eeb814` backend identifies 37 added migration files and zero modified/deleted existing migrations. Cloud migration-job completion remains the deployment gate. Existing historical ERP-named migrations are retained for repository/schema consistency; this release authors no ERP schema or integration.

First cloud migration execution `ucell-stage-migrate-ex1b7oh` failed at `20260928100000_binary_tree_bootstrap_profile` with `TREE_IMMUTABLE_IDENTITY_OR_VERSION`; all four app revisions stayed unchanged and all three URLs remained HTTP 200. The original backfill incorrectly writes the immutable legacy profile version and does not satisfy lifecycle version rules on populated trees. Added a Stage-only recovery runner without modifying existing migration files. It checks migration checksums (including equivalent LF/CRLF), applies the original DDL with a preservation-safe backfill in one exclusive-lock transaction, retains every original tree column and topology version, restores/enforces the lifecycle trigger, flushes deferred evidence checks, verifies postconditions, records recovery audit and only then reconciles the failed migration ledger and resumes deploy. Unknown partial schemas or unrelated failed migrations stop without overwriting data.

Local upgrade regression **PASS**: reproduced the failure on synthetic ACTIVE and ARCHIVED legacy rows at migration 87, verified rollback, recovered through all 124 migrations, preserved every original tree field and Person, verified update/delete guards reject mutations, and cleaned the disposable database. Evidence: `C:\UCell\logs\stage-profile-upgrade-test.log`. The test's minimal legacy fixture bypasses only bootstrap-completeness during fixture creation; lifecycle/evidence guards are active for failure reproduction and recovery. This is an upgrade regression, not a new business-tree acceptance claim.

Second execution `ucell-stage-migrate-ge5ooku` stopped before writes on checksum verification. Read-only execution `ucell-stage-migrate-t3l3hjh` recovered the actual migration ledger. Nine historical mixed-LF/CRLF files were found byte-for-byte in preserved `C:/UCell/UCell` and `C:/UCell/next-generation` workspaces; every historical SHA matches Stage and every normalized SQL byte matches the current repository. `backend/scripts/stage-migration-eol-evidence.json` pins both legacy and normalized hashes; the validator accepts only these proven formatting variants and leaves database checksum records unchanged. All actual Stage ledger checks now verify. Nine positive/negative checksum tests PASS, including rejection of added SQL and wrong migration identity. Ledger evidence is `evidence/stage-line-migration-ledger-20261001.json`.

Stage URLs: https://stage.ucell.life · https://admin-stage.ucell.life · https://api-stage.ucell.life/api/v1/health.

## L–N. Manual gate and readiness

Execute [the ten-step LINE manual checklist](../../deployment/LINE_STAGE_MANUAL_GATE.md) after healthy deployment: reissue secret → Azure secret ref → issue access token → Azure ref → new revisions → webhook URL → Verify → enable → adjust auto replies → phone test. Then supply Login Channel ID and LIFF ID if not already configured, using the same Provider. IDs are configuration, not interchangeable with Messaging Channel ID. Never paste the secrets into chat.

**Credential-backed first UAT is BLOCKED at the human LINE gate.** Coding/test completion and HTTP health alone are not real LINE UAT success. Existing Stage Admin demo and fixed synthetic Member entry remain as previously configured; they are not proof of production identity readiness. Actual login/binding, normal business journey and return/reversal must be exercised after operator confirmation.

## NEXT ACTIONS ONLY

1. Complete current regression and Stage incremental release evidence.
2. Operator performs Messaging secret/token configuration, webhook Verify/enable and phone test.
3. Supply/configure Login Channel ID and LIFF ID, then verify real login and controlled member binding.
4. After human confirmation, execute scoped first-round UAT. Resolve findings only; exclude ERP and real bank payment.
5. Repair missing repository lint configuration in a separately explicit tooling change; keep this validation limitation visible.
6. Rich Menu after core LINE acceptance, optional.
