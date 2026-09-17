# Migration 43+ proposal — NOT executable

Phase 1 design only. Do not edit production Prisma, create migration directories, run migration, deploy, or change resources. Baseline 924dadc contains 52 existing migration SQL files; “43+” is the requested deliverable name, not the next migration number. See G3 in [pending decisions](PENDING_ARCHITECTURE_DECISIONS.md). [Inventory](evidence/migration-inventory.json) records existing statement/hash evidence.

## Existing schema and constraints

`backend/packages/database/prisma/schema.prisma`: Qualification.currentHolderPersonId and QualificationHolderHistory.holderPersonId are non-null Person foreign keys. SponsorRelationship has unique child and sponsor/sequence. BinaryPlacement has unique child plus parent/side index; migration 0013 supplies additional database guards. BinaryCarry is keyed Qualification/period/rule; replay has HistoricalReplaySnapshot, EntitlementReplayPosting, ReplayCarryProjection. BonusAward, GlobalPoolAward and RpvUplineAwardEvent are different entitlement sources. ReservoirLedgerEffect is Global/A-specific. No BinaryTree, CompanyPrincipal or B ledger models exist. Upstream management Analytics projection models now exist; see baseline reconciliation below.

Existing migrations 1–16 establish membership, organization, awards, replay, recovery, payout and guards. The timestamped migrations through ordinal 42 add parameter snapshots, historical replay, timezone, notification, consent/member identity, placement/packages, payment/inventory, v3 evidence and pool deltas. Ordinals 43–50 add UAT/provider/invoice/shipment/inbox foundations. Preserve all existing SQL byte-for-byte. Before later implementation, inspect actual deployed migration history independently; filesystem presence is not deployment proof.

## Proposed logical tables

All IDs UUID unless stated; business timestamps timestamptz(6), amounts Decimal(18,4), K Decimal(18,8). Technical names below are proposals, not generated Prisma models.

| Model | Required columns / key | Constraints / indexes |
|---|---|---|
| BinaryTree | id PK, code unique, name varchar(120), status, createdAt, effectiveAt, createdBy, reason, revision bigint, origin NEW/LEGACY_IMPORT | Non-reused code; no delete; revision compare-and-set; status events authoritative |
| BinaryTreeStatusEvent | id, treeId FK, from/to, effectiveAt, recordedAt, commandId, actor, reason, evidenceHash | Unique command; index tree/effectiveAt/recordedAt; immutable |
| CompanyPrincipal | id PK, approved legal/system reference unique, createdAt, approvalRef | No Member credentials; no fake Person |
| QualificationOwnerInterval | id, qualificationId FK, ownerType, personId nullable FK, companyPrincipalId nullable FK, effectiveFrom/to, recordedAt, evidenceId | CHECK exclusive owner branch; no overlap per Ball; preserve prior interval evidence; index owner/time |
| QualificationKind | qualificationId PK/FK, kind MEMBER_ORIGIN/COMPANY_BOOTSTRAP, sourceEvidence | Permanent bootstrap identity independent of owner; immutable |
| BinaryTreeMembership | treeId + qualificationId unique, firstPlacementAt, sourceEvidenceId | Qualification unique for current immutable-placement scope; composite FK target for edges |
| TreeCanonicalPosition | treeId + positionNo PK, parentPositionNo, side, bootstrapQualificationId nullable | Only 1–7; exact topology check; root has no parent; only 1–3 locked real Balls |
| FoundingOccupationEvidence | id, treeId, positionNo 4–7, qualificationId FK, placementId, effectiveAt, recordedAt | Unique tree/position and qualification; no empty Qualification record; slot availability derived from no occupation |
| CompanySponsorDesignation | id, principalId, treeId, sponsorQualificationId, effectiveFrom/to, approvalRef | Explicit designation, unique effective designation/tree; D2 approval required |
| PlacementTreeEvidence | placementId PK/FK, treeId, parentId, childId, side, effectiveAt, commandId | Composite tree-membership FKs for both nodes; unique occupied parent/side; no self/cycle; same transaction as edge |
| EconomicDestinationEvidence | id, sourceKind, sourceId, entitlementKey, revision, recipientId, ownerIntervalId, destination, treeId, period, rule/parameter refs, payloadHash | Unique entitlementKey/revision across all destinations; immutable; typed source registry below |
| ReservoirBEffect | id, destinationId unique FK, amount signed, currency, sourceAwardRef, settlementRef, periodStart/end, effectiveAt, recordedAt, adjustsEffectId, replayActionId, evidenceHash | No update/delete; correction must reference original; tree/Ball/period indexes; no withdrawal type |
| ProjectionGeneration / Checkpoint | generation PK, source cutoff, status, definitionVersion, reconciliationHash; consumer/event/generation claim | Dedup claim + aggregate update + checkpoint atomic; no gaps concealed by MAX(eventTime) |
| AnalyticsBallPeriod | generation, definitionVersion, periodType/start/end, Ball, tree, foundingScope, rankBasis, metric family | Unique grain; indexed tree/period/Ball; explicit currency/unit/availability; no authority over Core |
| AnalyticsMetricDefinition (config schema, not proposed DB table) | version, key, source basis, filters, temporal policy, rounding, publication status | Immutable published version; reviewed config only, never compensation parameters |

