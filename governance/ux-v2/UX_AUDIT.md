# Experience v2 UX audit and executable handoff

Status: Phase 1 design specification; no UI rewrite in this phase. Baseline and source conflicts are in [gap audit](ARCHITECTURE_GAP_ANALYSIS.md). Authority: [Issue #2 snapshot](evidence/ISSUE_2_SNAPSHOT.md). Product direction is Role -> Task -> Decision -> Action -> Evidence.

## 1. Current experience and target journeys

| Journey / source | Existing usable behavior | Friction / target acceptance |
|---|---|---|
| Member Home — `member/src/App.tsx::Home` | identity, Ball switcher, Active interval, repurchase, performance, bonus and quick links | technical PV label and console copy; replace with 今日需要完成的事, NT$2,000 authoritative progress, next finalized payout, weekly Binary summary; missing sources remain unavailable |
| Global Ball switch — `QualificationContext.tsx` | server-confirmed selection, abort/sequence handling and keyed page reset | preserve across every tab; declare loading switch state, clear stale values and explain rejected ownership; A->B->A never flashes another Ball's money |
| Organization — `App.tsx::Organization` | separate Sponsor/Binary calls, settlement availability | people/referrals and L/R positions need distinct visual structure; dedicated bounded viewer; company nodes badge only, no B disclosure |
| Performance — `App.tsx::Performance` | month control and updatedAt | GPV/RPV/EPV business labels, authoritative Carry period, Explain; source `pv` discrepancy blocks blind relabel |
| Bonus — `App.tsx::Bonuses` | lifecycle, final/theory/payable, payout anchors, ledger | lead with money journey and business source; no next-payout estimate from browser sums |
| Shop — `Shop`, `ConnectedShop`, `QualificationPackageShop`, `ActiveDurationPackages` | actual order/package/selection flows, delivery profile | separate product vs qualification package vs other package effects; show server-authoritative eligibility/price, retry-safe purchase, no implied stock guarantee |
| Account — `Me`, `ProfileEditor`, `FormalUpgrade`, `NetworkRegistration` | Person profile, membership upgrade, multi-Ball portfolio | Person fields separated from Ball attributes; portfolio opens Ball context; zero-Ball users retain registration/package access |
| Content/notifications — `Content`, `Notifications` | existing listing/detail and notification workflows | secondary navigation remains discoverable; Ball-scoped notifications keep context; mock unread never presented as connected fact |
| Admin Home — `DashboardPage` | operational cards, explicit unavailable metrics | task queues then system evidence, no synthetic GMV/NASL; domain links retain all existing functions |
| Person — `PeoplePage` embedded detail | search/master-detail/profile/qualification references | Person 360 portfolio, authorized identity links and audit; no mixing Person/Qualification status |
| Ball — `QualificationDetail` | ten tabs, scope checks, role-gated audit, truncated history disclosures | Ball 360 header and fact timeline; historical holder separate from current; company branch hides fake Active progress |
| Organization — `OrganizationPage`, `TreeView` | Sponsor/Binary toggle, root/depth/as-of | explicit tree selector and locked bootstrap; accessible position view; server subtree stats and context version |
| Settlement — `BonusesPage` | evidence operations/read models | cockpit stage overview, missing-source statuses, financial summaries and Explain; no manual recalculation in browser |
| Return — `ReturnsPage` | source return/replay/recovery links | business impact before raw evidence; pre-POSTED not official reversal; PAID original preserved |
| Release — `UatPage`, `SystemPage` | existing UAT/readiness controls | unified tower with assistive vs formal evidence and persistent Production BLOCKED |

## 2. Priorities and dependencies

P0 correctness: Ball isolation, exact scope/period, nullable monetary state, official source evidence, RBAC/masking, distinct Sponsor/Binary, historical fail-closed. No visual improvement may weaken these.

P1 navigation/comprehension: five Member destinations, seven Admin domains, persistent context, business labels and progressive disclosure. These are READY_FOR_IMPLEMENTATION after Phase 1 review and can reuse existing primitives.

P1 new-domain UI: tree settings, available founding positions, company owner/Always Active, Reservoir Center. Draw and specify now; enable only after authoritative schema/API and D1/D2 decisions. Do not display mock B amounts to suggest a working financial feature.

P2 scale/accessibility: bounded viewer, cursor lists, snapshot CSV, keyboard/phone/tablet behavior and stale state. Analytics descriptors may be implemented only where authoritative data exists. AI, new inventory accounting and deployments are deferred.

## 3. Wireframe specifications

Member Home at 390px: app header + notifications; persistent full-width Ball switcher (code/plan/rank/Active); 今日任務 alert; Active card; next payout card; three business-performance rows; two-column Binary L/R card; quick actions; five-item bottom nav. Gold appears on finalized money/rank only. PENDING occupies the same area as amount without currency zero. Active card has amount/remaining/date provided by backend, progress accessible text, and Explain link. A Company context renders rule badge instead of threshold progress.

Member Money Journey: header Ball+month; next confirmed payout (when available); lifecycle filter; Award cards each with type/source/amount/status/date; open Explain drawer; ledger/recovery subsection. Do not hide reversed or recovered history. Detail must distinguish Theory, final entitlement and payable, not present all three as amounts to add.

Admin at 1440px: left domain navigation; top identity/environment bar; page title/breadcrumb; task/context filters; responsive summary cards; main operational table; optional detail panel. Person 360: identity/membership, authorized contact/LINE binding metadata, Ball portfolio, linked applications/orders/notifications, audit. Ball 360: Qualification/owner/plan/rank/Active, Sponsor and Binary parent shown separately, tree/position, concrete performance, settlement Carry, tabbed detail.

Tree Detail: see [statistics spec](BINARY_TREE_ADMIN_AND_STATISTICS_SPEC.md) for every table field and exact metric definition. Required visible sections in order: tree identity/status; time scope+source freshness; operational metrics and separate bootstrap count; #1–#7 diagram; #4–#7 founding comparison; company-income panel if permitted. Placement Console is a step flow: choose existing unplaced Ball -> review Sponsor evidence -> choose ACTIVE tree/parent/side -> preflight checks -> reason and review -> submit -> receipt. A valid preview is not a reservation. Settings never exposes bootstrap edit/delete.

Settlement Cockpit: period/rule context -> stage ribbon Recognition / Eligibility / K0 / K1 / K2 / Global+A / destination / payable -> stage detail rows -> Explain panel. B is a destination after final calculation, not a new pool stage feeding K. Return Impact: order/return status -> posted quantities/value -> authoritative Active and EPV before/after -> affected Award deltas -> recovery/paid references -> technical evidence. If replay pending, show pending, not guessed impact.

Release Control Tower: environment+Production BLOCKED; Core, Identity, Operations, UAT, Security gate sections; blocker owner/action/evidence; separate local assistive evidence and formal acceptance. Existing UAT operations remain governed; no button performs Stage redeploy or Production promotion in Issue #2.

## 4. State and accessibility audit acceptance

All primary pages need loading skeleton, complete empty scope, partial/unavailable source, 401 expiry, 403 denial, 409 conflict, 422 field validation, transient failure/retry and stale projection states. Page-level errors cannot retain stale previous-Ball values. Read retries are safe; command retry preserves key/payload. Explain absent evidence has a reason, not a fabricated narrative.

Keyboard order follows visual order. Switcher announces successful selection; loading sets aria-busy; dialogs trap and restore focus; tabs use roving focus/arrows/Home/End; tree offers a keyboard-accessible list/table alternative. Status has text/icon, never color alone. Proposed touch targets >=44px; contrast verify at least 4.5:1 ordinary text and 3:1 large text/controls. Responsive review widths: 390/768/1440 plus 200% zoom. Sticky table columns must not obscure scroll/focus.

Screen captures in the implementation phase must include Member zero/multiple Balls, inactive/active/company badge, finalized/pending/empty money, Sponsor/Binary, Shop packages, Person/Ball 360, all four tree states, occupied/available founding positions, projection gap, placement race, A/B isolation, Return before/after POSTED and release blockers. Phase 1 has source-based wireframe specifications, not claimed implemented screenshots.

## 5. Readiness and next-phase acceptance

READY_FOR_IMPLEMENTATION: shell/IA, route preservation, display tokens/states, business-first evidence presentation, scoped cache and component contracts. READ_MODEL/API prerequisites: Active progress, finalized payout summary, full 360 timelines, return impact, tree statistics and reconciliation. REQUIRES_PRODUCT_OWNER_REVIEW: D1/D2 dependent company bootstrap/Sponsor economics. Frozen rates/thresholds/calendar are not pending.

Required tests are consolidated across [component](COMPONENT_SPEC.md), [mapping](PAGE_MAPPING.md), domain MT01–MT13 and statistics ST01–ST16. Regression results and limitations are in [verification](VERIFICATION.md). This is a complete specification handoff, not authorization to begin the next phase or a Production readiness declaration.

## Incremental audit: Analytics and AI

At 924dadc, management Analytics exists; earlier baseline absence findings are superseded by the reconciliation in [gap analysis](ARCHITECTURE_GAP_ANALYSIS.md). Current capture-based Person NASL and bounded sonar must not be presented as arbitrary historical multi-tree financial truth. AI requests introduce Member contextual help and Admin evidence-based query planning; proposed flows/states and restrictions are in [AI Core](AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC.md). No new screens were implemented or visually tested.
