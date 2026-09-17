# Architecture / Code / Schema gap audit

Baseline: remote `integration/member-backend-mvp` at `903b8e96b9419e4dad2625777b7ec8ff1053c433`. Scope: Phase 1 specification closure for Issue #2, not implementation. Audit performed in isolated checkout to exclude the primary checkout's uncommitted analytics/provider/schema changes and its local checkpoint `950e45a`.

## 1. Evidence and source coverage

Read Issue #2 body and all three PO/SA comments (IDs 5721413725, 5721534662, 5721571611); preserved in [snapshot](evidence/ISSUE_2_SNAPSHOT.md). Reviewed SA decision register recordVersion 3, Core Addendum v2, Boundary Decisions and Volume Clarification. Inventory covers all tracked files under backend/member/admin/shared, `governance/sa-decisions`, and all tracked Markdown documents, including historical reports, traceability and verification artifacts; these older reports describe their own historical baseline, not current implementation status. [Source hashes](evidence/source-manifest.json) cover 947 files; [migration inventory](evidence/migration-inventory.json) covers all 50 SQL files; [OpenAPI](evidence/openapi-inventory.json) covers 136 operations; [terminology scan](evidence/terminology-hits.json) records 660 matching source lines. Automated inventory is evidence of scan coverage, not a claim that every historical log assertion was rerun.

The first 42 migrations remain intact; 43–50 are already-existing UAT/provider changes. No new migration is created or executed by this task. See [proposal](MIGRATION_43_PLUS_PROPOSAL.md) for numbering reconciliation. Existing tests and Golden data are a regression baseline, not authority to weaken approved rules.

Source anchors below use repository-relative paths and symbols so they survive line-number shifts. Full Member route source `member/src/App.tsx`; Admin route/nav `admin/src/app/{App.tsx,nav.ts}`; source-level page mapping in [PAGE_MAPPING](PAGE_MAPPING.md). Prisma schema is `backend/packages/database/prisma/schema.prisma` (Qualification at line 717, HolderHistory 956, SponsorRelationship 975, BinaryPlacement 993, ReservoirLedgerEffect 2629 at audited HEAD).

## 2. Requirement classifications

Labels are cumulative where useful: ALREADY_SUPPORTED means the cited capability exists, not that all v2 acceptance tests pass. PARTIALLY_SUPPORTED requires extension. READ_MODEL_REQUIRED/API_REQUIRED/SCHEMA_REQUIRED/MIGRATION_REQUIRED identify implementation layers; UX_ONLY means no economic/schema change needed. TEST_REQUIRED is future acceptance work. DEFERRED is explicitly outside scope. CONFLICT_REQUIRES_REVIEW records evidence of mismatch without changing Core. Every SCHEMA/MIGRATION item is a proposal only.

