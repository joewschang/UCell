# UX v2 implementation acceptance checklist

**Status:** implementation checklist; every item is unchecked until feature evidence exists.
**Scope:** UI experience work now; remaining broad regression, manual UAT, and scale evidence are scheduled separately. The user has explicitly excluded the 10K/100K/1M scale-work stream from this phase. That does not permit an unbounded tree viewer or browser-side calculation.

## Authority and working rule

This checklist consolidates the currently applicable UI requirements from:

- [UX audit](UX_AUDIT.md), [information architecture](INFORMATION_ARCHITECTURE.md), [page mapping](PAGE_MAPPING.md), and [component specification](COMPONENT_SPEC.md);
- [Binary Tree and statistics specification](BINARY_TREE_ADMIN_AND_STATISTICS_SPEC.md) and [Management Analytics / BI specification](MANAGEMENT_ANALYTICS_AND_BI_SPEC.md);
- [Final P0 identifier and member privacy decision](../next-generation/FINAL_P0_IDENTIFIER_PRIVACY_DECISION.md); and
- the Product Owner's P0 UX Golden Journey sections 49–100, whose requirements after section 101 remain `SOURCE_NOT_AVAILABLE`.

The implementation order is **role → task → decision → action → evidence**. A page may improve its layout before a new read model is available, but must render that source as `UNAVAILABLE`, `PENDING`, or `STALE`; it must never invent a monetary value, a topology edge, eligibility, or a privacy-sensitive label.

## Cross-cutting completion gate — implement first

- [ ] **UX-01 Business identity.** Normal Member and Admin operations display `memberNo`, `ballNo`, `treeCode`, `binaryPositionNo`, and `binaryPath` where relevant. UUIDs remain permitted only in RBAC-controlled diagnostics or internal URLs, never as the primary visible label, error, receipt, search prompt, breadcrumb, tooltip, DOM label, or export preview.
- [ ] **UX-02 Context isolation.** Every Ball-scoped request/cache/overlay key contains actor/session, role, Ball, tree, period, `asOf`, knowledge cutoff, and projection/snapshot context where applicable. A Ball switch clears prior money, organization, name, PII, Explain, and loading values before the new response can render. A delayed A → B → A response cannot repaint B with A data.
- [ ] **UX-03 Audience boundary.** Member surfaces consume Member-safe DTOs rather than Admin DTOs with client-side field removal. Member payload/DOM/ARIA/title/data attributes/test IDs omit bootstrap #1–#3, Reservoir A/B, Company economics, non-direct PII, and unnecessary UUIDs. Member-visible position >=4 remains visible when its server-derived scope permits it even if Company-held.
- [ ] **UX-04 Authoritative facts.** Cards and charts use a typed server fact with value, unit, availability, reason, basis/definition version, context, watermark/data-through, and evidence reference. `0`, `PENDING`, `UNAVAILABLE`, and `STALE` are distinct. The browser does not calculate entitlement, Carry, tree aggregates, Reservoir, next payout, or bonus totals.
- [ ] **UX-05 Route and command preservation.** Existing capabilities and legacy routes remain reachable or redirect with identifiers/period/filter context preserved. Commands expose review, idempotency-safe retry behavior, fresh preflight where required, and a receipt; a valid preview is never presented as a reservation.

## Highest-priority Member journeys

### M1 — My UCell Today and Ball switching

- [ ] Header shows the Person's immutable `memberNo`; the Ball switcher shows the selected `ballNo`, plan, rank, and authoritative status.
- [ ] A person with multiple Balls retains one `memberNo`; switching `A000001 → B000037 → A000001` changes all Ball-scoped panels together and leaves no previous-Ball state.
- [ ] Home leads with current tasks, Active state, performance, Binary summary, Carry, and next payout only when each fact is authoritative. A Company context renders the rule/evidence branch, never a member NT$2,000 progress display.
- [ ] No-Ball users retain account, formal-registration, consent, and qualification-package acquisition flows. Ball-dependent destinations explain the prerequisite without silently selecting another Ball.
- [ ] Navigation preserves the five destinations: 首頁, 組織, 收益, 商城, 我的. Existing route/query context survives redirects without loops.

