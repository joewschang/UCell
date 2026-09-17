# Experience v2 component specification

Phase 1 only. Extend existing `shared/design-system` and Member/Admin components; do not create a competing design system. Production source is unchanged. Components consume authoritative contracts from [API proposal](API_V2_PROPOSAL.md).

## 1. Tokens and layout

Proposed semantic tokens: navy #102B46 for brand/header, emerald #087F5B for primary action, gold #A66B00 for rank/final money emphasis; surface #FFFFFF, canvas #F4F7FA, text #142B3F, secondary #526477, border #D3DCE5. Validate contrast for actual foreground/background pairs before shipping; these are candidates, not a blanket accessibility claim. Green completed/active/healthy/paid; amber pending/waiting/settlement; red blocked/failed/recovery; blue processing/calculated; gray inactive/archived. Always pair status color with text/icon.

Type scale 12/14/16/20/24/32px, body 16 on Member, 14–16 Admin; tabular numerals for comparable values; preserve unit/currency. Spacing 4/8/12/16/24/32/48px; radii 8/12/16px; restrained elevation for overlays only; icons 16/20/24px. Touch targets >=44px; persistent focus ring visible on every background. Member content single column <768px; Admin sidebar collapses below 1024px, tables scroll within labelled regions rather than the whole page.

## 2. Shared state model

`MetricFact<T>` = value nullable + unit/currency + availability AVAILABLE/PENDING/UNAVAILABLE/STALE + reason + basisVersion + context + watermark + evidenceRefs. Rendering formats an authoritative value; it does not derive entitlement, Carry or reservoir balance. Zero is a valid AVAILABLE value; null is never displayed as zero. PENDING means not finalized; UNAVAILABLE means source/permission/history is absent; STALE means an explicitly older projection. These cannot be merged into a generic dash without explanation.

Common read state: skeleton with aria-busy; empty only after complete successful scope; partial source banner; error with safe retry; 401 clear session values and offer login; 403 deny without leaking cached facts; 409 retain nonsecret intent and refresh evidence; 422 field-specific messages; 503 unavailable with last known watermark only if authorized. No command auto-retries with a new idempotency key.

## 3. Component contracts

| Component | Inputs / render contract | Interaction / acceptance |
|---|---|---|
| MemberAppShell / MemberBottomNav | five destinations, selected route, session state | safe-area bottom spacing, keyboard links, no obscured content |
| AdminDomainNav | role-filtered IA groups and route compatibility | collapse/expand labelled; no unauthorized entries; direct route still server checked |
| GlobalBallContext | authorized options `{id,code,plan,rank,ownerType,activeFact}`, selectedId, switching/error | server confirmation before render; abort/sequence protection; announce new Ball; never choose by display name |
| PersonSummary / BallPortfolio | Person identity/status separately from paginated Ball cards | masks contact/LINE; no Person-wide Active aggregate masquerading as Ball Active |
| BallIdentityHeader | Qualification ID, holderAsOf/current holder labels, plan/rank, tree/code/position, ownership | Company badge explicit; Sponsor and Binary parent separate; missing context blocks dependent facts |
| ActiveCard | MEMBER: server progress/remaining/activeFrom/activeTo/threshold evidence; COMPANY: rule evidence | Company never renders NT$2,000 progress; normal member progress accessible text, threshold transaction and month labelled |
| ConcreteVolumeSummary | GPV/RPV/EPV facts only, scope, updatedAt | business labels first, class metadata in Explain; no five equal PV/BV/GPV/RPV/EPV fields |
| MoneyState / NextPayoutCard | amount fact, lifecycle, settlement/nominal/adjusted dates/calendar | finalized authoritative aggregate only; otherwise 結算中/未提供; no browser summing Award cards to forecast |
| AwardJourney | source, type, Theory/final/payable separately, status sequence, dates, recovery refs | selected stage announces meaning; raw enum PENDING_45D maps to fixed payout-batch explanation, not +45-day math |
| BinaryWeeklySummary | settlement context, authoritative L/R, Pair, Carry, weekly cap, reference cap, next close | monthly x4 cap clearly reference-only and preferably supplied by backend; no independent pairing or Carry calculator |
| SponsorNode / BinaryNode | independent typed source; Binary side and tree membership required | distinct icons/layout; upstream company badge; no company income on Member |
| BoundedTreeViewer | paginated slice + hasChildren/cursor/context | load on expansion, node budget <=100, keyboard table alternative, no full-tree download/recursion |
| BootstrapDiagram | seven canonical position facts, occupancy, locked flag | #1–#3 locked/company; #4–#7 empty/occupied; no fake person names; click real Ball or authorized Place |
| FoundingStatsTable | exactly four position rows, metric wrappers and shared context | sticky first columns, grouped L/R optional columns, source-aware sorting, no client totals from pages |
| CompanyIncomeTable | #1–#3 company facts/B effects plus other company-held link | finance capability required; no payable status for B |
| TreeLifecycleBadge / TransitionReview | lifecycle facts, allowedActions, version, reason, preflight | confirm concrete transition/impact; no delete/reparent; preserve monetary obligations |
| PlacementReview | Ball, tree,parent,side, Sponsor evidence, preflight checks, actor/reason, version/key | evidence-only Sponsor; all failed checks visible; occupied-slot race returns actionable conflict; receipt keeps scope |
| ReservoirTabs / ReservoirEffectTable | separately scoped A or B facts, signed amount/type/source/period | tabs never merge balances; B replay negative correction distinguished from outflow; authorized export only |
| ExplainThis | subject kind/id, exact context token, typed evidence steps and availability | accessible drawer, business summary first, source links second; no client monetary computation or arbitrary HTML |
| SettlementPipeline | stage facts/counts/amounts/availability and evidence | source-specific stages, B destination after final entitlement, incomplete stages PENDING |
| ReturnImpactSummary | authoritative posted amount/quantity, historical Active/EPV changes, Award deltas/recovery | before POSTED no official impact; original PAID linked unchanged; explain missing/replaying state |
| ReleaseGateCard | environment, gate status/blocker, owner/action/evidence, evidence classification | LOCAL_ASSISTIVE_ONLY distinct from formal UAT; cannot turn missing gate green |
| EconomicReconciliation | basis/currency/period, source-specific expected/actual/difference | detect-only alert; NOT_APPLICABLE for unsupported aggregate equations; no auto-fix CTA |
| EvidenceTimeline | ordered effective/recorded events, paginated, source refs | no inferred missing events; filter effective vs recorded explicitly; link original/reversal/replay |
| ExportControl | authorized contextToken and exact filters, job status | private job/download, same displayed definitions, no browser export from incomplete page rows |