| ID / requirement | Classification | Existing evidence | Gap / recommended implementation / verification |
|---|---|---|---|
| G01 Person != Ball, multiple Balls | ALREADY_SUPPORTED; UX_ONLY; TEST_REQUIRED | Qualification holder relation; Boundary package tests; `member/QualificationContext.tsx` | Person portfolio + paginated Balls and explicit Ball detail; no arbitrary max |
| G02 Global Ball Context | PARTIALLY_SUPPORTED; UX_ONLY; TEST_REQUIRED | Provider abort/sequence guard, server selection, keyed page subtree | Persist across five-tab shell; include actor/tree/period in cache and validate returned IDs; rapid A->B->A stale-response tests |
| G03 Member Home/Active progress | PARTIALLY_SUPPORTED; READ_MODEL_REQUIRED; API_REQUIRED | MemberReadService dashboard/active interval; current repurchase status | Explicit eligible-cash progress/remaining + authoritative next payout/weekly close; do not equate repurchase state with Active |
| G04 Performance/explain vocabulary | PARTIALLY_SUPPORTED; API_REQUIRED; CONFLICT_REQUIRES_REVIEW | MemberReadService.volumes loops PV/RPV/EPV; classification schema has GPV | v2 concrete GPV evidence adapter, verify source semantics before rename; no abstract PV sum |
| G05 Money Journey / payout | PARTIALLY_SUPPORTED; READ_MODEL_REQUIRED; UX_ONLY | BonusAward lifecycle, AwardPayoutAnchor; current Bonuses UI | Business-first summaries and source-specific explanation; pending/unfinalized amount stays null |
| G06 Shop/packages/orders | PARTIALLY_SUPPORTED; UX_ONLY; TEST_REQUIRED | ConnectedShop, QualificationPackageShop, package snapshots/placement setup | Image/card hierarchy, explicit package creates Ball, idempotent CTA, preserve consent/selection/refund workflows |
| G07 Admin command center | PARTIALLY_SUPPORTED; READ_MODEL_REQUIRED; UX_ONLY | AdminDashboardService versioned bounds and counts | No fabricated GMV/NASL; official monetary widgets await read models; source freshness visible |
| G08 Person 360 | PARTIALLY_SUPPORTED; API_REQUIRED; READ_MODEL_REQUIRED | PeoplePage embedded detail, holder history | Portfolio pagination, identity/contact masking, linked applications/orders/audit; explicit role sections |
| G09 Ball 360 | PARTIALLY_SUPPORTED; API_REQUIRED; READ_MODEL_REQUIRED | QualificationDetail tabs, operations read model | Tree/company owner, historical timeline, Return and source explanation, explicit period/context |
| G10 Settlement Cockpit | PARTIALLY_SUPPORTED; READ_MODEL_REQUIRED; API_REQUIRED | Bonus services, observability settlement/pool history | Pipeline stages/evidence, company routing and uncertainty; no new K/pool formulas |
| G11 Return Impact | PARTIALLY_SUPPORTED; READ_MODEL_REQUIRED; API_REQUIRED | AdminOperations.returnDetail; historical-replay/replay-pool-delta | Human summary of Active/EPV before-after, deltas/recovery from original snapshots; never simulate official impact client-side |
| G12 Release Control Tower | PARTIALLY_SUPPORTED; UX_ONLY; READ_MODEL_REQUIRED | UatPage/SystemPage and UatExecutionEvidence | Preserve assistive/formal evidence distinction; Production BLOCKED; no fabricated health |
| G13 Shared Explainability | READ_MODEL_REQUIRED; API_REQUIRED; UX_ONLY; TEST_REQUIRED | Raw JSON/evidence/hash views exist | Typed scope-bound evidence graph, business summary first, drawer and per-field availability |
| G14 Independent BinaryTree identity | SCHEMA_REQUIRED; MIGRATION_REQUIRED; API_REQUIRED | BinaryPlacement lacks tree ID; no BinaryTree model | Tree aggregate/membership association MT-B/C; legacy component backfill manifest |
| G15 Atomic #1/#2/#3 bootstrap | SCHEMA_REQUIRED; MIGRATION_REQUIRED; API_REQUIRED; TEST_REQUIRED | Existing placement transactions reusable, no bootstrap aggregate | Tree receipt+positions+three Qualifications atomic; D1/D2 gated |
| G16 #4–#7 available positions | SCHEMA_REQUIRED; MIGRATION_REQUIRED; UX_ONLY | No canonical position model | Persist slots not fake Qualification/Person rows; occupation fact at placement |
| G17 Company Principal / ownerType | SCHEMA_REQUIRED; MIGRATION_REQUIRED; CONFLICT_REQUIRES_REVIEW | Mandatory currentHolderPersonId and Person FK in Qualification/holder history | Explicit principal/owner intervals + read/auth compatibility; no fake company Persons |
| G18 Founding Company Sponsor | SCHEMA_REQUIRED; MIGRATION_REQUIRED; API_REQUIRED; CONFLICT_REQUIRES_REVIEW | SponsorRelationship qualification FK; first/third-left SQL/service guards | Company designation evidence separate from Binary parent; D2 economic ambiguity |
| G19 Company Always Active | PARTIALLY_SUPPORTED; SCHEMA_REQUIRED; MIGRATION_REQUIRED; CONFLICT_REQUIRES_REVIEW | ActiveService/BonusQuery use ActivePeriod; EXIT sets CLOSED/false | Historical company owner/type predicate across Core/replay only in reviewed next phase; normal NT$2,000 untouched |
| G20 Company entitlement -> B | SCHEMA_REQUIRED; MIGRATION_REQUIRED; API_REQUIRED; TEST_REQUIRED | Existing writers emit Award lifecycle; maturity/payable consumes Award | Typed final destination sidecar and B effects; all award paths and worker guards must cut over atomically |
| G21 Reservoir A isolation | ALREADY_SUPPORTED; READ_MODEL_REQUIRED; TEST_REQUIRED | ReservoirLedgerEffect sourceGlobalSettlementId; GlobalPoolPersistence A-only key; /reservoir-a | Preserve existing A proof, add separate center A panel; never repurpose A rows |
| G22 EconomicDestination/reconciliation | SCHEMA_REQUIRED; MIGRATION_REQUIRED; READ_MODEL_REQUIRED; API_REQUIRED | A/Welfare/recovery facts separate; no typed destination across paths | Minimal sidecar, typed sources, source-basis reconciliation; no universal sum equation |
| G23 Tree Admin/settings/lifecycle | SCHEMA_REQUIRED; MIGRATION_REQUIRED; API_REQUIRED; UX_ONLY | No tree CRUD/lifecycle; organization viewer only | Create/rename/transition commands; terminal read-only archive, no delete/reparent |
| G24 Founding counts/new Balls | READ_MODEL_REQUIRED; API_REQUIRED; SCHEMA_REQUIRED; MIGRATION_REQUIRED | placement effectiveFrom and historical edges, no tree ancestry/aggregate | Tree+ancestor temporal projection; counts exclude self, transfer/exit no new Ball |
| G25 GPV subtree statistics | READ_MODEL_REQUIRED; API_REQUIRED; TEST_REQUIRED | PvLedger GPV + BinaryVolumeLedger, sealed graph/replay | Distinct source IDs, original-month signed correction; exclude repeated ancestor propagation rows |
| G26 Carry / Pair statistics | PARTIALLY_SUPPORTED; READ_MODEL_REQUIRED; API_REQUIRED | BinaryCarry/ReplayCarryProjection and readBinarySettlement | Latest applicable authoritative replay revision and explicit period; no child-sum recomputation |
| G27 Server scale / pagination | PARTIALLY_SUPPORTED; READ_MODEL_REQUIRED; SCHEMA_REQUIRED; MIGRATION_REQUIRED | recursive SQL, fixed take limits; no ancestry aggregation | adjacency truth + temporal projection/period aggregates; depth/skew benchmark gates; keyset cursor |
| G28 Placement Console | PARTIALLY_SUPPORTED; API_REQUIRED; SCHEMA_REQUIRED; MIGRATION_REQUIRED | QualificationPlacementService locks/idempotency/audit/outbox, Sponsor untouched | same-tree/lifecycle/bootstrap/effective checks, new preflight and command; preserve 72h SLA |
| G29 Company/founding income tables | READ_MODEL_REQUIRED; API_REQUIRED; UX_ONLY; TEST_REQUIRED | No B effects or company classification | #1–#3 + other company-held drill-down; role-gated, Always Active, Source Evidence |
| G30 Analytics growth/Active/LR/Carry | READ_MODEL_REQUIRED; API_REQUIRED; UX_ONLY | current dashboard deliberately marks NASL unavailable | deterministic descriptive server metrics only; never Bonus Engine input |
| G31 Historical as-of | PARTIALLY_SUPPORTED; SCHEMA_REQUIRED; MIGRATION_REQUIRED; TEST_REQUIRED | effective edges, immutable replay envelopes, owner history | recorded-time projection revisions + explicit tree/owner evidence; no current-state fallback |
| G32 Terminology PV/BV/45D | PARTIALLY_SUPPORTED; UX_ONLY; TEST_REQUIRED | v3 classification and calendar; old labels/API schemas/docs remain | doc correction now, production/API impact next phase; see terminology audit |
| G33 Sponsor/Binary separation | ALREADY_SUPPORTED; TEST_REQUIRED | separate SponsorRelationship/BinaryPlacement, historical traversals | preserve independent viewer sources and business Sponsor principal/Qualification semantics |
| G34 Append-only economics/replay/outbox | ALREADY_SUPPORTED; PARTIALLY_SUPPORTED; TEST_REQUIRED | migrations triggers, historical-replay, replay-pool-delta, outbox-lease | reuse safeguards; add destination-aware idempotency and company snapshot version, not rewrite originals |
| G35 Future AI / retention NASL | DEFERRED; READ_MODEL_REQUIRED | no approved AI monetary calculator; unavailable NASL metric | Observe/Explain/Alert/Recommend only; no placement/Core mutation |
| G36 Inventory PICK/SHIP accounting, deploy | DEFERRED | Boundary deferral, release gates | Preserve existing operational shipment capability; no new accounting rules, Stage/Production work |