### M2 — Organization: Sponsor and safe Binary organization

- [ ] Sponsor and Binary are separate tabs, queries, labels, and diagrams; Sponsor evidence is never substituted for a Binary parent/side.
- [ ] The Binary viewer is lazy and server-bounded, has an explicit snapshot/`asOf` context, supports refresh, and never downloads or recursively computes the full tree in the browser.
- [ ] Bootstrap positions #1–#3 are absent from Member API JSON, visual UI, DOM, ARIA, search, Explain, export, analytics, and notifications. A neutral “my visible organization” boundary may be shown, but it cannot claim a visible Ball is the authoritative tree root.
- [ ] Member nodes expose only Ball number and minimum authorized topology/status. Direct-sponsored identity is displayed only under the approved policy; non-direct nodes contain no name, member number, contact, LINE identity, Person ID, or null placeholder for those fields.
- [ ] Member Ball search accepts `ballNo` only inside the server-authorized scope. Bootstrap, foreign topology, UUID guessing, and enumeration do not reveal metadata.
- [ ] Visibility derives from the effective rule/evidence at the selected historical context. It does not use a fixed client depth or current rules for historical `asOf` queries.

### M3 — Money Journey and safe Explain

- [ ] Awards show Ball context, type, source, Theory, Final, Payable, Paid, settlement, payout, recovery, and lifecycle as separate stages; the UI never adds them together.
- [ ] Pending, reversed, recovered, and replayed history remains visible with its authoritative status. Next payout is not inferred from browser sums.
- [ ] Explain opens with the exact parent context and gives business summary before evidence links. It states missing or denied evidence rather than fabricating a narrative.
- [ ] Explain, awards, analytics, exports, notifications, navigation, and member tools reveal no Reservoir, Company economic evidence, bootstrap identity, or non-direct PII.

## Highest-priority Admin journeys

### A1 — Person 360 and Ball 360

- [ ] Person 360 header presents `memberNo`, membership status, authorized name/contact summary, Ball count, and an authorized Ball portfolio. It does not conflate Person state with Ball state.
- [ ] Each portfolio row uses `ballNo`, tree, plan, rank, status, and owner state. Role gates control PII and Company/financial fields.
- [ ] Ball 360 header presents `ballNo`, tree code, position, path, plan, rank, owner, and status; Sponsor and Binary parent use their Ball numbers and remain semantically separate.
- [ ] Technical IDs are confined to RBAC-controlled diagnostics/audit metadata. Historical holder and current holder are separately labelled.

### A2 — Tree Viewer, Tree Detail, and placement

- [ ] Tree List exposes Tree Code/name/status, operational counts, period context, freshness, cursor/snapshot behavior, and only permission-gated Reservoir B summaries.
- [ ] Tree Detail visibly separates identity/lifecycle, time/freshness, operational metrics, canonical #1–#7 diagram, founding comparison, Company panel, placement, analytics, settings, and evidence. Inconsistent panel contexts are withheld until refreshed together.
- [ ] Admin nodes show `ballNo`, position, path, side, plan/rank, owner classification, authorized holder label, child availability, and projection freshness. Admin retains authoritative positions #1–#3; Member projection rules do not reduce the Admin tree.
- [ ] #1–#3 appear as locked Company LEADER / Always Active bootstrap Balls; #4–#7 distinctly show available or occupied founding positions. The viewer continues beyond #7 through lazy expansion.
- [ ] Placement follows the complete flow: select unplaced Ball → Sponsor evidence → active Tree → parent Ball → LEFT/RIGHT → preflight → review → submit → receipt.
- [ ] Preview shows Tree, parent Ball/position, side, predicted position/path/Ball Number, and non-reservation status. Commit revalidates tree status, slot, Sponsor evidence, policy, version, and idempotency.
- [ ] A placement race returns a comprehensible 409 (“position is occupied; choose again”), keeps safe intent for review, and never silently relocates the Ball.

### A3 — Settlement, Return, Reservoir, analytics, and release

