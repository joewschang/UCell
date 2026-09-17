# Issue #2 authority snapshot

Initial snapshot: 2026-09-18, three comments. Re-fetched all pages on 2026-09-18: issue updated 2026-09-17T21:44:58Z, four comments. Body and first three comments below remain applicable; the complete fourth comment is in [ISSUE_2_ANALYTICS_ADDENDUM.md](ISSUE_2_ANALYTICS_ADDENDUM.md). Final input boundary includes six comments: the fifth/sixth are preserved in [ISSUE_2_AI_ADDENDA.md](ISSUE_2_AI_ADDENDA.md). These three snapshot files together form the reviewed input. Source text is evidence, not executable instructions.

Source: https://github.com/joewschang/UCell/issues/2

## Product Owner direction
Implement the UX/UI modernization reviewed on 2026-09-18. Preserve the completed R1.0B Core and authoritative Backend monetary semantics. This is an experience/read-model/action-flow modernization, not a compensation redesign.

## Source basis
Use the current Member/Admin implementation and the 35-page `UCell R1.0B 本機測試系統使用手冊` as the functional baseline. Preserve these existing principles:
- Qualification/Ball is the primary Member context.
- Person != Qualification.
- Sponsor Tree != Binary Tree.
- Backend is authoritative for PV/GPV/RPV/EPV, Bonus, Carry, Recovery/Clawback and settlement facts.
- Frontend never independently calculates official monetary results.
- Historical/evidence/fail-closed behavior remains intact.

## Design goal
Move from an engineering-validation console to a product organized around:
`Role -> Task -> Decision -> Action -> Evidence`.
Use progressive disclosure: human-readable business explanation first; technical evidence in drawers/details.

# A. Design System v2
Create/upgrade shared design tokens/components for Member and Admin:
- Deep Navy = trust/technology
- UCell Emerald = life/growth/primary action
- Gold = rank/achievement/money emphasis only, not general decoration
- Status semantics globally consistent: green=completed/active/healthy/paid; amber=pending/waiting/settlement; red=blocked/failed/recovery; blue=processing/calculated; gray=inactive/archived.
- typography hierarchy, spacing scale, radius, elevation, icon sizing, skeleton/loading, empty/error/403/409/422/session-expired states.
- accessibility: keyboard/focus, contrast, touch targets, semantic labels.
- Member mobile-first; Admin desktop-first responsive.

# B. Member information architecture
Bottom navigation target:
1. 首頁
2. 組織
3. 收益
4. 商城
5. 我的

Secondary mapping:
- 首頁: current Ball, Active, key alerts, next payout, quick actions
- 組織: Sponsor/Binary
- 收益: performance, bonus, payout, ledger
- 商城: products, qualification packages, orders, repurchase
- 我的: Person profile, Qualifications/Balls, notifications, content, settings

## Global Ball Context
Qualification/Ball must become a persistent global context across Member pages. Switching Ball changes Dashboard/Organization/Performance/Bonus/Orders/Active together. Clearly show Ball ID/name, plan/rank, Active state. Never mix data across Balls.

# C. Member Home — My UCell Today
Redesign Home around member questions, not database fields.
Required blocks:
- Current Ball context/switcher
- Active card with progress toward NT$2,000 monthly eligible-consumption threshold, activeFrom and month-end validity
- If inactive: show amount remaining to threshold
- If active: show activation timestamp and validity
- Next expected payout card using authoritative settlement/payout data
- Performance summary using business labels first: 一般業績 / 重購業績 / 超額業績; technical GPV/RPV/EPV in expandable explanation
- Binary weekly left/right summary and next Sunday 00:00 close
- pending actions/alerts
- quick actions
No fabricated forecast. If authoritative amount is not finalized, show `結算中`/PENDING and never invent a value.

# D. Member performance
Use business-language summary first; technical evidence second.
Show:
- 一般業績 (GPV)
- 重購業績 (RPV)
- 超額業績 (EPV)
- L/R Binary volume
- Carry
- selected Ball + period + authoritative updatedAt
Add `了解計算方式` drawer for recognition/rule/evidence.