Do not represent root by fake parent or self edge. Membership includes bootstrap root despite no BinaryPlacement child row. For interval checks, a future SQL implementation must enforce non-overlap and exact-one-owner; application validation alone is insufficient. Legacy HolderHistory remains intact and linked to owner intervals. Changing currentHolderPersonId to nullable requires relation/type/API audit; a side table alone cannot make existing required Person references disappear.

## Entitlement and destination design comparison

| Approach | Audit/replay impact | Disposition |
|---|---|---|
| Enum on Qualification/current owner | Current-state only; cannot prove historical recipient or final decision | Reject as sole authority |
| JSON metadata on outbox | Helpful transport; no durable relational uniqueness/source guarantee | Transport only, not ledger |
| Add destination to every Award row | Tight coupling; historical rows and multiple award stores need coordinated changes | Avoid mandatory historical rewrite |
| Generic ledger metadata | Can mix Global A, company B and Welfare bases | Insufficient without typed source validation |
| Append-only destination sidecar + dedicated B ledger | Preserves existing originals; explicit source, revision, owner and routing proof | Recommended |

Source registry: BONUS_AWARD -> BonusAward; GLOBAL_AWARD -> GlobalPoolAward; RPV_UPLINE -> RpvUplineAwardEvent; GLOBAL_REMAINDER -> GlobalPoolSettlement/ReservoirLedgerEffect for A; WELFARE -> WelfarePoolAccrual/WelfarePoolEffect. Use nullable typed foreign keys with exactly-one-source CHECK, or typed subtype tables; an unvalidated polymorphic string ID is not acceptable. BonusCalculationEvidence/TheoryCalculationEvidence references supplement the original source, not a second accrual. Event sources lacking a SettlementBatch use typed period/event evidence; do not fabricate a settlement. Every B effect links original entitlement evidence (“Award-linked”), even when that source is not BonusAward.

EconomicDestination classification distinguishes MEMBER_AWARD, RESERVOIR_A, RESERVOIR_B, WELFARE_ACCRUAL, RECOVERY_ADJUSTMENT. Recovery is a correction dimension referencing original destination, not automatically an additional positive bucket. Enforce company exclusion in award materialization, maturity, PayableEntry, PayoutLine, exports and replay; changing only a UI label or final payout screen is insufficient.

## Later migration sequence and release gates

