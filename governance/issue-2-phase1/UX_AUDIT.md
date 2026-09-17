# UX audit

## Boundary

The audit covers the Member LIFF frontend, Admin Operations Console, shared Design System, UI-facing APIs/read models and the 35-page functional baseline. It evaluates information structure, task clarity, states, terminology, component reuse, evidence boundaries and authorization visibility. It does not evaluate or change monetary formulas.

## Baseline reconciliation

| Surface | Current code | 35-page guide | Earlier UX-3 claim | Disposition |
|---|---:|---:|---:|---|
| Member pages | 10 | 10 | 8 | Earlier matrix predates content list/detail |
| Admin pages | 21 including login | 21 | 18 protected | Current code has login plus 20 protected routes |
| Guide-only slides | n/a | 4 | n/a | Cover, environment, navigation and verification |
| Total guide slides | n/a | 35 | n/a | 31 UI states plus 4 explanatory slides |

The React route trees determine route existence. The 35-page guide is the current visual/operational baseline. Earlier counts remain historical evidence.

## Strengths

- Member flows establish Qualification context before organization, performance, bonus and commerce data.
- Admin master-detail flows visibly separate Person and Qualification.
- Sponsor and Binary organization semantics remain separate.
- Shared Loading, Empty, Error, Money, Status, Qualification, Drawer and Confirm patterns exist.
- Member adapters validate returned Qualification and period and fail closed on mismatch.
- Admin routes retain page-level RBAC filters and explicit DEV environment banners.
- Pending money uses `amount: null`, never a fabricated zero.
- Missing Admin read models remain unavailable rather than using fake data.
- High-risk Admin actions add confirmation without replacing Backend authorization, idempotency or audit.

## Findings

| ID | Severity | Finding | Current handling / required boundary |
|---|---|---|---|
| UX-001 | High | Route-count documentation is stale | Replace current inventory claims with 10 Member and 21 Admin pages |
| UX-002 | High | Member Carry and full Binary Tree lack authoritative reads | Continue to show unavailable; additive API needed later |
| UX-003 | High | Admin lacks authoritative NASL, GMV, organization-health, settlement-health and security aggregates | Keep dashboard cards unavailable |
| UX-004 | High | Formal LINE and Entra cannot be certified from DEV screenshots | Keep operational credential blocker visible |
| UX-005 | High | Admin Dashboard date boundaries use runtime-local date construction, not versioned Asia/Taipei calendar | Treat date aggregates as a Phase 2 additive read-model gap |
| UX-006 | High | Admin `/system` uses a static 74-route registry while OpenAPI contains 123 paths | Mark as static reference/drift, not readiness authority |
| UX-007 | Medium | Member `/shop` combines retail, Qualification and Active-duration package intents | Improve hierarchy later without inventing rules |
| UX-008 | Medium | Registration, formal upgrade and delivery flows are nested and absent from the 35-page visual baseline | Add conditional journey evidence before redesign |
| UX-009 | Medium | Admin pages mix grid, list-row, table and raw JSON patterns | Standardize page compositions in Phase 2 |
| UX-010 | Medium | `AdminDataGrid` operates only on the loaded page | Keep disclosure; do not imply server-wide results |
| UX-011 | Medium | English domain codes and Chinese labels are inconsistent | Apply terminology rules while preserving enums |
| UX-012 | Medium | Member content DEV fixture is absent | Preserve fail-closed state; do not fabricate content |
| UX-013 | Medium | Unauthorized Admin routes silently redirect to `/` | Specify an explicit 403 state for Phase 2 |
| UX-014 | Medium | UAT page stores browser-local evidence only | Label `LOCAL_ASSISTIVE_ONLY`; never treat as formal sign-off |
| UX-015 | Medium | Confirmation reason is not persisted for every command | Keep the disclosure; requires an additive contract |
| UX-016 | Medium | Product/Order copy still mentions GPV in places | Do not reinterpret it as prospective PV/BV; align contract first |
| UX-017 | Low | Unknown status enums fall back to neutral | Safe fallback; map only real domain enums |

## Authority vocabulary

| Status | Meaning |
|---|---|
| `AUTHORITATIVE` | Persisted Core fact with defined scope |
| `AUTHORITATIVE_WITH_PENDING_FIELDS` | Core response contains explicit null/status/reason fields |
| `UNAVAILABLE` | Required API or semantics do not exist |
| `CONFIGURATION_PENDING` | Approved calendar/cut-off/config is missing |
| `OPERATIONAL_CREDENTIAL_PENDING` | Formal LINE/Entra credential evidence is missing |
| `LOCAL_ASSISTIVE_ONLY` | Local tool may assist testing but is not formal evidence |
| `STATIC_REFERENCE_DRIFT` | Static inventory is known to lag the authoritative source |

## Visual-state coverage gap

The 31 screenshots cover normal/default or explicit unavailable states. They do not provide a complete Connected visual baseline for loading, empty, 403, 409, 422, expired session, offline, no-Qualification onboarding, encrypted formal application, delivery profile and package purchase. Functional tests may cover a state without a visual reference; the two evidence classes must remain distinct.

## Phase 2 entry rule

Phase 2 may begin only after this checkpoint is accepted. It must preserve current routes, authorization, API contracts, qualification isolation, Sponsor/Binary separation, null monetary semantics and fail-closed behavior. Any new read model must be additive and must not infer pending business definitions.
