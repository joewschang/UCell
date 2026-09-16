# UX-3 — Design System v1 Freeze + Full Product Rollout

Branch: `integration/member-backend-mvp`. Approved UX-2 visual source: `436cbf7168bca53454f4f46ff2c8ac697464026b`. UX-3 source checkpoint: `e90d740cf868abf0a2b59e4f4eb8b35e297958af` (pushed). Further page-by-page redesign is closed; `DESIGN-SYSTEM-v1-FREEZE.md` is now the visual contract.

## Delivered

- Member: Home, Organization, Performance, Bonus, Shop, Orders, Notifications and Me/Profile share the approved mobile shell, Qualification context, tokens, headers, cards and state components. Existing connected idempotency, server price/PV authority and Person/Qualification separation are unchanged.
- Admin: all protected routes retain route/RBAC behavior and now share PageHeader, semantic status/error states, tokens and responsive console rules. Every remaining route table uses the bounded DataGrid pattern with sorting, loaded-page search, pagination, columns and detail action. The UI explicitly says it is not a complete server dataset.
- High-risk Application approval, payment confirmation, reversal/replay, Workflow submit/review and payout actions receive a reason-required confirmation guard. Existing Backend authorization and payloads remain authoritative. Where the API has no reason field, the dialog discloses that typed text is not persisted as formal Audit evidence; the additive reason/evidence contract remains a Security/API gap.
- Payout Materialize no longer defaults to the browser's current UTC timestamp. Missing Production operational cut-off remains configuration pending and the action is disabled until an authorized value is supplied. No calendar/cut-off was inferred.
- Missing NASL, GMV, Organization Health, Security and complete Settlement read models remain unavailable under `../ux2/READ-MODEL-API-PLAN.md`. No fake metric was introduced.

## Verification

- Builds: Backend/Worker, Admin and Member PASS. Prisma validate/generate/migrate deploy against primary and isolated databases PASS; no new DB migration.
- Tests: Backend API 130 PASS / 52 TODO; Member 116 PASS; Admin 22 PASS; shared PASS. DB Golden isolated twice PASS. Member/Admin integration adds 59 actual HTTP/DB assertions; Member identity DB is 278 assertions; membership DB 98; replay DB 129; RPV concurrency DB 20; return/outbox DB 20.
- Full Connected DEV matrix: 40 PASS / 7 BLOCKED / 0 FAIL. Formal Security HTTP, UAT, TODO, aggregate Backend gate, RC, release-prep and release-gate remain BLOCKED by design.
- Responsive: 104 route/viewport assertions PASS over all 26 Member/Admin routes. Member 375/390/430/768; Admin 768/1366/1440/1920. Twenty-six reference screenshots are in `references/`; Member is explicit mock visual only, Admin uses isolated Connected DEV reads.
- Accessibility: all 26 routes PASS named-control, main-landmark, page-heading and textual-status checks. Existing modal forward/reverse Tab, Escape/focus restoration, roving tabs and touch checks remain PASS. Missing labels found on Applications, Orders and other placeholder searches were fixed. Complete screen-reader/manual WCAG audit and actual LIFF device verification remain pending.

Commands include toolchain/status/diff, Backend/Worker/Admin/Member builds, Prisma validate/generate/migrate, API/shared/Admin/Member tests, isolated DB Golden twice, replay/static/security/OpenAPI preflights, Connected DEV HTTP/browser gates, RC/release gates, TODO inventory, `route-responsive-review.mjs` and `accessibility-review.mjs`. Raw command evidence is under `../../phase3-connected-dev/final/`.

API changes in UX-3: **NONE**. DB migrations: **NONE**. Business logic changes: **NONE**. Monetary semantics changes: **NONE**. Core facts, historical evidence, authorization, ownership and calculation were not changed.

During final publication, the remote integration branch added approved Core Logic Addendum v2 (`d1d3b40`) and the current SSOT pointer (`c811654`). Eligible-consumption defaults and the prospective PV/BV recognition model are therefore no longer unqualified Pending Decisions. UX-3 introduced no implementation of those rules. Remaining fail-closed SSOT/configuration blockers are exact Production cut-off clock values, deterministic migration mapping for pre-existing GPV facts, and unspecified Matching depth skip/stop/compression edges.

Operational credentials for LINE/LIFF and Entra/RBAC, Security E2E, UAT, Backup/Restore and release sign-off remain blockers. Production Promotion is **BLOCKED**. No merge main, force push or RC promotion.
