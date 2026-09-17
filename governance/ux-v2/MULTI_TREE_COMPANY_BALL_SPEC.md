# Multi-Tree / Company Ball domain specification

Status: PHASE_1_SPECIFICATION; implementation gated by PO/SA Architecture Review. Baseline: `903b8e96b9419e4dad2625777b7ec8ff1053c433`, branch `integration/member-backend-mvp`. Production Promotion: BLOCKED.

## 1. Authority and invariants

Read [Issue and all three addenda](evidence/ISSUE_2_SNAPSHOT.md), [Decision Register v3](../sa-decisions/decisions.json), [Boundary Decisions](../sa-decisions/R1_0B_PRODUCT_OWNER_BOUNDARY_DECISIONS_20260917.md), and [Volume Clarification](../sa-decisions/R1_0B_VOLUME_CLASS_CLARIFICATION_20260917.md). The newer decisions resolve old Core Addendum wording about cut-offs, literal 45 days, PV/BV migration, and fixed-generation traversal. Those are not open decisions.

Immutable constraints: Person != Qualification; Sponsor != Binary; Qualification-scoped Active/Carry/economics; historical snapshots cannot fall back to current state; recognition, Award, Ledger and PAID originals are immutable. R1.0B rates, GPV/RPV/EPV formulas, K0/K1/K2, weekly Binary, 10/25 and payout calendar remain unchanged. The only new economic exceptions are explicit company classification/Always Active and post-calculation Reservoir B destination. A tree is an organization scope, not automatically a new K/pool budget.

## 2. Aggregate contracts

| Aggregate / property | Proposed contract |
|---|---|
| BinaryTreeId | Server UUID; immutable across rename, archive and projection rebuild |
| TreeCode | Stable unique business code allocated transactionally; never reused, including archived trees; not derived from display name or count+1 |
| TreeName | Nonempty display name, max 120 characters; auditable rename; not identity |
| Status | DRAFT, ACTIVE, CLOSED_TO_NEW, ARCHIVED; effective-dated events plus current projection |
| createdAt / effectiveAt | Server recorded time / business-effective instant; retain both |
| createdBy / reason | Authenticated actor reference and nonempty reason; never trust a client actor override |
| evidence | Command ID, correlation ID, idempotency payload hash, audit event ID, approval/rule reference, topology hash |
| topologyVersion | Monotonic tree-local revision for command concurrency and read context |
| CompanyPrincipal | One explicit legal/system company owner identity; not three fake Persons; no Member login or member PII contract |
| QualificationOwnerInterval | QualificationId, ownerType MEMBER or COMPANY, personId XOR companyPrincipalId, effectiveFrom, effectiveTo, recordedAt, source evidence |
| Qualification kind | MEMBER_ORIGIN or COMPANY_BOOTSTRAP; permanent bootstrap lock is separate from current ownership |
| TreeMembership | QualificationId, BinaryTreeId, initial effective placement, source evidence; one effective tree per Qualification |

Bootstrap company Balls can share the same principal across Tree A and B while retaining six distinct Qualification IDs. An exited member-origin Ball may become company-held without becoming a bootstrap Ball. On an approved later retransfer its owner interval becomes MEMBER; bootstrap Balls can never be transferred through ordinary workflows. Neither kind nor ownerType is inferred from a name, magic ID, `activeFlag`, or the number shown in the diagram.

The existing `Qualification.currentHolderPersonId` is mandatory. A separate owner table alone is insufficient: a later migration must permit company ownership without inventing Person records and update every holder-dependent authorization/join. Keep old holder history intact; new authoritative owner intervals attach to verified historical evidence. Existing company-holder Person records need an explicit reviewed mapping; never bulk-classify by legalName.

## 3. Atomic new-tree bootstrap

`CreateBinaryTree(treeName, requestedTreeCode?, effectiveAt, idempotencyKey, reason)` executes one serializable transaction:

1. Resolve authenticated actor, company principal, approved bootstrap configuration and semantic idempotency scope. Validate code uniqueness/non-reuse and time policy.
2. Claim idempotency key using canonical payload hash. Same payload returns original tree; different payload returns conflict. Allocate immutable tree/code only once.
3. Create DRAFT tree, three real company Qualifications and their owner/type/plan/status evidence. Plan/rank configuration is gated by D1 in [pending decisions](PENDING_ARCHITECTURE_DECISIONS.md); do not invent max-rank company privileges.
4. Create canonical position records 1–7. Occupy #1/#2/#3 and create #2 LEFT of #1, #3 RIGHT of #1. Root #1 has no Binary parent.
5. Create membership, topology evidence and projection outbox event in the same transaction. Return IDs, version and evidence only after commit.

