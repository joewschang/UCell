# Windows integration review — 2026-11-16

## Verified Git handoff

- Remote source: `prep/dot-uploader-token-age-261116`.
- Commit: `e0b049b9dcf466c892dab49b478c92e31bcfeeaf`.
- Tree: `c4bad78f8eadefa5ba966f76cf583bb835b9a356`.
- Parent: `950c55fe47a2a28369c83eac7672505e0cd283c1`.
- All three identifiers were verified locally after fetch. The source adds 17 files/changes, 1011 insertions and 6 deletions relative to the parent. The cloud review is retained separately; its Linux results are not presented as Windows results.
- Isolated local branch `integration/dot-uploader-261116`, worktree `D:/UCell/dot-uploader-integration-261116`. Original PR branch remains untouched. No remote update, merge or deployment is performed.

## Platform finding and bounded fix

Windows Node v24.21.0 successfully executes a real in-memory `node:sqlite` query. It has no `process.getuid`, and POSIX mode bits do not validate Windows ACLs. The reviewed journal explicitly requires Linux directory ownership/permissions and directory fsync. Initial Windows runs failed all 11 journal cases with generic `JOURNAL_INIT_FAILED`.

The local change now checks the documented Linux platform before journal initialization writes anything, and before journal operations open a database. It returns `JOURNAL_PLATFORM_UNSUPPORTED` on other platforms. Existing permission, integrity, locking, fsync, retry and authentication checks remain intact. No ACL override, fake UID, mock SQLite, platform-test skip or automatic fallback was added. This is explicit fail-closed behavior, not Windows journal support. A new test verifies no files are created on unsupported platforms; on Linux that same test exercises real journal initialization.

## Local validation

- Original requested standalone command rerun after the fix: **33 total, 22 passed, 11 failed, zero skipped**. All 11 failures are the unsupported Linux journal path on Windows. This gate remains NOT PASS on Windows.
- Uploader + HTTPS adapter + new platform test: **23/23 passed** (14 + 8 + 1).
- Five focused API suites: **39/39 passed**, including strict token age, route-specific roles, HTTP authorization, native rendering and complete-artwork behavior. Existing Noto CJK fixture font was supplied explicitly.
- `pnpm preflight`: all **21 offline checks passed**, including release-readiness/static/security/migration checks; Prisma validate/generate and all six backend workspace builds passed. Only a synthetic localhost database URL was supplied; no migrate/deploy command was executed.
- `node --check` for uploader, HTTPS adapter and journal; `git diff --check`: passed.
- API lint: repository script fails first on literal single-quoted glob under Windows; direct equivalent invocation reaches ESLint 10.10.0 but fails because `eslint.config.*` is missing. No lint success is claimed and no configuration was weakened.
- Full API suite, new isolated PostgreSQL regression, aggregate database-dependent test command, live HTTPS/proxy/Entra auth and Linux journal rerun for this local diagnostic change were not performed. Prior CI for parent `950c55f` does not validate this new tree. No remote CI was triggered.

Commands use repository pnpm 12.4.1; frozen dependencies were installed entirely from existing offline cache. Log files are local under `D:/UCell/tmp/dot-integration-*.log` and contain synthetic fixtures only.

## Remaining activation blockers

1. Verify a supported private saved-environment/vault binding and how the actual executor and recurring schedule use it. Only a Default environment is currently listed. A new-task environmentConfigId does not establish rebinding of this task or inheritance by a Dot automation.
2. Separately authorize and configure a dedicated Entra audience/publisher with sole Greeting.Publish role; never reuse existing admin/workload credentials. Actual token-provider implementation and real signed tenant/client/object/audience claims remain unverified.
3. Prove Network-secret placeholder substitution after form encoding (or approved OIDC custom-audience support), proxy/TLS/redirect/cancellation behavior, and memory-only short-lived token handling in the intended runtime. Synthetic encoding/HTTP tests do not establish these properties.
4. Establish one persistent Linux-local journal volume with guaranteed attachment, ownership, retention and recovery across scheduled runs, or implement a separately reviewed durable server-intake design. Local SQLite is not distributed storage; do not silently recreate lost state. SERVER-RECOVERY-DESIGN.md is a proposal, not an implemented endpoint/migration.
5. Complete staged generation-to-publication, lost-response/idempotency/date rollover, public/admin image and QR checks, backup/restore gates and actual PC-off UAT. Keep production disabled until these gates pass.

## Safe PR #75 continuation

PR #75 remains at parent 950c55f. When remote update is explicitly authorized, re-fetch its current head. If still 950c55f, the independent integration branch is a normal fast-forward descendant; review the source squash and local platform-diagnostic commit before a normal push. If others changed the branch, merge/reconcile in isolation and rerun relevant checks. Never force-push or overwrite concurrent work. Run exact-head Linux CI, including all journal cases, before considering merge. No permission to push/merge/deploy is inferred from this report.

Production pre-test metadata: API `ucell-prod-api--paper-contact-signature-261116`, digest `sha256:d53aaf9b37480b54a777e1451cd7581db672c810cd6a9b641fc570ec9adbf88a`; admin `ucell-prod-admin--assisted-checkout-261116`, digest `sha256:6387b94535570834a6f101d0d79db9a83ce50f1dc4c70f0b0858804189ca5f50`. Cloud/push/machine API enable flags were absent. Preserve these and any later overlays; never apply old environment settings. Today's publication, SwaggerHub, credentials and network configuration are outside this integration's mutations.
