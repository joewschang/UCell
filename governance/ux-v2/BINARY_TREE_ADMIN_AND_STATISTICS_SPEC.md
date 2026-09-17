# Binary Tree Admin and statistics

Status: PHASE_1_SPECIFICATION. All new commands/projections are proposals. See [domain](MULTI_TREE_COMPANY_BALL_SPEC.md), [API](API_V2_PROPOSAL.md), [migration](MIGRATION_43_PLUS_PROPOSAL.md). No browser full-tree recursion or money calculation.

## 1. Workspace and permissions

Admin > 組織 > 二元樹管理 contains Tree List, Tree Detail, Settings, Bootstrap Viewer, Founding Statistics, Placement Console, Binary Viewer, Tree Analytics. Finance > Reservoir Center links A and B separately; permission to see tree structure does not grant company income access.

Proposed capability mapping: SUPER_ADMIN has tree:create/configure/transition and placement:override; MEMBERSHIP_OPS has tree:read, stats:read and existing placement override where assigned; COMPLIANCE_AUDIT has read/evidence/export only; FINANCE has financial/tree summary and Reservoir A/B/reconciliation read without placement or PII edit. Customer Service and Members have no admin tree access. Enforce individual capabilities in API; deny missing policy. Do not silently broaden `/qualifications` or `/people` access for FINANCE—return a masked financial Ball view. Existing permissions are at `admin/src/features/auth/permissions.ts` and backend role guards.

## 2. Page contracts and wireframe order

Tree List: title/create action; search code/name, status and month filters; table; cursor footer. Required columns: TreeCode, TreeName, Status, operational Total Balls, Monthly New Balls, Cumulative Performance, Monthly Performance, Reservoir B (permission gated), Last Updated. Bootstrap count is a separate `3 company bootstrap Balls` metric, never mixed into member-count labels. Sort allowlist: code, name, status, operationalCount, monthGpv, updatedAt; all sort cursors include ID tie-breaker and snapshot. Search cannot silently filter only an already paginated subset.

Tree Detail: breadcrumb + immutable ID/code/name/status; month/as-of/revision controls; status/lag banner; tree-level cards; locked #1–#7 canonical diagram; founding comparison; company income table; links to viewer, placement, analytics, settings and evidence. All panels share one returned contextToken; inconsistent panel versions are withheld until refreshed together.

Settings: editable name, lifecycle action with expected version, reason and preflight result. Identity, company ownership, canonical topology and existing placements are read-only. No generic delete, drag/drop/reparent or arbitrary owner selector.

Founding table: sticky Tree/position/Ball columns; Holder, Active, descendants, selected-month new, cumulative GPV, month GPV, Left Carry, Right Carry, updatedAt. Optional grouped L/R columns appear via column chooser, not squeezed into mobile. An available slot has `AVAILABLE`, absent Qualification/Holder/Active/Carry and an authorized Place CTA. Do not render zero counts as if an unoccupied Ball existed. On mobile use four cards with labelled values and controlled table scroll for comparison.

Company table: #1/#2/#3, Qualification ID, Always Active (Company Rule), selected-period B net accrual, cumulative B net accrual, last settlement, evidence. Also allow separate drill-down of other company-held member-origin Balls; their income cannot disappear merely because the bootstrap table has only three rows.

## 3. Context, time and evidence

Canonical scope = BinaryTreeId + foundingQualificationId (if selected) + calendarMonth + asOf + knowledgeCutoff + projectionGeneration. Store all instants as UTC, display Asia/Taipei offset; month windows are local `[first day 00:00, next month first day 00:00)`. At exactly month start a placement is new in that month. Restrict an explicit month/asOf combination to asOf >= monthStart; partial current month ends at min(monthEnd,asOf). `asOf` is exclusive for event accumulation, while interval state uses `effectiveFrom <= t < effectiveTo` at t; the UI explains the boundary, and event-at-t fixtures distinguish them.