```text
                 #1 COMPANY
                /          \
          #2 COMPANY      #3 COMPANY
           /     \         /     \
          #4     #5       #6     #7
            available MEMBER positions
```

Recommendation: persist four available position records, with nullable occupant and mandatory parent+side, for #4–#7. Do not create placeholder Qualifications, holderless Balls, fake Persons, Active records or entitlements. Empty is `AVAILABLE`, not an inactive member with zero money. A position is immutable; occupation is an effective fact referencing a real purchased/eligible Qualification. Unique `(treeId, positionNo)` and unique parent+side occupancy guard retries/races. The all-seven-fake-Balls alternative violates holder, count and economic semantics and is rejected.

Activation is a separate governed command; DRAFT bootstrap cannot accept normal placements. Any failure rolls back tree, Qualifications, edges, owner records, audit/outbox and idempotency completion together. A connection loss after commit is resolved by retry/status lookup with the original key.

## 4. Company Sponsor model

Approved clarification: [independent operating unit decision](COMPANY_BALL_OPERATING_UNIT_DECISION.md). Every company Ball remains an independent operating Qualification and participates in actual Sponsor sequence like other Balls. CompanyPrincipal identifies ownership, not a merged operational recipient. Canonical position numbers are not referral sequence numbers; do not skip company referrals or reset the sequence for founding members.

