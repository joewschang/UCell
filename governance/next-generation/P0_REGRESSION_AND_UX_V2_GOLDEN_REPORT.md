# P0 regression and UX v2 Golden Journey report

**Recorded:** 2026-09-19
**Start source:** `d4b876477e10fe3f421f093e8ac64b4f5931355b`
**Scope:** local and isolated P0 regression plus UX v2 Golden Journey evidence. This report is not a Stage or Production approval.

## Delivered corrections

- Admin subscription filtering now uses the operator-facing immutable **Ball Number** (`ballNo`) instead of displaying a Ball Number while sending an internal Qualification UUID. Existing `qualificationId` integrations remain supported as an optional legacy query parameter; submitting both filters fails closed with HTTP 422.
- The Ball Number validator and OpenAPI contract accept the complete authoritative identifier envelope: a 40-character tree code plus either bootstrap `X` + six digits or a 19-digit positive bigint suffix, for a maximum of 59 characters.
- Subscription list and detail views render Ball Number and Member Number. They do not render the Qualification UUID.
- Admin tree reads now advance the request serial before every node request. A late node page can no longer overwrite a later request. Tests also prove an A -> B -> A delayed tree-detail sequence cannot repaint stale route data.
- A mounted Admin session-expiry test proves a real 401 removes private UI, clears the query cache and all three Admin session keys, redirects to login, and does not render raw server details.
- Member and Admin smoke assertions were updated to the current intentional UX labels and safe generic validation message.

## Final local evidence

| Gate | Result |
|---|---|
| Fresh 0 -> current API suite | PASS — 83 suites / 792 tests; isolated database cleaned |
| Decision v3 | PASS — T01 through T17 |
| DB Golden | PASS — includes append-only return/replay, carry, payment, and Reservoir delta evidence |
| Admin unit/UI suite | PASS — 30 files / 110 tests |
| Admin production build | PASS |
| Member unit/UI suite | PASS — 26 files / 149 tests |
| Member production build | PASS |
| Admin connected smoke | PASS — 15 real local HTTP responses; valid Ball Number 200, forged Ball Number 422, safe recovery, 404 route, no network mutation |
| Member browser smoke | PASS — Edge channel; 320 / 390 / 768 viewports, qualification isolation and current journey coverage |
| Persistent P0 reconstruction | PASS — zero missing/invalid Member Numbers, Ball Numbers, or binary positions |
| Persistent migration status | PASS — 69 migrations; schema up to date |
| OpenAPI | PASS — 175 operations; `GET /api/v1/admin/subscriptions` adds optional `ballNo` and retains optional legacy UUID compatibility |
| OpenAPI and security policy preflight | PASS |
| RC isolated | PASS — offline, Prisma validate/generate, fresh migrations, DB Golden, API health, cleanup |

The full API run emits an expected test-path analytics-refresh warning while asserting recovery behavior; it finishes with all 83 suites and 792 tests passing.

## UX Golden Journey evidence

| Journey condition | Evidence |
|---|---|
| 390 / 768 / 1440 widths | Local browser verification of Member home/organization and Admin multi-tree pages found no document-level horizontal overflow; the Admin smoke also asserts the 1440 subscription page. |
| Enlarged-text layout | A 720 CSS-pixel viewport, equivalent to a 1440-pixel page at 200% layout width, retained focusable controls and no document-level overflow. Native browser zoom is not exposed by the local automation API, so an actual browser 200% zoom remains a manual UAT confirmation. |
| Keyboard | Enter expands Member repurchase details with `aria-expanded=true`; Enter switches the organization tab to the Binary view. Existing component tests cover dialog focus restoration, semantic tabs, buttons, tables, loading state, and sort semantics. |
| Snapshot and races | Member browser state states the fixed query snapshot and its data/recorded cutoffs. Admin tests prove snapshot conflict recovery, late A -> B -> A detail suppression, and late concurrent node-page suppression. |
| 403 | The connected read-only Admin multi-tree page showed an explicit denied state and did not render restricted content; write controls were disabled. |
| 409 | Tree tests clear stale preflight/node snapshots, retain the selected intent, and require an explicit refresh/review. |
| 422 | Connected Admin smoke proves forged `ballNo` receives 422 and the UI shows safe generic validation copy without a raw server code. |
| Session expiry | The mounted AuthProvider test proves private-data removal, credential/cache clearing, and login fallback after 401. |

## Boundaries

- **Stage deployment: STOP.** No Stage container update, migration, or configuration change was performed.
- **Production: BLOCKED.** No Production action or credential bypass was created.
- Formal `security:e2e` evidence remains externally blocked: no service/role tokens were available and the target was unavailable. Security policy preflight and isolated security-bearing regression gates pass, but this is not a substitute for formal token-backed E2E.
- Formal LINE/LIFF and Entra credentials remain external verification work. No identity bypass was added.
- The user-directed large-tree scale matrix was not run.