## 4. Explainability content contract

Initial kinds: Active, GPV, RPV, EPV, Binary Pair/Carry, Referral, Referral Matching, Binary Award, Binary Matching, settlement/payout dates, recovery/clawback, Reservoir B. Each explanation says what happened, which Ball/period, which authoritative rule/calendar/source was used, and why status or amount is pending/unavailable. Evidence drawer expands source recognition, historical eligibility, Theory, applicable K/pool, final entitlement, destination, lifecycle and adjustments. Do not display irrelevant K0/K1/K2 fields as if every award used all three.

If the user follows a source link requiring a higher privilege, show denial without preloading secret data. Closing a drawer restores focus to its trigger. Changes of Ball/tree/time close or reload the drawer under new context; old money cannot persist inside an overlay.

## 5. Command review and concurrency

Preflight result is an expiring observation. Review includes immutable IDs, human names, side, reason, effective policy and explicit effects; read-only Sponsor evidence sits beside Binary input to make the distinction visible. Submit disables duplicate local clicks but correctness belongs to server receipts/uniqueness. Recover lost response using same key, show original receipt when replayed. On payload changes generate a new key only after the user reviews the new intent. State changes, expired preflight or occupation races require refresh/review; do not silently place elsewhere.

Tree close/archive and placement must revalidate the same tree version. Actions are hidden/disabled by policy with human reason, but never considered safe solely by UI. Lifecycle archive cannot erase balances or historical evidence.

## 6. Component acceptance matrix

C01 every MetricFact renders AVAILABLE zero, nonzero, null/PENDING, unavailable and stale distinctly. C02 malicious/mismatched Ball/tree response is withheld. C03 switch A->B->A with delayed network, open drawer, open order and period filter; no cross-Ball leakage. C04 Company ActiveCard contains badge/evidence and no consumption progress. C05 Sponsor/Binary source test prevents substitute edges. C06 primary actions usable by keyboard/touch; tab/dialog focus restored. C07 TreeViewer request count/size bounded at 10K/100K/1M fixture topology, no browser recursive aggregate. C08 empty #4–#7 not counted as Balls. C09 finance fields absent for MO/Member roles. C10 Explain snapshots match source facts without arithmetic. C11 Return posted/replay/paid history preserved. C12 viewport/zoom captures and contrast checks. C13 command duplicate/conflict/lost response. C14 no component or analytics value imported by Bonus Engine. These are next-phase tests; Phase 1 existing regression evidence is separate.

## AI / BI component contracts

AnalyticsScopeBar exposes metric/version, grain, tree, period/asOf, company treatment and finality. QueryPlanPreview requires explicit resolution of ambiguous broad financial queries. MetricChart consumes exact typed decimals and completeness; no model-generated chart values. EvidenceAnswer separates structured facts from approved knowledge, renders authoritative timestamps/citations/deep links, and handles AUTHORITATIVE/KNOWLEDGE/PARTIAL/UNAVAILABLE/DENIED/AMBIGUOUS/STALE/TIMEOUT. MemberAIHelp and AdminCopilot use server scope; context change cancels old requests and screen readers announce new Ball/state. KnowledgeCitation displays title/version/effective date/section. Audit diagnostics show correlation ID, never secrets or raw private payloads. Keyboard focus returns to the invoking Why button on drawer close; live announcements do not repeatedly read financial values. Acceptance: role-denied fields absent from DOM and provider projection; stale response never appears after Ball switch; unavailable monetary data is not shown as zero. See [AI Core](AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC.md).