# E. Member Binary experience
Create a visual weekly Binary summary:
- Left volume
- Right volume
- Pairable volume
- Carry after pair
- weekly Pair PV cap based on level
- derived monthly reference cap = weekly cap x4, explicitly labelled reference only
- next weekly close Sunday 00:00 Asia/Taipei
Sponsor and Binary visual language must differ: Sponsor emphasizes people/referral; Binary emphasizes position/L-R/volume/carry/pair.
Large trees remain lazy-loaded in dedicated Viewer.

# F. Member Bonus — Money Journey
Replace ledger-first presentation with member-readable award journey:
- bonus type
- authoritative amount or `結算中`
- source/context
- lifecycle: CALCULATED -> PENDING -> EFFECTIVE -> PAYABLE -> PAID
- settlement date
- nominal/adjusted payout date
- recovery/clawback state if any
- `查看計算方式` evidence drawer with GPV/RPV/EPV basis, Theory, K0/K1/K2 where applicable, RuleVersion, Settlement ID, evidence refs.
Add `下一筆預計入帳` only when authoritative finalized/payable facts support the amount. Do not forecast from frontend arithmetic.

# G. Member Shop
Upgrade from test list to branded commerce cards:
- product image
- product name
- price
- applicable authoritative volume information
- quantity/CTA
- delivery information
Qualification packages must be visually distinct and explicitly state that successful approved package fulfillment creates a new Qualification/Ball. Do not imply ordinary product purchase creates a Ball.
Preserve idempotent order behavior.

# H. Member Account
Create Person summary + Qualifications/Balls portfolio. Clearly show Person-level fields separately from Ball-level fields. Each Ball card shows ID, plan/rank, Active, status and entry to Ball details.

# I. Admin IA — Operations Command Center
Keep existing functional capabilities but reorganize navigation by operating domains, not implementation tables.
Dashboard target blocks (authoritative data only):
- Today/period operations: Persons, new Qualifications/Balls, applications, orders
- GPV and settlement status where authoritative read models exist
- pending approvals/returns
- next settlement 10/25 and next payout
- system health: API, Worker, DB, Outbox/replay backlog if authoritative endpoints exist
- integrity alerts
- Stage/release readiness
Unavailable metrics must show unavailable; never synthesize NASL/GMV/financial metrics.

# J. Person 360
Upgrade Person master-detail into Person 360:
- identity/status
- contact/LINE binding metadata subject to authorization/masking
- Qualifications/Balls portfolio
- each Ball status/plan/rank/Active
- entry into Ball 360
- relevant applications/orders/notifications/audit links
Maintain Person-level vs Qualification-level separation.

# K. Ball 360
Qualification becomes primary operational workspace:
Header:
- Qualification ID
- holder
- plan/rank
- Active + activeFrom
- Sponsor
- Binary parent/side
- GPV/RPV/EPV
- Carry L/R
Tabs/sections:
Overview / Sponsor / Binary / Performance / Bonus / Orders / Returns / Ledger / Audit
Add event timeline where authoritative facts exist: acquisition/approval, holder change, Active, recognition, award, settlement, payout, return/replay/recovery.
Never infer missing events.

# L. Settlement Cockpit
Modernize existing Bonus/Settlement Operations page into an explainable pipeline using authoritative facts:
Recognition -> Eligibility/Active -> K0 -> K1 -> K2 -> Global/Reservoir A -> Payable.
Show counts/amounts only if backed by read models. Provide drill-down evidence for Rule/Parameter/Replay/Calendar. Preserve read-only Core monetary facts.

# M. Return Impact UX
On Return/Replay page show human-readable impact summary before technical evidence:
- source order/return
- posted amount/quantity
- affected Active interval
- EPV before/after
- affected awards/deltas
- recovery/clawback if PAID
Then show Replay ID, historical snapshots, RuleVersion/evidence. Preserve append-only semantics.