Two historical questions are distinct: effective-through time (`asOf`) and facts known at a recorded-time cutoff (`knowledgeCutoff`). Default knowledgeCutoff is the response snapshot capture time; return it explicitly. Thus a September report run after an October POSTED return can reflect the September correction, while an audit query known-at September excludes it. Never treat projection.updatedAt as recognition/effective time. For original-event-month performance, corrections retain the original recognition month; recordedAt controls when the correction becomes visible.

Common metric wrapper: value (decimal string/count or null), unit, status AVAILABLE/PENDING/UNAVAILABLE/STALE, reason, basisVersion, sourceWatermark, computedAt, evidenceRefs. Zero is returned only when a complete authoritative scope proves zero; missing history is not zero. An as-of query lacking historical ownership, topology or recognition evidence returns `HISTORICAL_EVIDENCE_MISSING`, not today's graph. Current Holder and holderAsOf are separately labelled; historical screens default holderAsOf.

## 4. Metric dictionary

Let F be the occupied founding Qualification, D(F,t) its effective Binary descendants excluding F, and L/R partitions determined by the first edge below F. Count distinct Qualification IDs, never Persons or Sponsor edges. Preserve the same Ball when transferred or company-held after exit.

| Metric | Authoritative definition / source |
|---|---|
| descendantTotal | Count D(F,t); all depths, both sides; bootstrap ancestors excluded |
| monthlyNew | Descendants whose first effective Binary placement falls within the selected month intersection; holder transfer, exit and replay execution time do not increment |
| left/rightTotal | Count corresponding L/R partition; sum equals descendantTotal |
| left/rightMonthlyNew | Same placement-time definition and side partition; sum equals monthlyNew |
| cumulativePerformance | Net eligible GPV/general-performance recognition attributable through historical Binary paths to D(F,t), effective before asOf and visible at knowledgeCutoff; count original source event once, apply linked POSTED/replay deltas once |
| monthPerformance | Same basis, restricted to original recognition month; not posting month of return |
| left/rightMonthPerformance | Historical first edge under F assigns side; never Sponsor attribution |
| Carry L/R | Latest finalized applicable Binary settlement at/before asOf, corrected by authoritative replay version visible at knowledgeCutoff; include settlement ID/period and replay ID |
| current/selected week Pair PV | Authoritative weekly settlement paired amount; partial/unfinalized week is PENDING unless an explicit nonofficial operational field exists |
| balanceRatio | Proposed descriptive min(leftMonthGpv,rightMonthGpv)/max(...), returned by analytics server; if both zero or negative corrected basis, null with NO_COMPARABLE_VOLUME; metricVersion required |
| operationalBallCount | All placed Qualifications except the tree's three bootstrap Balls; includes exited company-held descendants once; not equal to current MEMBER owner count |
| memberBallCount / activeMemberCount | MEMBER-owned placed Balls at the chosen instant / subset with authoritative Active then; exclude company owners and bootstrap from denominator |
| activeRate | activeMemberCount/memberBallCount; null for zero denominator. Label `as of` Active rate within selected month; do not imply ever-active-in-month |
| tree GPV | Distinct source recognition fact within tree + corrections once; never sum every ancestor's propagated Binary ledger rows |
| tree Pair / Carry summary | Sum selected authoritative per-Qualification settlement values only when all rows share settlement context; operational analytics, never a new payable budget |
| B period / cumulative | Signed linked Reservoir B effects, original economic period for period view, through asOf/knowledgeCutoff; separate original accrual and replay adjustments |

Performance for founding statistics excludes F's own recognition, matching descendant scope. A separate selfPerformance field may be supplied and clearly labelled; no silent inclusion. Tree-level GPV includes eligible sources anywhere in that tree once, including founding Balls themselves. Consequently the sum of the four descendant-only founding totals need not equal tree GPV; reconcile with self GPV and any other in-scope sources. Propagation rows for one source across multiple ancestors are not independent sales.

Example acceptance fixture: #4 has LEFT child A and RIGHT child B, A has child C; #5 has D. #4 totals=3, L=2/R=1; #5 total=1; #6/#7 empty or isolated as appropriate. Place C at 2026-10-01T00:00+08:00: September new excludes C, October includes C. Transfer A or exit B: counts unchanged. Return on C recorded in November replays its October GPV; latest-known October changes, known-at-October remains original. Carry values must exactly equal returned settlement/replay values, regardless of displayed child totals.

