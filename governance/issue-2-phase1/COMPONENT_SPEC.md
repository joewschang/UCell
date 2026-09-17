# Component specification

## Shared Design System authority

Design System v1 remains frozen. Bootstrap supplies grid and accessibility infrastructure only. Pages must not introduce local brand colors, status colors, spacing scales or money semantics.

| Component | Contract | Required behavior |
|---|---|---|
| `StatusBadge` | Domain status to semantic tone | Preserve raw enum in detail; unknown enum uses neutral |
| `MoneyState` | `amount` plus lifecycle status | Null pending states show `結算中`; never show NT$0 for unknown money |
| `MetricCard` | Label/value/helper | Value comes from API; null uses explicit unavailable language |
| `QualificationSwitcher` | Owned Qualification options | Server validates selection; feedback announces changed scope |
| `QualificationBadge` | Code/rank/ball context | Required on scoped organization/performance/bonus/order pages |
| `AwardLifecycle` | Current Award status | Emphasize only current evidence; do not infer past/future completion |
| `LoadingState` / `Skeleton` | Loading placeholder | Announce status without exposing stale private data |
| `EmptyState` | Successful query with no rows | Must differ from unavailable and error |
| `ErrorState` | Failed request plus optional retry | Preserve 401/403/409/422 distinctions where action changes |
| `DetailDrawer` | Secondary detail | Keyboard trap, Escape/cancel and focus restoration |
| `ConfirmDialog` | High-risk action confirmation | Requires reason; does not claim persisted audit unless API accepts it |
| `PageHeader` / `SectionHeader` | Page and section hierarchy | One H1/page; action area remains role-aware |

## Member components

| Group | Components | Specification |
|---|---|---|
| Shell | `MemberAppShell`, `MemberBottomNav`, `MemberPageHeader` | Mobile-first 375/390/430; fixed five-item primary navigation |
| Context | `QualificationProvider`, `ContextBar`, `QualificationSwitcher` | Clear current ball; unmount private scoped views on switch |
| Resource state | `useResource`, `Result`, `SessionBoundary`, `AppErrorBoundary` | Abort stale requests; fail closed on session expiry or parse mismatch |
| Dashboard | `Metrics`, `RepurchaseDetails`, action grid | Identity → Qualification → Active/repurchase → metrics → bonus |
| Organization | Sponsor/Binary tabs, `ReferralShare` | Separate semantics; absent Carry/tree remains unavailable |
| Commerce | `ConnectedShop`, `ConnectedOrderDetails`, package selectors, delivery editor | Client submits product/rule IDs and quantities, never official totals/PV |
| Account | Profile, registration, formal upgrade, logout | Person-level fields stay separate from Qualification-level fields |
| Content/notice | Content list/detail, notifications | Published/audience authorization and explicit read state |

Member consolidation targets for a later phase: standard page header adoption on every page, shared page-state slot, centralized status label mapping, consistent connected/mock notification controls and separate page modules instead of large `App.tsx` route bodies.

## Admin components

| Component/pattern | Current scope | Phase 1 specification |
|---|---|---|
| `AdminAppShell` / sidebar / header | Global protected shell | Collapsible domain groups; role-filtered links; explicit environment |
| `AdminDataGrid` | Bounded client page | Search/sort/page/columns only on loaded rows; disclose scope |
| `AdminTable` | Large tabular pages | Accessible caption/header; use when master-detail is unnecessary |
| `QueryFeedback` | Query loading/error/empty | Preferred query-state adapter |
| `ConfirmAction` | Governed mutations | Reason, actor context and busy lock; Backend stays authoritative |
| `SearchSelect` | Entity lookup | Server-backed search; distinguish no results from error |
| `TreeView` | Sponsor/Binary display | Tree kind fixed by query; historical time and root visible |
| `Workbench` | API operations | Technical detail surface, not a substitute for normal task UX |
| `QualificationDetail` | 10-tab domain detail | Evidence mismatch fails closed; audit tab remains role-gated |
| Bonus pipeline/detail | Stored settlement evidence | Exact batch selection and unavailable fields; no inferred lifecycle |

## Standard page compositions

1. **Dashboard:** PageHeader → authoritative KPIs → operational panels → alerts/unavailable sections.
2. **Master-detail:** FilterBar → bounded grid/list → right drawer/pane → CommandBar.
3. **Configuration:** Version inventory → immutable version detail → role-separated actions.
4. **Temporal organization:** Query context → semantic tree notice → viewer/detail.
5. **Settlement evidence:** Period/batch selector → pipeline → node drawer → evidence tables.
6. **Governance:** Filter/search → immutable evidence/result → export where authorized.

## State contract

Every page must distinguish loading, empty, error, unauthorized, validation conflict, unavailable, configuration pending and operational credential pending. A dash (`—`) is allowed only inside a clearly labeled available record; it must not replace a page-level state.