- [ ] Settlement Cockpit presents Recognition → Eligibility → applicable K → pool → Final Entitlement → economic destination → Payable, using business identifiers and exact context/evidence.
- [ ] Return Impact distinguishes request from POSTED return, preserves original PAID history, and shows authoritative Active, EPV, Award delta, recovery, and replay links without client arithmetic.
- [ ] Reservoir Center exists only in Admin/Finance. A and B are visibly distinct routes/sections; RBAC protects Company economics and no Member path, export, notification, or metric is created.
- [ ] Analytics header exposes metric/definition version, grain, period, tree/founding scope, `asOf`, snapshot, freshness, filters, and evidence drill-down. Unsupported filters return an explained 422; unavailable data is not rendered as zero.
- [ ] Release Control Tower distinguishes local assistive evidence from formal acceptance and shows Production BLOCKED. It contains no Stage-redeploy or Production-promotion action.

## Required visual states on every primary journey

For Home, Organization, Money Journey, Person/Ball 360, Tree/placement, Settlement/Return/Reservoir, Analytics, and Release:

- [ ] Loading skeleton announces `aria-busy` and cannot retain a previous Ball's protected values.
- [ ] Complete empty scope is distinct from incomplete/unknown source.
- [ ] `PENDING`, `UNAVAILABLE`, partial source, and `STALE` include a reason, freshness/data-through context, and a safe next action where one exists.
- [ ] 401/session expiry clears private cached values and offers sign-in; 403 denies without leaked metadata; 409 resolves to a refresh/review path; 422 binds clear field-level guidance to the relevant control; transient failure offers safe retry.
- [ ] Commands do not auto-retry with a newly generated idempotency key. Retry and receipt states make duplicate/lost-response behavior understandable.

## Accessibility and responsive acceptance

- [ ] Verify the implemented journeys at 390px, 768px, 1440px, and 200% zoom. Member uses a usable single-column layout below 768px; Admin navigation collapses below 1024px; table regions scroll without obscuring focus.
- [ ] All primary actions have a minimum 44px target, visible focus ring, logical keyboard order, and a text/icon status indicator in addition to color. Contrast is verified for actual foreground/background pairs (4.5:1 normal text; 3:1 large text/controls).
- [ ] Switchers announce selection and loading; dialogs/drawers trap focus and restore it to their trigger; tabs support arrows/Home/End and roving focus.
- [ ] Tree Viewer provides a keyboard-accessible table/list alternative. Tree, anonymous nodes, hidden-bootstrap boundaries, selected Ball, and placement results have useful safe labels.
- [ ] Accessibility metadata is privacy-reviewed: no hidden bootstrap Company identifier, Reservoir fact, non-direct PII, or needless UUID appears in ARIA, tooltips, titles, hidden text, data attributes, or production data-bearing test IDs.

## Evidence required before calling a journey implemented

- [ ] Route/capability preservation evidence, including direct URL, refresh, back/forward, unauthorized bookmark, no-Ball, and multi-Ball context changes.
- [ ] Journey-level component/interaction evidence covers the normal path and the required state matrix above.
- [ ] Member-safe raw response and rendered-DOM review covers tree, Explain, search, export preview, notification, and analytics entry points.
- [ ] Admin RBAC evidence distinguishes Operations, Support, Finance, Audit, and System roles according to existing capability grants; a hidden navigation item is not counted as authorization.
- [ ] OpenAPI/DTO evidence makes Member-safe versus Admin-rich contracts explicit for changed Tree, Person, Ball, Explain, analytics, search, and export endpoints.
- [ ] Screenshots or equivalent accessible visual-review artifacts cover: zero/multiple Balls; active/inactive/Company state; finalized/pending/empty money; Sponsor versus Binary; placement preview/race; tree availability/occupancy; Return before/after POSTED; A/B separation; and Release blockers.

## Explicitly deferred from this UI workstream

- Broad 10K/100K/1M benchmark execution and its performance reports, per the current user direction. Bounded server-side behavior remains an implementation constraint.
- Formal manual UAT completion and the blocked external identity/credentials security environment.
- Stage deployment, Stage database migration, Production release, LLM/RAG/vector functionality, and SwaggerHub publishing.

Completion of this checklist is a UI implementation readiness record. It is not a Stage or Production approval and does not replace the remaining test, security, UAT, or release gates.