## 5. PlaceQualification command

Inputs: qualificationId, binaryTreeId, binaryParentQualificationId, side LEFT/RIGHT, effectiveAt, idempotencyKey, actor (server-authenticated), reason; add expectedTreeVersion and preflightToken. Sponsor evidence is displayed but not an editable input.

Preflight checks: authorized capability and scope; target/parent existence; ACTIVE tree; parent effective in same tree; target unplaced; no self/cycle; free slot; not locked bootstrap mutation; effective date has no historical conflict; Sponsor confirmation and all existing applicable placement policies; founding target uses designated Company Sponsor evidence. For first release support commit-time effectiveAt only (server normalizes `now` and returns actual time); arbitrary backdating/scheduling returns EFFECTIVE_TIME_UNSUPPORTED. This is a constrained implementation proposal, not permission for historical edits.

Transaction: lock tree revision, target, parent+side in stable order; revalidate every preflight condition; claim semantic idempotency record; insert TreeMembership/placement/occupation/evidence; update setup status; audit/outbox; commit. Database constraints are the final slot and uniqueness guard. Preflight neither reserves a slot nor promises later success. Existing Sponsor bytes/IDs must be identical before and after. On conflict retain user input, refresh available slots, require new confirmation with a new key only when payload changes. Lost-response retry uses the same key. No automatic new-position selection.

Preserve current sponsor-owner placement, 72-hour SLA, overdue monitor/escalation and governed system assignment as separate entry paths; all ultimately need the same tree-aware invariant service. Do not replace them with unrestricted Admin placement. Normal placement does not edit Company bootstrap topology.

## 6. Read-model architecture decision

| Strategy | Write/read cost | Historical / subtree fit | Recommendation |
|---|---|---|---|
| Adjacency list | O(1) edge insertion; subtree read O(n_subtree) | Natural authoritative effective edges; recursive validation needed | Keep as command truth |
| Recursive CTE | No duplicate storage; visits matching graph | Good reference/rebuild/audit; large deep queries need cycle and resource bounds | Server-side bounded fallback/jobs; not interactive whole-tree endpoint |
| Closure table | O(depth) rows per insert; subtree lookup indexed | Explicit ancestor/descendant/depth/time supports proofs; worst skew O(N^2) total | Materialized closure for reviewed scale envelope, not unconditional at 1M |
| Materialized path | O(depth) path bytes; prefix-index subtree reads | Topology immutable helps; path versioning needed if future changes; deep paths grow | Candidate large/skewed-tree projection; not monetary authority |
| Period aggregates | O(affected ancestors) per event; O(1) aggregate read | Rebuild from immutable originals+deltas; recorded/effective versions needed | Required for dashboard/founding metrics |
| Materialized projection | Async bounded event work; fast indexed reads | Explicit watermark, idempotency and rebuild generation | Recommended query boundary |

Recommend authoritative effective-dated adjacency + tree membership; indexed versioned ancestry projection; dedicated tree/founding period aggregates; immutable settlement reads for Carry. Logical ancestry contract always exposes BinaryTreeId, ancestorId, descendantId, depth, firstSide, effectiveFrom, effectiveTo, sourceEvidenceId. A physical closure stores these directly for moderate depths. At 1M+ or pathological depth, do not synchronously materialize every ancestor pair: use partitioned paths/adjacency and bounded ancestry jobs with the same logical contract; precompute only tree/founding summary scopes and demand-cache other ancestors. This is an engineering scale gate, not a new business depth limit or dropped entitlement.

10K target: closure and aggregates are a practical starting candidate; 100K balanced depth ~17 yields order N*depth closure rows; 1M balanced depth ~20 yields tens of millions, while a chain approaches N(N+1)/2. Node count alone cannot approve an architecture. Load fixtures must include balanced, skewed and hot-root concurrent insert shapes. Benchmark goals (proposals, not measured): page 50 descendants / list P95 <=500 ms warm; aggregate 4 founding rows <=1 s; no browser request over 100 nodes; command commits independent of full-tree scans. If budgets fail, ship asynchronous export/projection status, not truncated totals.