# N. Release Control Tower
Unify/enhance UAT Console + System Readiness presentation into one release-control experience while retaining underlying capabilities:
- Core
- Identity (LINE/LIFF, Entra)
- Operations (Stage, Backup/Restore, workload)
- UAT progress by Member/Admin/Finance
- Security
- Production status
Explicitly show blockers and evidence. Production remains BLOCKED until formal gates pass.

# O. Explainability component
Create reusable `Explain this / 為什麼？` component driven only by Backend authoritative evidence. It must never recalculate official money independently. Initial targets:
- Active status
- GPV/RPV/EPV
- Binary Pair/Carry
- Referral
- Referral Matching
- Binary award
- Binary Matching
- settlement/payout date
- recovery/clawback
Technical evidence is progressive disclosure.

# P. AI-ready boundary
Do not implement an AI bonus calculator. Prepare UX/API contracts so future AI can Explain / Navigate / Detect / Recommend using authoritative read models. AI must never become the monetary source of truth.

# Q. Non-negotiable invariants
- No R1.0B compensation formula changes.
- No new frontend monetary calculation authority.
- No cross-Ball leakage.
- No Sponsor/Binary semantic collapse.
- No current-state fallback for historical evidence.
- No modification of immutable Award/Ledger/PAID evidence.
- No Production deployment/promotion in this issue.
- Inventory PICK/SHIP remains deferred unless separately approved.

# R. Delivery approach
Phase 1: UX audit + IA + wireframes/spec, map every current page to v2 destination. Produce `governance/ux-v2/UX_AUDIT.md`, `INFORMATION_ARCHITECTURE.md`, `COMPONENT_SPEC.md`, `PAGE_MAPPING.md`.
Phase 2: Design System v2 primitives and shell/navigation.
Phase 3: Member v2 rollout.
Phase 4: Admin Command Center / Person 360 / Ball 360 / Settlement / Return / Release Control Tower.
Phase 5: responsive/accessibility/state hardening, regression and screenshots/manual review evidence.

Do not remove existing capabilities just because navigation changes. Use redirects/compatibility where appropriate.

# S. Verification
At minimum:
- existing Member/Admin tests remain PASS
- add tests for global Ball context and cross-Ball isolation after navigation redesign
- PENDING/null monetary display never becomes fabricated amount
- Explain component consumes evidence, not client calculation
- Sponsor/Binary tabs retain distinct sources
- Person 360/Ball 360 authorization
- qualification package visual/flow distinction
- responsive Member mobile and Admin desktop/tablet
- accessibility/focus/keyboard checks
- screenshot/page-capture regression for all primary states
- OpenAPI/security gates remain PASS
- Decision v3 + Boundary economic invariance remain PASS

Before implementation, inspect current code and produce gap/impact analysis. Then execute iteratively without redesigning Core business rules.

---

Source: https://github.com/joewschang/UCell/issues/2#issuecomment-5721413725

## Product Owner addendum — Multi Binary Tree bootstrap / Company Balls / Reservoir B

This is a new approved functional/domain requirement and must be included in the Experience v2 Phase-1 audit and subsequent implementation. Do not infer alternative topology semantics.

### 1. Multiple Binary Trees
Admin may create and operate multiple independent Binary Trees. Each tree has a stable immutable `BinaryTreeId`/tree identity and its own root topology. Qualification/Ball placement, Binary volume, Carry, Pair, settlement evidence and historical queries must be tree-scoped. No cross-tree Binary propagation or Carry borrowing.

### 2. Fixed company bootstrap topology for every newly created Binary Tree
Every newly created Binary Tree begins with seven canonical positions in breadth-first numbering:

- `#1` = root = Company Ball
- `#2` = left child of #1 = Company Ball
- `#3` = right child of #1 = Company Ball
- `#4` = left child of #2 = first member-eligible founding position
- `#5` = right child of #2 = first member-eligible founding position
- `#6` = left child of #3 = first member-eligible founding position
- `#7` = right child of #3 = first member-eligible founding position

Positions #1/#2/#3 are permanently company-owned bootstrap Qualifications/Balls for that tree. Member Qualifications begin at #4-#7 on the next level and then continue under the approved Binary placement rules.