## 3. Core path audit and concrete impact

### Ownership / placement / organization

`qualification-workflow.service.ts` EXIT requires an existing company holder Person, writes holder history, sets lifecycle EXITED and Qualification CLOSED/activeFlag=false. It preserves graph identity, but it is not the new company-principal/Always Active domain. `qualification-placement.service.ts` has advisory locks, Sponsor confirmation, cycle/slot checks and atomic audit/outbox; input lacks treeId/effectiveAt. `organization.service.ts` uses current-edge CTEs for cycle/first-third-left validation. `system-assignment.service.ts` and setup schema are additional placement entry points: new checks must be centralized so an old path cannot bypass tree state/bootstrap restrictions.

BinaryPlacement has unique child and indexed parent/side/effectiveTo; inspect SQL guards as well as Prisma, rather than treating an index as uniqueness. Historical closure must preserve source intervals; no multi-tree support is inferred from unrelated disconnected roots. Sponsor current-holder joins are not historical recipient evidence.

### Recognition / Active / formulas

`packages/database/src/recognition-active.ts` has idempotent ConsumptionRecognition/VolumeRecognitionClassification/accumulator/Active evidence and outbox. Its `epvAfter` currently stores cumulative eligible amount, not the final EPV formula result; do not expose it as official EPV. `apps/worker/src/main.ts::processSaleConfirmed` passes `line.gpvAmountSnapshot` and default `UCELL_ACTIVE_THRESHOLD ?? '1200'`; this is not demonstrably the approved NT$2,000 eligible-consumption money basis. Treat as **existing CONFLICT_REQUIRES_REVIEW**, not a proposed new threshold. The correct v2 UX must await authoritative NT$2,000 money-basis evidence. This Phase changes neither configuration nor formula.