1. **Inventory/rehearsal:** signed deployed-baseline manifest, backups and isolated restore proof; enumerate holder joins, roots/cycles/duplicates and all Award writers. Resolve D1–G3. Capture member-only Golden hashes and authoritative period totals.
2. **Expand:** additive principals/trees/evidence/destination/projection tables and immutable constraints. Keep runtime flags OFF. Compatibility readers understand nullable company ownership before first company record is written.
3. **Verified non-economic backfill:** explicit legacy root mapping; member owner intervals from historical holder evidence, no name heuristics. Batch/resume by stable ID; mapping hash, row count and rejection report. No rewriting recognition/Award/Ledger/PAID or injecting bootstrap nodes into old graphs.
4. **Shadow:** build isolated analytics generation, compare source counts, distinct placement counts, GPV by original period, finalized Carry, A separately and B shadow calculation. Existing member money must be unchanged for identical inputs. New companies change only approved classification/routing with same K/pool path; do not claim unchanged aggregate economics on a population that now includes new recipients.
5. **Enable after separate authorization:** typed company reads, atomic bootstrap, then placement, then destination write guards and projections in dependency order. Test every alternate/API/worker writer, not only new endpoints. Review flags atomically to avoid a period with company awards entering member payable.
6. **Contract later:** remove compatibility paths only after historical/export/replay consumers prove complete. No destructive cleanup of historical rows.

Rollback: before activation, disable feature/read flags and leave additive tables; after financial effects exist, stop new commands, retain immutable effects, reconcile and use reviewed forward repair. Never delete B effects, company Qualifications or source awards to simulate rollback. An analytics rebuild may switch to a prior complete generation marked STALE; it cannot roll back economics.

## Projection scale / partition decision

Tree/founding aggregates follow [statistics spec](BINARY_TREE_ADMIN_AND_STATISTICS_SPEC.md); BI grains follow [analytics spec](MANAGEMENT_ANALYTICS_AND_BI_SPEC.md). Monthly fact partitions are a later benchmark option, not a requirement for 10K. At 100K/1M, partition by immutable economic period with indexes tree/period/Ball; corrections retain original partition and recordedAt. Keep globally unique event/effect registry outside partitions when uniqueness would otherwise be partition-local. Never partition by mutable holder or rank. Rank/currency/product dimensions use versioned evidence and no cross-product explosion. Exact percentiles require sorted authoritative per-Ball totals or batch rebuild; averaging partition medians is invalid.

Acceptance: duplicate bootstrap/slot race; interval overlap; source FK/check failures; replay signed delta exactly once; no company PAYABLE/PAID in any writer; old-reader compatibility; legacy missing history fails closed; A/B separate totals; rebuild parity; 10K/100K/1M balanced/skewed load; unchanged baseline schema/migration hashes for Phase 1.

## Baseline and AI persistence reconciliation

Final reviewed source is 924dadc9b162a68471ef971c8eec72e24430a554 with 52 existing migrations, including upstream management projection and provider lease work. The filename is historical; do not reserve/reuse migration43 or imply these upstream migrations belong to this change. No migration/schema implementation occurred. D1/D2 remain product decisions; baseline numbering and backfill provenance are engineering gates, not additional open economics.

Temporal TreeAncestry projection proposal: treeId, ancestorQualificationId, descendantQualificationId, depth, firstSide, validFrom/validTo, sourcePlacementVersion, projectionVersion and recordedAt; index (treeId,ancestorId,firstSide,validFrom), unique projection identity plus interval. Authoritative adjacency/placement evidence remains the source; do not require a full transitive closure for unbounded chains (quadratic storage). Partitioned period aggregates and bounded traversal are the recommended scalable path; historical rebuild cannot substitute current topology.

EconomicDestinationEvidence must enforce unique(entitlementKey, revision) across ALL destinations, never destination-dependent uniqueness. One source revision cannot route both to member and B. Use typed award/settlement entitlement source identity and FK/check constraints; B entry references that unique destination decision, with replay signed delta linked to previous revision. Enforce one destination row + one ledger accrual atomically with event/outbox commit; retry uses the same source key.

AI persistence proposal: stable BusinessTermDefinition/MetricDefinition/EventDefinition schemas and seed golden questions live in reviewed versioned config. Knowledge metadata may later need relational approval/effectivity/supersession records once an editorial workflow exists; units retain parent version and source hash. Minimal interaction/tool audit may use the existing controlled audit facility or a separately reviewed append-only store if retention/access needs differ. Do not create tables merely for a provider integration. Raw transcripts default OFF; retention/redaction and legal hold policy require review as described in AI Core. No vector schema or ingestion is proposed for execution in this phase.