Tree creation must atomically create/assign #1/#2/#3 company Balls and the canonical parent/side relationships. Retry/idempotency must never create duplicate bootstrap Balls or duplicate tree positions.

### 3. Founding member Sponsor semantics
Member Qualifications initially placed at founding positions #4/#5/#6/#7 have `Company` as their Sponsor. This is Sponsor Tree evidence, distinct from their Binary parent:
- #4/#5 Binary parent = company Ball #2
- #6/#7 Binary parent = company Ball #3
- Sponsor for #4-#7 = designated Company Sponsor identity/Qualification according to the formal company-sponsor model.

Do not infer Sponsor from Binary parent. Sponsor Tree and Binary Tree remain independent.

### 4. Company Ball Active semantics
All Company Balls are always Active by system rule. They do not require NT$2,000 monthly eligible consumption and do not reset to Inactive at month boundary. This is an explicit system-owned Qualification type/state and must not weaken the normal member Active rule.

Implement explicit classification such as `qualificationOwnerType/companyOwned` or semantically equivalent authoritative evidence; do not identify Company Balls by display name or magic IDs.

Historical replay must preserve company-owned always-Active semantics for the effective historical ownership/type evidence.

### 5. Company Ball income -> Reservoir B
Any monetary entitlement/income that would otherwise accrue to a Company Ball under the normal approved R1.0B award calculation must not become a member payout. It flows to a separate append-only `Reservoir B`.

Reservoir B is distinct from Reservoir A:
- Reservoir A = undistributed Global Pool remainder already approved.
- Reservoir B = income/entitlement attributable to Company Balls.

For current scope Reservoir B is **inflow/accrual only** unless Product Owner separately approves an outflow rule. Do not automatically use Reservoir B to supplement K0/K1/K2, Global, Welfare, member payout, or Reservoir A.

Required properties:
- append-only
- source Award/Theory/settlement linked
- Qualification/Ball linked
- BinaryTreeId linked where applicable
- period linked
- RuleVersion/ParameterVersion linked
- idempotent/exactly-once
- replay-safe with signed deltas/adjustments as needed
- auditable
- no direct member PAYABLE/PAID event for Company Ball income

Preserve the original calculation/evidence chain so Admin can explain which company Ball generated the Reservoir B inflow and why.

### 6. Admin UX requirements
Add a Binary Tree Management workspace under Admin Organization operations:
- list/create multiple Binary Trees
- tree status/identity
- show canonical #1-#7 bootstrap diagram
- visually distinguish Company Balls from Member Balls
- show #1/#2/#3 as locked company bootstrap positions
- show #4-#7 as founding member placement positions
- show Sponsor evidence separately from Binary parent/side
- Company Ball detail shows `Always Active (Company Rule)` rather than member consumption progress
- show Reservoir B inflow summary/drill-down from Company Ball/settlement evidence
- prohibit destructive deletion/repositioning of canonical company bootstrap nodes after effective creation; use governed future workflows if later change is approved

### 7. Member UX
Normal members must not see company operational controls. If organization Viewer exposes upstream company nodes, render them clearly as `公司球` and do not show misleading monthly consumption/Active progress. Company-owned income/Reservoir B is Admin/governance information, not member payout.

### 8. Accounting/economic invariants
- Company Ball always-Active rule applies only to explicitly company-owned Qualifications.
- Member Active rules remain unchanged.
- Company Ball entitlement is calculated by the same authoritative Core rule path applicable to that position/event, then routed to Reservoir B instead of member payout.
- Do not skip company nodes before calculation if doing so would change downstream K/pool/economic evidence. Preserve theory/calculation evidence and apply the company-income routing deterministically.
- Reservoir A and Reservoir B must never be conflated.
- Multi-tree operation must not change Sponsor/Binary separation or cross-Ball isolation.