`gpv-immediate-effects.ts` captures historical Sponsor and Binary evidence, creates Theory and propagates Binary GPV. `bonus-query.service.ts::isActiveAt` / `ActiveService` use ActivePeriod and have no explicit company owner exception. `binary-bonus.service.ts` creates Theory, K1, Carry, Award and lifecycle; qualifications are selected across the existing settlement scope with no tree ID. `global-pool.service.ts` and persistence/calculation separate A remainder. Do not add tree filters to K/pool calculation merely to support tree analytics: that would change economics.

### Award / Ledger / replay / workers

Schema contains BonusAward, BonusAwardLifecycleEvent, BonusCalculationEvidence, PayableEntry, PayoutLine, BinaryCarry, EntitlementReplayPosting, ReplayAction, ReplayCarryProjection, HistoricalReplaySnapshot, ReservoirLedgerEffect and WelfarePoolEffect. Existing append-only SQL triggers and replay delta checks are retained. `historical-replay.ts` stores graph/Active/plan/status snapshots; new company owner/tree/destination evidence must be a new version, not edits to signed old snapshots. `replay-pool-delta.ts` handles A/Welfare deltas; B is absent. `bonus-maturity.ts` and worker consumers need destination filtering in the later phase, or a company Award could mature into member payout despite a UI badge. Review all writes, including RPV/EPV/Global and adjustment paths.

`outbox-lease.ts` supplies claim/lease/replay mechanisms, not a proof of B exactly-once. Require transactionally unique destination effects and projection receipts. No distinct repository abstraction should be invented in documentation: much current persistence lives directly in Prisma-backed services and shared database functions.

### Read models / OpenAPI / frontend

`MemberReadService` already authorizes holder inside a repeatable-read transaction and supports explicit finalized Binary settlement evidence. General Binary metrics without settlement remain unavailable. However its `volumes` loop uses legacy `PV`, not concrete `GPV`; it also reports current-state limited referral/order/award collections with limit/truncated, not general snapshot cursors. `QualificationDetail.tsx` rejects mismatched IDs and discloses limited history; its aggregate PV tab and current Active flag are not sufficient for v2 historical/company context. Admin Organization offers depth-limited server tree queries; this is a useful viewer foundation, not whole-subtree statistics at 1M.