Indexes: adjacency `(treeId,parentId,side,effectiveFrom)` and unique current child; ancestry `(treeId,ancestorId,depth,descendantId,effectiveFrom)` plus reverse descendant; interval overlap constraints; aggregate `(treeId,ancestorId,month,basisVersion,generation)`; recognition `(treeId,occurredAt,eventId)` association; effects `(treeId,periodEnd,qualificationId,effectId)`. Validate with EXPLAIN on representative data. Cursor keyset includes immutable ID and fixed snapshot, not offset over changing rows.

Historical ancestry interval is the intersection of every path edge interval. Current immutable placement makes it stable but does not justify removing interval evidence. Self closure has depth 0 and is excluded by default; firstSide is null for self. Cycle/cross-tree/overlap corruption quarantines affected projection and blocks official historical views.

Projection consumer: claim outbox event; unique `(consumer,eventId,projectionGeneration)` dedup; update impacted tree/founding/ancestor aggregates and checkpoint atomically. Replay marks dirty economic periods, uses original graph/owner context, and publishes a new generation only when all linked corrections converge. Events arriving out of order require source sequence/checkpoint reconciliation; never advance watermark past missing events. Return period attribution follows original recognition, not replay run month.

Rebuild: immutable input watermark -> isolated generation -> replay facts/deltas deterministically -> reconcile distinct source counts, ancestry membership, month GPV, A/B and Carry references -> atomic generation switch. Incomplete generation is unavailable; old generation may be shown STALE only with its actual watermark and never used for command validation. No full table refresh within an HTTP request.

Technical references: PostgreSQL documents [recursive traversal/cycle handling](https://www.postgresql.org/docs/16/queries-with.html), [range exclusion constraints](https://www.postgresql.org/docs/16/rangetypes.html), and [materialized view freshness](https://www.postgresql.org/docs/16/rules-materializedviews.html). These support mechanisms; the above scale recommendations are project design judgments, not measured database guarantees.

## 7. Analytics and export

Growth is first-placement counts/time; performance trend is GPV basis-version series; L/R balance uses the defined ratio; Carry concentration references per-Ball settlement data; retention/NASL stays UNAVAILABLE until an authoritative cohort/definition is approved. No synthetic GMV/NASL from visible table rows. AI may Observe, Explain, Alert, Recommend and link evidence. It has no placement, Active, Carry, Award or rule write authority.

CSV export uses the same authorized filters/contextToken/watermark as the table, with tree IDs, founding scope, timezone, month/asOf/knowledgeCutoff, metric basis, units and generatedAt in metadata. Server-side paginated job, private expiring download, reauthorize at download, mask PII, escape spreadsheet formula-leading cells, audit actor/filter/result hash. No Member-accessible Reservoir B export. Rows unavailable in UI remain unavailable in export, not blank-as-zero.

## 8. Acceptance matrix

ST01 multidepth #4 with isolated #5/#6/#7 and Tree B; ST02 exact Taipei month boundaries and first effective placement; ST03 transfer/exit no new count; ST04 authoritative GPV source dedup and own-vs-descendant distinction; ST05 POSTED return/replay convergence; ST06 Carry equality with finalized/replayed source; ST07 effective-time and known-time historical query with missing-evidence denial; ST08 RBAC and CSV filter equivalence; ST09 pagination under concurrent inserts with pinned snapshot; ST10 large/skewed server-side queries without browser recursion; ST11 occupied/cycle/self/cross-tree/already-placed/bootstrap/history rejection; ST12 idempotent command and unchanged Sponsor; ST13 DRAFT/CLOSED/ARCHIVED placement denied while required calculations/history survive; ST14 unique non-reused codes; ST15 A/B source reconciliation and no double count of propagated GPV; ST16 analytics unavailable/zero denominators and no Bonus Engine dependencies. Implement these after review; Phase 1 records contracts only.