### 9. Required executable evidence
Add at minimum:
1. create Tree A -> exactly one #1/#2/#3 company bootstrap set;
2. retry Tree A creation -> no duplicates;
3. create Tree B -> independent #1/#2/#3 company bootstrap set;
4. Tree A and Tree B Binary volume/Carry isolation;
5. #2/#3 correct parent/side under #1;
6. #4/#5 parent #2 and #6/#7 parent #3;
7. founding #4-#7 Sponsor = Company while Binary parents remain #2/#3;
8. Sponsor traversal never substitutes Binary parent for Company Sponsor evidence;
9. company Ball Active without consumption and across month boundary;
10. member Ball still requires normal NT$2,000 threshold;
11. Company Ball award/entitlement routes exactly once to Reservoir B and creates no member payout;
12. Reservoir B retry/replay exactly-once;
13. Reservoir A and Reservoir B remain separate and reconcile independently;
14. historical replay preserves company Ball classification/Active/routing evidence;
15. unauthorized Member cannot access tree-management/Reservoir-B Admin operations;
16. canonical #1/#2/#3 cannot be destructively deleted/repositioned through normal Admin commands.

### 10. Phase-1 documentation impact
Update the planned Phase-1 deliverables (`UX_AUDIT.md`, `INFORMATION_ARCHITECTURE.md`, `COMPONENT_SPEC.md`, `PAGE_MAPPING.md`, `TERMINOLOGY_AUDIT.md`) to include multi-tree management, Company Ball visual semantics and Reservoir B. Also produce a concise `MULTI_TREE_COMPANY_BALL_SPEC.md` before implementation.

No Production promotion. Preserve all existing R1.0B economic invariants except for this explicitly approved Company Ball Active/routing extension.

---

Source: https://github.com/joewschang/UCell/issues/2#issuecomment-5721534662

## Product Owner addendum — Binary Tree Admin Settings + Founding-Ball Statistics

Extend the approved Multi Binary Tree / Company Ball / Reservoir B requirement with a full Admin management program and authoritative statistics for each founding member Ball.

### A. Binary Tree Settings backend/admin program
This must be a real Admin functional module backed by API/domain persistence, not only a visualization page.

Admin must be able to:
- list all Binary Trees;
- create a new Binary Tree through the governed atomic bootstrap command;
- view immutable BinaryTreeId, tree code/name, status, created/effective timestamps and governance/audit evidence;
- view canonical #1/#2/#3 Company Balls and #4-#7 founding placement layer;
- view current founding Ball assignments at #4/#5/#6/#7;
- inspect Sponsor identity separately from Binary parent/side;
- activate/deactivate future tree availability only through approved lifecycle commands without deleting historical topology;
- view tree-level counts/volume/Carry summaries;
- view Reservoir B generated by that tree and drill to Company Ball/source award evidence;
- search/filter/sort trees;
- access audit history for tree creation/configuration/status changes.

Canonical #1/#2/#3 topology cannot be edited/repositioned/deleted by normal CRUD. Do not expose unsafe generic edit/delete controls.

### B. Founding member Ball definition
For statistics, a `founding Ball` means the member Qualification/Ball occupying canonical founding positions #4/#5/#6/#7 of a specific BinaryTree. Statistics are always scoped by `BinaryTreeId + foundingQualificationId + asOf/period` and must not cross trees or Balls.

### C. Required statistics for EACH founding Ball (#4/#5/#6/#7)
Provide an Admin statistics table with at least these authoritative columns:

