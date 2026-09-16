# UX-2 Refinement — second Visual Review

Branch: `integration/member-backend-mvp`. Pre-change checkpoint: `ae60e98` (pushed). Source/reference SHA is recorded in `references/results.json`; final delivery SHA is the documentation commit containing this report.

Scope is limited to six reference screens. Further rollout is paused for SA Visual Review. Bootstrap remains a grid foundation; shared UCell components, connected contracts and authorization are retained.

## Member

- Dashboard: compact service header; separate explicit DEV-only banner; Qualification context, member identity, Active/repurchase, PV/RPV/EPV and nullable Bonus in that order. Recognition details are expandable.
- Organization: separate Sponsor/Binary tabs, Sponsor and direct-referral summaries, Left/Right summaries. Counts describe actual API-returned scope; missing carry/tree capabilities remain unavailable.
- Bonus: connected lifecycle timeline with Chinese labels. Only the current Backend status is marked; preceding stages and timestamps are not inferred. Domain enums remain in expandable detail. Pending/null money displays 結算中.

## Admin

- Collapsible domain groups preserve existing routes and role gates.
- Dashboard keeps authoritative existing metrics and displays unavailable for missing NASL, commerce, organization-health and security read models; see `READ-MODEL-API-PLAN.md`.
- Person drawer loads exact owned Qualifications through a new paginated read endpoint. Qualification detail has ten keyboard-accessible tabs, lazy authorized reads, and fail-closed evidence checks. Person and Qualification fields remain distinct.
- Settlement pipeline opens a read-only detail drawer. Ambiguous historical batches require explicit batch selection. Missing parameter hash/output/execution evidence is unavailable; theory and calculation hashes are not substituted.
- DataGrid shares toolbar, sort, columns, bounded pagination and row detail. Large-dataset server-pagination rollout remains future work; current grids disclose their loaded scope.

## Verification and limits

Executed commands: `node --version`, `pnpm --version`, `git status`, `git diff --check`; `node governance/phase3-connected-dev/run-gates.mjs` plus focused `--only` reruns; `pnpm build` in Backend/Admin/Member (Backend includes Worker); `pnpm --filter @ucell/database exec prisma validate`, `generate`, `migrate deploy`; `pnpm db:golden` twice; API `test:e2e --runInBand`, Admin/Member `pnpm test`; replay/HTTP/security/static preflights, OpenAPI export/preflight and RC/release commands listed individually in the final gate logs; `node governance/phase3-connected-dev/todo-inventory.mjs`; `node governance/ux/ux2-visual-review.mjs`; Vite restart with `--force`.

- Member tests: 112 PASS; Admin tests: 18 PASS. Existing tests retained; new coverage includes Chinese lifecycle, ten Qualification tabs/role-gated Audit, and inconsistent Qualification evidence denial.
- Backend/Worker, Member/Admin Build, Prisma validate/generate/migrate, isolated DB Golden twice, Replay, HTTP/DB, OpenAPI and security policy were rerun. Latest complete results: `../../phase3-connected-dev/final/PASS-FAIL-MATRIX.md`.
- Isolated Member/Admin HTTP/DB: 219 assertions; membership DB: 98 assertions; replay: 129 assertions; Admin operation flow: 49 HTTP operations. These are Connected DEV results, not formal credential certification.
- 24 responsive screenshots: Member 375/390/430/768 × Dashboard/Organization/Bonus; Admin 1366/1440/1920/768 × Dashboard/Person-Qualification/Bonus-Settlement. Browser checks enforce no document overflow, ten owned-Qualification tabs, navy surface loading, Chinese timeline, modal forward/reverse Tab containment, Escape/focus restoration, switch feedback and mobile navigation touch targets.
- Manual review caught stale file-dependency Vite cache. Both DEV servers were restarted with `--force`; screenshots were rerun after adding explicit style/timeline assertions. File-dependency updates require server restart; tests/build use the installed current package.
- Member screenshots are **explicit mock visual fixtures only**. Connected Member contracts and HTTP/DB tests are separate gates. Admin references use real isolated DEV reads. Neither verifies actual LIFF browser/LINE credentials or formal Entra/RBAC.
- Accessibility is a focused keyboard/semantics/contrast review, not a complete WCAG audit. Full screen-reader and actual LIFF device testing remain pending.

API addition: `GET /api/v1/admin/persons/:personId/qualifications?take=20&skip=0`. Existing Person role policy, exact ownership filter, RepeatableRead count/rows, UUID/page validation, OpenAPI and HTTP/DB assertions. DB migrations: **NONE**. Monetary API semantics: **NONE changed**. Business logic changes: **NONE**.

Backend parallel checkpoints `04007e1` and `be7247f` are preserved. Final TODO inventory is regenerated from source; these test-only changes and the owned-Qualification case reduce 73 → 52, without deleting/skipping placeholders or changing business rules. The historical unrelated claim of 52 remains invalid; this new count has a fresh case-by-case inventory and real test evidence.

CODE COMPLETE: this six-screen UX-2 refinement. CONNECTED DEV PASS: scoped verified engineering gates. OPERATIONAL CREDENTIAL PENDING: formal LINE/Entra. UAT PENDING. PRODUCTION BLOCKED: unresolved TODOs, credentials, security/UAT/restore/release evidence.

Pending Decisions are unchanged: eligible-consumption scope, formal PV/BV event mapping and production operational calendar/cut-off. Asia/Taipei and historical snapshot fail-closed remain established. Next action: second SA Visual Review; no mechanical whole-site rollout.

Reviewed visual source commit: 436cbf7168bca53454f4f46ff2c8ac697464026b. Latest gate totals: 40 PASS / 7 BLOCKED / 0 FAIL. Two additional Admin pipeline regressions prove ambiguous batches require explicit selection and theory/calculation hash cannot replace missing payout/parameter evidence. Admin suite is now 18 PASS.