Recommended technical representation: retain Qualification-to-Qualification Sponsor edges. Each tree has a separately recorded CompanySponsorDesignation linking CompanyPrincipal to a designated company Qualification (candidate: that tree's #1). Founding Sponsor selection explicitly records that designation; Binary parent remains #2 or #3. Company identity is the business Sponsor; the designated Qualification is its economic traversal anchor.

Alternative principal-only Sponsor edges would introduce mixed node types into fixed historical generations and cannot reuse present Core without new traversal rules. A global designated company Qualification is possible but changes referral recipient/tree attribution. Neither alternative is silently selected. D2 requires PO confirmation of designation, company-node Sponsor ancestry and normal first/third-left interaction before economic implementation.

For all founding positions: `sponsorPrincipal=COMPANY`; #4/#5 `binaryParent=#2`; #6/#7 `binaryParent=#3`. A founding placement command must verify the pre-existing explicit Company Sponsor evidence; if a different Sponsor is confirmed, reject and use the separately approved setup workflow. Placement never creates or rewrites Sponsor edges as a hidden side effect.

The existing first/third-left guard lives in both `organization.service.ts` and migration 0013. With candidate Sponsor #1 and no prior Sponsor referrals, filling #4, #5, #6 makes #6 the third referral on #1's right subtree. Existing real company referrals change that sequence and must be counted. This is a concrete conflict, not permission to bypass all normal member guards. Preserve canonical positions and ordinary actual Sponsor ordering; no company/founding exception is the default recommendation. Resolve the actual Sponsor graph and valid placement flow before implementation. Arbitrary filling order must also be addressed; do not assume #4–#7 are occupied in sequence.

Sponsor traversal uses its own historical edges and fixed generations, continues past zero/ineligible generations without compression, and never substitutes a holder's other Ball. Tree isolation applies to Binary propagation/Carry; do not silently prohibit otherwise lawful Sponsor relationships merely because Binary tree IDs differ.

## 5. Active and ownership semantics

| Historical owner | Active display / calculation basis |
|---|---|
| MEMBER | Qualification x Asia/Taipei calendar month eligible consumption >= NT$2,000; effective from threshold-crossing recognition; no earlier-event backfill; resets next month |
| COMPANY | Always Active (Company Rule) while explicit company ownership/type interval applies; no threshold or monthly reset |
| Missing/overlapping ownership evidence | Block affected historical calculation; no current-holder fallback |

Owner classification is read at the same effective historical eligibility instant used by the existing rule, then persisted in calculation/replay evidence. Current ownership cannot redirect an earlier member entitlement. Return POSTED replays original eligibility and routing evidence. EXIT must preserve Qualification ID, Sponsor/Binary positions, Carry and history; count/new-count are unchanged. Always Active does not grant an invented plan, rank, unlock depth or additional rate; those remain governed by rule/configuration and D1.

Existing EXIT sets CLOSED/EXITED and `activeFlag=false`; changing that path is future implementation work requiring explicit effective evidence. Do not retrofit a company owner into historical member periods. Member UI shows upstream company nodes as 公司球; it cannot open company income or admin controls.

## 6. Final entitlement and destination

```text
Recognition -> Core calculation -> Theory -> applicable K/Pool
 -> Final entitlement + historical recipient classification
    MEMBER  -> existing Member Award lifecycle
    COMPANY -> Reservoir B accrual
```

Never skip company nodes before calculation, prune company theories from a denominator, transfer Carry between trees, or split existing pool scope by tree. Preserve zero-entitlement evidence. Global, RPV and EPV paths need the same deterministic destination contract, not only Binary. Company final entitlement must not enter member PAYABLE/PAID or member payout exports.

Recommend an append-only `EconomicDestinationEvidence` sidecar bound to the final calculation, with an explicit destination enum: MEMBER_AWARD, RESERVOIR_A, RESERVOIR_B, WELFARE_ACCRUAL, RECOVERY_ADJUSTMENT. This enum is classification, not a claim that every row is a disjoint additive currency bucket. Recovery references its original destination and is shown separately to prevent double-counting. Dedicated Reservoir B effects avoid weakening Reservoir A's Global-specific source semantics. Existing Awards can remain immutable calculation evidence only if the future writer/maturity worker prevents all company payout lifecycle events; the precise source mapping is in [migration proposal](MIGRATION_43_PLUS_PROPOSAL.md).

Reservoir B effect fields: effectId, destinationEvidenceId, qualificationId, companyPrincipalId/ownerIntervalId, BinaryTreeId at applicable time, source kind/id, finalCalculationId, optional existing AwardId, settlementId or typed authoritative event-period reference, periodStart/end, amount `Decimal(18,4)`, currency, RuleVersion, ParameterVersion/hash, effectiveAt/recordedAt, replayActionId, adjustsEffectId, idempotency key and evidenceHash. Event-driven awards without a settlement row must retain their authoritative event source and period; do not invent a Settlement FK. A placed company recipient requires a tree link; unresolved legacy association fails closed for new routing.

Exactly-once means database uniqueness + atomic posting, despite at-least-once delivery. Key = stable entitlement identity + destination + calculation/replay revision; exclude retry time. Lock entitlement baseline; compute delta against already-posted effective total; persist destination, effect, audit and outbox transactionally. Repeated same revision/payload returns the original; same key/different payload conflicts. Crash before commit leaves no effect; crash after commit returns original on redelivery. A later replay may append a signed correction, never edit the original. Negative correction of overstated accrual is not a discretionary outflow. No withdrawal/transfer/disbursement command exists.

Example for mechanism only, not a rule fixture: original final company entitlement 100.0000 produces +100.0000; replay effective total 80.0000 appends -20.0000 linked to original; retry appends nothing. No payout, K supplement, Welfare supplement, member transfer or Reservoir A transfer is created. Rules still decide the actual final entitlement.

## 7. Lifecycle

| State | Placement / administration | Economics / history |
|---|---|---|
| DRAFT | Bootstrap only; name/settings and activation review | Bootstrap history readable; no ordinary member placement |
| ACTIVE | Governed placements permitted | Existing authoritative calculations continue |
| CLOSED_TO_NEW | No new placement; audited reopen proposal allowed | Recognition, existing calculation, Carry and replay continue |
| ARCHIVED | Read-only operations; no delete, rename or placement | History, required corrections/replay remain accessible; archive cannot extinguish economic obligations |

Recommended transitions: DRAFT->ACTIVE, ACTIVE->CLOSED_TO_NEW, CLOSED_TO_NEW->ACTIVE, CLOSED_TO_NEW->ARCHIVED, and unused DRAFT->ARCHIVED. ARCHIVED is terminal for normal commands. Require actor, reason, effectiveAt, expectedVersion, audit evidence and idempotency key. Use server-now effective execution initially; reject past/future scheduling unless a separately implemented scheduler provides lifecycle evidence and commit-time checks. This avoids a UI status implying a future transition already happened. Archival preflight blocks unresolved active settlement/replay/payout obligations; it never deletes or prevents legally necessary append-only corrections. Transition and concurrent placement lock the same tree revision.

## 8. Required next-phase executable acceptance

MT01 create A / retry / conflicting retry: exactly 3 real company Balls and 7 positions, no fake #4–#7 Qualifications. MT02 create B: IDs/edges/Carry/GPV remain separate. MT03 invalid bootstrap mutation, transfer, delete or Member access denied at API and DB boundaries. MT04 all four founding positions have explicit Company Sponsor and correct independent Binary parents, including out-of-order occupancy. MT05 company month boundary and historical transfer preserve Always Active; normal member threshold still NT$2,000. MT06 all award types calculate before routing, including zero theories and pool denominators. MT07 company has no member PayableEntry/PayoutLine/PAID. MT08 duplicate/reordered outbox and concurrent replay converge B exactly once; signed correction and rollback tested. MT09 A/B reconcile separately. MT10 missing historical owner/tree/rule evidence blocks. MT11 tree code non-reuse and placement-vs-close race. MT12 member-origin company succession counts once and preserves Carry. MT13 compare pre-extension Golden outputs byte-for-byte for member-only unchanged input and flag-off paths. These are planned tests, not claimed Phase 1 implementation.