1. Binary Tree / Tree code
2. Founding position (#4/#5/#6/#7)
3. Qualification/Ball ID
4. Current holder / member display identity (authorized/masked as applicable)
5. Active/status
6. **二元樹下屬總球數** — cumulative total descendant Qualification/Ball count in that founding Ball's Binary subtree as of the selected as-of time; exclude the founding Ball itself unless UI explicitly shows a separate `含本人` value. Default definition = descendants only.
7. **當月新球數** — descendant Balls whose effective Binary placement/creation into this subtree occurred within the selected Asia/Taipei calendar month. Use authoritative effective placement time, not current holder transfer time.
8. **累積業績** — cumulative eligible Binary performance volume attributable to that founding Ball's Binary subtree through the selected as-of boundary, based on authoritative recognized/replayed volume facts. Do not use current-state reconstruction if historical evidence is required.
9. **當月業績** — eligible Binary performance volume attributable to the same subtree within the selected Asia/Taipei calendar month.
10. **左區 Carry** — authoritative current/replayed left Carry of the founding Qualification/Ball at the selected settlement/as-of boundary.
11. **右區 Carry** — authoritative current/replayed right Carry of the founding Qualification/Ball at the selected settlement/as-of boundary.
12. last authoritative update / settlement evidence timestamp.

### D. Statistical semantics
- `下屬總球數` and `當月新球數` are Binary subtree statistics, not Sponsor Tree statistics.
- Holder transfer does not create a new Ball and must not increment `當月新球數`.
- Qualification exit/company succession does not create a new Ball and must not increment counts.
- A Ball moved/repositioned is not allowed through normal immutable topology rules; if a future governed workflow ever permits future-only placement changes, historical statistics must follow effective-dated placement evidence.
- Company bootstrap Balls #1/#2/#3 are not counted as descendants of founding #4-#7 because they are ancestors.
- Descendant company-held Balls created by member exit remain the same Qualification and continue to count once; ownership transfer does not alter topology count.
- Statistics must be deterministic under replay and return adjustment.
- Volume statistics must use the approved concrete general/Binary performance basis (GPV/general-performance recognition under the effective RuleVersion), never abstract PV/BV client arithmetic.
- Carry is read from authoritative settlement/replay state; UI must not recompute Carry.

### E. Time filters
Admin statistics page must support at least:
- current month (default, Asia/Taipei)
- selectable calendar month
- as-of date/time for authorized advanced/audit view

Clearly distinguish:
- `累積` = through selected as-of boundary
- `當月` = selected calendar month only

### F. UX layout
Under Admin > 組織 > 二元樹管理:

1. **Tree List** — tree cards/table with status, member/ball count, current-month new Balls, cumulative/current-month volume, Reservoir B summary.
2. **Tree Detail** — canonical bootstrap diagram #1-#7 + configuration/evidence.
3. **Founding Ball Statistics** — primary comparison table for #4/#5/#6/#7 with the required columns.
4. **Founding Ball Drill-down** — click a founding Ball to open Ball 360 filtered to that Binary subtree; include descendant count, monthly new Balls, cumulative/month volume, L/R Carry, tree viewer and evidence.
5. Export authorized CSV for the same filtered statistics, with period/as-of/tree identifiers embedded in export metadata.

Use sticky first columns and grouped headers on desktop. On smaller screens use cards/controlled horizontal scroll rather than shrinking numeric columns unreadably.

### G. Suggested tree-level summary
At Tree Detail header show authoritative summary where available:
- total member/Qualification Balls in tree (define whether bootstrap company Balls are excluded; recommended member/operational count excludes #1/#2/#3 and display bootstrap count separately)
- current-month new member Balls
- cumulative performance volume
- current-month performance volume
- total Reservoir B inflow
- last settlement/update

### H. Backend/read-model requirement
Do not calculate these statistics by recursively downloading the whole tree into the browser. Implement server-side authoritative read models/queries/materialized projections as appropriate for scale.

Requirements:
- pagination for descendant detail;
- indexed BinaryTreeId/placement/period access paths;
- deterministic as-of semantics;
- replay/return updates must converge read models;
- read model can be rebuilt/reconciled from authoritative immutable facts;
- no cross-tree leakage;
- no cross-Qualification leakage;
- Admin RBAC enforced.

If current schema cannot efficiently support subtree aggregate queries, Phase-1 gap analysis must propose the appropriate closure-table/path/materialized aggregate strategy before implementation. Do not introduce a fragile recursive client calculation.

### I. Required executable evidence
Add at minimum:
1. Tree A founding #4 descendant total is correct for multiple depths;
2. #5/#6/#7 counts isolated from #4;
3. Tree B descendants never enter Tree A founding statistics;
4. current-month new Ball count uses placement effective time;
5. holder transfer does not increment new Ball count;
6. company succession after exit does not increment new Ball count;
7. cumulative volume matches authoritative subtree recognition facts;
8. monthly volume includes only selected month;
9. POSTED return/replay adjusts cumulative/month volume deterministically;
10. founding Ball L/R Carry equals authoritative replayed settlement Carry;
11. UI/API never recomputes Carry from raw child totals;
12. historical as-of query returns historical topology/volume rather than current-state fallback;
13. unauthorized role denied tree settings/statistics;
14. CSV export respects same filters/tree/as-of and authorization;
15. large-tree query is server-side/paginated and does not require browser full-tree load.

### J. Phase-1 documentation
Update `MULTI_TREE_COMPANY_BALL_SPEC.md` and Experience v2 Phase-1 docs to include this Admin settings module and exact statistic definitions. Add a dedicated `BINARY_TREE_ADMIN_AND_STATISTICS_SPEC.md` describing commands, read models, API contracts, table definitions, period/as-of semantics, RBAC and scalability strategy.

No Production promotion. Preserve R1.0B Core monetary authority and Sponsor/Binary separation.

---

Source: https://github.com/joewschang/UCell/issues/2#issuecomment-5721571611

## SA architecture addendum — Tree Operations, Placement, Reservoir Center and analytics

Incorporate the following into Phase-1 specification. These refine the already approved Multi-Tree/Admin-statistics requirements; do not treat them as permission to change R1.0B compensation formulas.

### 1. Tree-level Operations Dashboard
Each Binary Tree detail must provide authoritative tree-level summary plus the #4-#7 founding-Ball comparison. Where authoritative read models exist, include:
- operational/member Ball count (display #1-#3 bootstrap Company Ball count separately);
- selected-month new Balls;
- selected-month Active member Balls and Active rate;
- cumulative performance volume;
- selected-month performance volume;
- current/selected weekly Pair PV aggregate for operational analysis;
- Carry summary for operational analysis, while preserving per-Qualification authoritative Carry as the source of truth;
- Reservoir B selected-period inflow and cumulative balance;
- last authoritative settlement/read-model update.
Do not fabricate metrics if the backend does not yet support them.

### 2. Founding-Ball left/right breakdown
In addition to the Product Owner required fields, propose authoritative optional columns/drill-down for each founding Ball #4-#7:
- left descendant Ball count;
- right descendant Ball count;
- left selected-month new Balls;
- right selected-month new Balls;
- left selected-month performance volume;
- right selected-month performance volume;
- left Carry;
- right Carry;
- current/selected-week Pair PV;
- operational balance ratio derived from authoritative L/R values and clearly labelled analytics-only, never a bonus input.
The required core table remains readable; advanced columns may be shown through column configuration or drill-down.

### 3. Placement Console
Add Admin > 組織 > Placement Console as a governed operational workflow for placing an unplaced member Qualification into a Binary Tree.

Required inputs/evidence:
- target Qualification;
- Sponsor evidence displayed separately and not modified implicitly;
- BinaryTreeId;
- Binary parent Qualification;
- side LEFT/RIGHT;
- effective timestamp/rule evidence;
- idempotency key and actor/reason.

Preflight must fail closed on at least:
- parent missing;
- target slot occupied;
- cross-tree parent mismatch;
- cycle/self-parent;
- Qualification already effectively placed;
- invalid/company-bootstrap mutation;
- historical/effective-date conflict;
- authorization failure.

After effective placement, normal Admin UI must not support drag/drop reparenting. Any future placement-change workflow requires separate approved future-only semantics and historical evidence.

### 4. Founding Ball semantics
#4/#5/#6/#7 are `Founding Member Positions/Balls` only because of their canonical location. This label grants no special compensation, no Always-Active rule and no special member benefits.
- #1-#3: Company Balls, Always Active, company-income routing to Reservoir B.
- #4-#7: normal Member Qualifications once occupied, normal NT$2,000 Active rule and normal Member Award lifecycle.

### 5. Reservoir Center
Create Admin > 財務/治理 > Reservoir Center with separate A/B ledgers and reconciliation.

Reservoir A:
- source = approved Global undistributed remainder;
- accrual-only under current rules.

Reservoir B:
- source = final economic entitlement attributable to Company Balls;
- accrual-only under current rules.

Never merge A and B balances or source semantics.

Reservoir B list/drill-down should expose, subject to authorization:
- date/period;
- BinaryTreeId/tree code;
- Company Ball (#1/#2/#3 / QualificationId);
- award/entitlement type;
- source evidence/Award/Settlement reference;
- amount/delta;
- RuleVersion/ParameterVersion;
- replay/recovery linkage;
- running/period balance read model where supported.

Add an Explain Reservoir B view showing the authoritative calculation/evidence chain and the destination-routing decision. Do not recalculate money in the browser.

### 6. Company Ball income statistics
Tree Detail must include a Company Ball income table for #1/#2/#3:
- position;
- QualificationId;
- `Always Active (Company Rule)`;
- selected-period Reservoir B inflow attributable to that Ball;
- cumulative Reservoir B inflow attributable to that Ball;
- last settlement/update;
- drill-down to source evidence.

### 7. Tree identity and lifecycle
Each Binary Tree must have:
- immutable BinaryTreeId;
- stable unique business code (e.g. T001; actual allocation must be deterministic/unique and not reused);
- editable display name subject to audit;
- lifecycle status.

Phase-1 should specify minimal lifecycle:
- DRAFT: bootstrap exists, not accepting normal member placements;
- ACTIVE: accepts governed member placements;
- CLOSED_TO_NEW: existing topology/economics continue, no new normal placements;
- ARCHIVED: historical/read-only operational state; no destructive deletion.

Transitions require RBAC, actor/reason, effective timestamp and audit evidence. Existing monetary/topology history is never deleted by lifecycle transition.

### 8. Tree Analytics boundary
Prepare server-side read models for future Tree Analytics, but initial analytics must be deterministic/descriptive only. Potential operational indicators include growth, Active rate, L/R balance, performance trend, Carry concentration and retention/NASL when authoritative data exists.

Do not let analytics/AI alter placement, Active, Award, Carry or compensation. Future AI boundary is Observe -> Explain -> Alert/Recommend; Core remains authoritative.

### 9. Economic destination architecture
Phase-1 must evaluate introducing an explicit authoritative destination classification rather than scattered UI/backend `if company` logic. Candidate semantics:
- MEMBER_AWARD
- RESERVOIR_A
- RESERVOIR_B
- WELFARE_ACCRUAL
- RECOVERY/ADJUSTMENT

This is a design requirement for gap analysis, not authorization to refactor economic facts without migration/reconciliation proof. Company Ball entitlement must be calculated through the approved Core path before deterministic routing to Reservoir B.

### 10. Economic reconciliation UX/read model
Specify an Admin reconciliation view capable of explaining period economic destinations using authoritative facts. At minimum distinguish Member Awards, Reservoir A, Reservoir B, Welfare accrual and Recovery/Adjustment. Any conservation equation must follow the actual approved pool/economic semantics; do not invent a universal equation if sources/bases differ. Difference/integrity alerts are detection only and must never auto-fix monetary facts.

### 11. Additional executable evidence
Add to the planned test matrix:
- Placement preflight rejects occupied/cross-tree/cycle/already-placed/bootstrap mutation;
- effective placement is idempotent and leaves Sponsor unchanged;
- #4-#7 founding label does not change Active/bonus semantics;
- Company Ball income drill-down reconciles to Reservoir B source facts;
- Tree lifecycle blocks new placement in CLOSED_TO_NEW/ARCHIVED while preserving existing calculations/history;
- Tree code uniqueness/non-reuse;
- Reservoir Center RBAC and A/B isolation;
- analytics/balance ratio is not consumed by Bonus Engine;
- no browser-side recomputation of official Carry/Award/Reservoir amounts.

Update `MULTI_TREE_COMPANY_BALL_SPEC.md` and `BINARY_TREE_ADMIN_AND_STATISTICS_SPEC.md` accordingly. Phase 1 must remain specification/gap-analysis first; do not begin schema migration or Core routing changes until these specs are reviewed.
