# UX-1 checkpoint report — 2026-09-16

Branch: integration/member-backend-mvp. Pre-change checkpoint bce9296 pushed before UI edits. Source checkpoint: 5a05c3c9b722555955175451cbfa7db832681677 (pushed). Final screenshot metadata references this committed source.

## Delivered pattern

Shared semantic CSS layers and private React peer design package; Bootstrap 5.3.3 Grid CSS only, no Bootstrap JS/default component appearance. Shared state/money/qualification/metric/dialog components and distinct Member/Admin shell adapters. Member Dashboard/Organization/Bonus use shared metrics/context/status/lifecycle presentation. Admin Dashboard/Person/Bonus-Settlement use the shared theme, role-filtered grouped sidebar, bounded Person grid and read-only detail drawers. Person creation remains available in a collapsible labeled form.

Member and Admin retain all existing routes, guards, commands, idempotency, server-authoritative money and connected APIs. Confirmed qualification switching feedback added; no private content during pending/denied selection. Dashboard static green release claims removed. Unsupported dashboard/tree/Person/pipeline data is unavailable, never invented.

## Verification

- Member Build PASS; 111 tests = existing 106 + 5 design-system tests.
- Admin Build PASS; 14 tests = existing 11 + 3 bounded grid tests; existing large chunk warning retained.
- Backend/Worker Build PASS; API 106 tests PASS, 73 TODO remain; shared tests PASS.
- Prisma validate/generate/deploy PASS in primary and isolated regression DB. No new migration/schema change.
- Isolated DB Golden x2 PASS: 201 Member HTTP/DB assertions, ball isolation, BOLA/IDOR, mutations/retry/concurrency/rollback, synthetic LINE authentication boundary. Formal LINE not verified.
- Replay DB regression PASS: 129 real DB assertions, rolled back fixtures.
- Admin full connected HTTP PASS: 49 operations. Member local auth fail-closed preflight PASS. Actual Admin UI read smoke PASS; Member browser smoke PASS with explicit mock visual fixture.
- OpenAPI export/preflight, source/schema/migration, domain golden, economic golden, security policy and static preflights PASS.
- Six visual states x four widths = 24 references. Member 375/390/430/768; Admin 1366/1440/1920/768. No document overflow, modal Tab/Shift+Tab/Escape, confirmed ball feedback, >=44px mobile navigation checks. Basic contrast tests PASS; full WCAG/screen-reader audit pending.
- RC, release prep/release gate, TODO gate and aggregate backend test gate BLOCKED by 73 TODO. Formal Security HTTP and UAT BLOCKED by operational credentials/configuration. No active FAIL after service restoration and rerun.

## Commands

Full executed gate commands/logs: ../phase3-connected-dev/final/gate-results.json and PASS-FAIL-MATRIX.md. Additional commands: git status; git commit --allow-empty checkpoint; git push origin integration/member-backend-mvp; pnpm add bootstrap@5.3.3 @ucell/design-system@file:../shared/design-system (both apps); Admin test renderer dev dependency install; pnpm install/build/test; isolated Vite --force; node governance/ux/visual-review.mjs; git diff --check. API/Worker stopped for Prisma and restored before HTTP reruns. Engineering failures and fixes are preserved in ENGINEERING-FINDINGS.md.

## Remaining scope and blockers

UX-1 is a validated initial pattern; full Design System rollout is not complete. Pending: authoritative Member full Tree/Carry APIs, exact Person-owned Qualification/LINE/KYC reads, full Qualification tabs, pipeline snapshot/hash/status metadata, DataGrid server pagination/saved views/export/authorized bulk, full command-safety audit, pixel-diff regression policy, full screen-reader/LIFF checks. Existing Commerce/Notifications/Profile/repurchase/logout Connected MVP remains intact.

Backend priority continues: RPV concurrency coverage, complete K1/K2 period replay, carry convergence/maxWeeks/resume, subscription versioned schedule, TODO burn-down. TODO baseline 148 → 74 → 73; this UX batch 73 → 73. No TODO deleted, skipped or replaced with fake assertions.

Pending SA Decisions unchanged: eligible-consumption scope, PV/BV formal event mapping, production operational calendar/cut-off. Asia/Taipei and historical fail-closed remain approved.

CODE COMPLETE: UX-1 implemented adapters/presentation only; full requested rollout remains staged.
CONNECTED DEV PASS: existing real isolated backend/Member/Admin gates above.
OPERATIONAL CREDENTIAL PENDING: formal LINE/LIFF, Entra/RBAC.
UAT PENDING; PRODUCTION BLOCKED: TODO/security/UAT/backup-restore/payout/release requirements remain.

API changes: NONE. DB migration: NONE. Business logic changes: NONE. No merge main, force push, RC2 or Production promotion.

Screenshots: references/member-{dashboard,organization,bonus}-{375,390,430,768}.png and references/admin-{dashboard,person-qualification,bonus-settlement}-{1366,1440,1920,768}.png. Fixture/source commit metadata in references/results.json.

Final Connected DEV matrix: 40 PASS / 7 BLOCKED / 0 FAIL. Browser verifies forward/reverse modal Tab containment, Escape focus restoration, confirmed Qualification feedback and mobile touch targets.

UX-1 source checkpoint: 5a05c3c9b722555955175451cbfa7db832681677; pushed origin/integration/member-backend-mvp. Final screenshot metadata is captured against this committed source. Follow-up evidence update changes documentation/reference metadata only.

## UX-2 refinement

UX-2 delivery is separate in ux2/REPORT.md and ux2/PASS-FAIL-MATRIX.md. UX-1 references are preserved. Six refined screens only; awaiting second SA Visual Review.

## UX-3 freeze and rollout

UX-3 final report: ux3/REPORT.md. Design System v1 is frozen and rolled out across the complete current Member/Admin route inventory.