`AdminDashboardService` calendar boundaries are versioned but current counts use activeFlag/status; do not call them historical Active rate. OpenAPI has v1 Reservoir A and scoped qualification operations; no BinaryTree/B destination or Person/Ball 360 aggregate contracts. Member/Admin permissions are page-oriented; new section/field-level views require server RBAC as specified in API proposal.

## 4. Migration 1–50 review map

| Ordinals | Relevant invariant / implications |
|---|---|
| 1–3 | Identity, membership, Sponsor/Binary, volume ledger, Active/RPV, Core Award/settlement; retain original identities and constraints |
| 4–6 | Return, EPV/Global, recovery/payout, workflow and plan history; never collapse company succession into new Ball |
| 7–12 | Carry replay, payable/recovery guards, auth/audit/golden and relation convergence; destination extension must cover every downstream consumer |
| 13–16 | First/third-left and immutable organization guards, payout approvals, attachments, admin access; new commands cannot bypass SQL policies |
| 17–20 | Parameter snapshots, historical replay, replay delta baseline and timezone; new graph version must preserve old sealed evidence |
| 21–25 | Notifications/read markers, zero Binary entitlement, replay horizon and return idempotency; reuse evidence semantics |
| 26–36 | Contracts/consent/network identity/OTP/referral/system assignment/content/formal application; preserve all Member/Admin capabilities in mapping |
| 37–40 | Qualification setup/placement, versioned packages/checkout, payment/inventory persistence; tree-aware guard additions across all acquisition paths |
| 41–42 | Concrete volume classes, shared accumulator/Active/Theory/calendar/A evidence; replay A/Welfare signed deltas; no duplicate GPV economic migration |
| 43–50 | Existing UAT/provider/invoice/shipment/verification/ingress constraints; unrelated to proposed multi-tree; preserve and do not reuse IDs |

The inventory includes exact migration file paths and SQL statement headers/hashes for audit. Review of later migrations is necessary because the requested older baseline no longer equals origin.

## 5. Closure / engineering order

Ready specification: seven core UX/spec documents + migration/API proposals + pending decisions. Next approved implementation should sequence design system/shell and evidence display, reviewed owner/tree domain, read projections, commands, then approved economic routing with Golden comparisons; none begins in this task. D1/D2 require PO resolution. Existing threshold/PV/read-model conflicts are implementation remediation against settled SSOT, not new policy discretion.

Regression evidence, failures and limitations are recorded in [VERIFICATION](VERIFICATION.md). Passing Golden suites does not erase source-audit conflicts or certify Production. Only documentation/evidence under this directory should be committed; original production source, Prisma, migrations and generated OpenAPI must be byte-identical to the audited commit.

## Baseline reconciliation: 924dadc (supersedes earlier absence claims)

Final audited source baseline is 924dadc9b162a68471ef971c8eec72e24430a554, with 52 existing migrations. Earlier 903b8e9 findings remain a dated audit trail; where they say Analytics/NASL/history is entirely absent, this section supersedes them. Upstream added management policy, immutable captures, NASL current/transitions, fixed cohort retention, history, bounded volume/Carry projections, Admin Analytics and provider lease/health work. None was implemented by this documentation change.

Reusable sources: backend/apps/api/src/modules/analytics/{analytics.controller.ts,analytics.history.ts,analytics.volume.ts}; governance/analytics/MANAGEMENT-POLICY.md. Management NASL is Person grain under UCELL-MGMT-2026-09-v1, not Ball financial Active. Current refresh is bounded and cannot reconstruct arbitrary historical asOf. History supports captured dates (max 366 days), sonar only 12 generations, volume history has explicit limits. Missing inputs fail unavailable; these are useful partial sources, not the requested unlimited multi-tree/founding/B or generalized Explain layer. New projection and webhook-lease migrations are upstream existing artifacts; Phase 1 adds none.

AI gaps: no UCell semantic registry, unified typed Explain family, provider-independent gateway, governed KnowledgeUnit catalog or simulator is claimed implemented. [AI-ready foundation](AI_READY_FOUNDATION_SPEC.md) maps readiness per contract and [AI Core](AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC.md) specifies access and evidence handling. These are architecture deliverables, not runtime completion.
