# Issue #2 Phase 2 — PASS/FAIL Matrix

| Gate | Result | Evidence |
|---|---|---|
| Admin TypeScript | PASS | `pnpm typecheck` |
| Admin tests | PASS | 15 files / 38 tests |
| Admin build | PASS | Vite production build; existing chunk-size warning only |
| Member TypeScript | PASS | `pnpm typecheck` |
| Member tests | PASS | 23 files / 139 tests |
| Member build | PASS | Vite production build |
| Responsive route review | PASS | 104 route/viewport combinations; 26 refreshed references |
| Accessibility static review | PASS | 26 routes; formal screen-reader audit remains pending |
| Admin route authorization | PASS | Explicit 403 regression; unauthenticated login redirect retained |
| Member qualification context visibility | PASS | Shared page-header and terminology regressions |
| Monetary/business semantics | PASS | No Core, Backend, Prisma, or API changes |
| Formal LINE/LIFF | BLOCKED | Operational credentials pending |
| Formal Entra/RBAC | BLOCKED | Operational credentials pending |
| UAT sign-off | BLOCKED | Formal evidence workflow pending |
| Production promotion | BLOCKED | Release gates remain incomplete |

## Checkpoint 2 verification

| Gate | Result | Evidence |
|---|---|---|
| Backend build | PASS | Shared, contracts, database, API, and worker builds |
| Backend isolated API | PASS | 41 suites / 358 tests; all 42 migrations on isolated DB |
| Backend Binary read model | PASS | 2 focused regressions |
| OpenAPI export/preflight | PASS | Additive availability contract exported and validated |
| Member tests | PASS | 23 files / 140 tests |
| Admin tests | PASS | 16 files / 43 tests, including dashboard RBAC query gating |
| Member/Admin builds | PASS | Production Vite builds |
| Business/monetary semantics | PASS | No formula, ledger, settlement, or authorization changes |

## Notes

The initial sandboxed rerun could not write Vite and TypeScript temporary files under `C:\UCell\UCell` (`EPERM`). The same commands were rerun with the required workspace write permission and passed. This was an execution-environment restriction, not a product failure.

One Admin full-suite run observed an existing asynchronous package-page timing failure. Its focused rerun and the following complete 16-file suite both passed without code or assertion changes; it is recorded as test-infrastructure timing evidence rather than hidden.

## Checkpoint 3 verification

| Gate | Result | Evidence |
|---|---|---|
| Backend build | PASS | Shared, contracts, database, API, worker |
| Backend isolated API | PASS | 42 suites / 364 tests; 42 migrations applied to isolated DB |
| Versioned dashboard calendar | PASS | Taipei/UTC boundaries and missing/invalid/overlap fail-closed cases |
| Member tests | PASS | 24 files / 142 tests, including conditional journeys |
| Admin tests | PASS | 17 files / 44 tests, including UAT boundary and deterministic package render |
| Member/Admin builds | PASS | Production Vite builds |
| Database migration | NONE | Existing schema is sufficient |
| Business/monetary semantics | NONE | Read boundaries and evidence classification only |

## Checkpoint 4 verification

| Gate | Result | Evidence |
|---|---|---|
| Prisma schema validate | PASS | 43-migration schema |
| Prisma client generate | PASS | Normal Windows query-engine client regenerated after controlled DEV API restart |
| Backend build | PASS | Shared, contracts, database, API, worker |
| Backend isolated API | PASS | 43 suites / 379 tests on fresh isolated DB |
| Member Binary DB regression | PASS | 7 assertions |
| UAT evidence DB regression | PASS | 4 assertions: append, update deny, delete deny, formal approval constraint |
| Member tests/build | PASS | 24 files / 142 tests |
| Admin tests/build | PASS | 17 files / 44 tests |
| OpenAPI preflight | PASS | Member settlement scope, Dashboard lifecycle and UAT evidence operations |
| Database migration | PASS | `20260918150000_uat_evidence_foundation` |
| Production promotion | BLOCKED | Formal UAT sign-off and remaining release gates are not satisfied by evidence ingestion |

## Checkpoint 5 verification

| Gate | Result | Evidence |
|---|---|---|
| UX-3 responsive routes | PASS | 104 route/viewport assertions; 26 refreshed reference screens |
| UX-3 automated accessibility | PASS | 26 routes: named controls, main landmark, headings, text status semantics |
| Formal LINE/LIFF and Entra/RBAC | BLOCKED | Operational credentials and formal environment execution still required |
| Complete WCAG/manual screen-reader audit | BLOCKED | Automated basic checks are not formal accessibility certification |

## Checkpoint 6 verification

| Gate | Result | Evidence |
|---|---|---|
| Governed UAT evidence read UI | PASS | API row, filters, loading/error/empty and evidence/local separation regressions |
| Admin tests | PASS | 17 files / 47 tests |
| Formal UAT sign-off | BLOCKED | Read-only evidence metadata does not constitute approval or gate completion |

## Checkpoint 7 verification

| Gate | Result | Evidence |
|---|---|---|
| UX-3 responsive routes | PASS | 104 route/viewport checks; `/uat` passes 768/1366/1440/1920 without overflow |
| UX-3 automated accessibility | PASS | 26 routes; named controls, landmark, headings and text status semantics |
| Formal accessibility certification | BLOCKED | Complete screen-reader/manual WCAG audit remains pending |
