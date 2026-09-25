# UCell Enterprise Data Dictionary v1.0

**Status:** APPROVED DESIGN / PHYSICAL MAPPING PENDING SG-A1
**Date:** 2026-09-25 (Asia/Taipei)
**Baseline:** R1.0B only
**Authority:** UCELL_GOVERNANCE_AUTHORITY_MAP_V1 + UCELL_SEMANTIC_GOVERNANCE_CORE_SPEC
**Rule:** This dictionary defines business/semantic/logical meaning. Physical table/column/service/projection mappings MUST remain PENDING_SG_A1 until ONBOARDING_FINAL_HEAD is frozen and audited.

## 1. Four-layer dictionary model

Every governed data concept is described at four layers:
1. BUSINESS — what the company means.
2. SEMANTIC — entity/fact/relationship/grain/time/scope/privacy.
3. LOGICAL — stable logical fields and constraints used by APIs/analytics.
4. PHYSICAL — actual DB/service/projection mapping; PENDING_SG_A1 in v1 unless already an immutable governance invariant.

Never infer physical source from naming similarity.

## 2. Global value rules

- Company timezone: Asia/Taipei.
- Money: Decimal/NUMERIC + currency; never float.
- Rate: decimal ratio; 0.125 means 12.5%.
- Count: integer/bigint.
- binaryPositionNo: bigint.
- UUID: internal relational key, not normal operational display.
- ZERO != NULL != UNKNOWN.
- Historical truth uses historical evidence/version, not current-state reconstruction.
- Member-visible privacy always excludes bootstrap positions 1–3 and Reservoir.
- Normal operational identifiers are memberNo and ballNo.

## 3. Identity domain

### PERSON
Business: natural/account principal represented by UCell.
Semantic grain: one Person.
Business identifier: memberNo.
Cardinality: Person 1:N Ball.
Logical fields:
- internalId: UUID/internal only, C3/internal.
- memberNo: immutable globally unique YYMM######; normal operational identifier.
- createdAt: creation timestamp; not automatically membership effective time.
- registrationSource: governed source/provenance.
- currentMembershipState: derived/as-of state, not historical order classification.
Privacy: C2 detail; identity/bank/LINE security attributes C3.
Physical mapping: PENDING_SG_A1.

### LINE_IDENTITY_BINDING
Business: verified LINE subject bound to existing Person.
Semantic: STATE/effective-dated identity relationship.
Rules: LINE identity is not membership truth; rebind cannot change Person/Ball/Sponsor/economics.
Logical fields: personRef, provider, verifiedSubjectRef, status, effectiveFrom/effectiveTo, evidenceRef.
Privacy: C3. Raw token/secret excluded from analytics.
Physical: PENDING_SG_A1.

## 4. Membership / Qualification domain

### WEB_MEMBER
Business: Person with zero effective formal R1.0B Qualification.
Semantic: derived STATE as-of.
Not equivalent to OA friend or LINE login.
Physical: PENDING_SG_A1.

### QUALIFICATION_PENDING
Business: paid qualification acquisition awaiting authoritative placement.
Semantic: STATE tied to acquisition.
Entry fact: PAYMENT_CONFIRMED for that acquisition.
Exit: PLACEMENT_COMMITTED/QUALIFICATION_ACTIVATED, or governed cancellation/reversal.
Physical: PENDING_SG_A1.

### QUALIFICATION
Business: formal R1.0B membership/economic operating qualification represented as Ball.
Grain: one Qualification/Ball.
Business identifier: ballNo.
Logical: holderPersonRef, ballNo, treeCode, binaryPositionNo, derived binaryPath, sponsor evidence, lifecycle/effective timestamps, status.
Physical: PENDING_SG_A1.

### QUALIFIED_MEMBER
Business: Person with >=1 effective formal Qualification.
Grain: Person state, not Ball count.
Physical: PENDING_SG_A1.

## 5. Organization domain

### BALL
Business: R1.0B organizational/economic operating unit.
Grain: one Ball.
Identifier: ballNo.
Privacy: holder detail depends on scope; non-direct holder PII is not exposed to Member.
Bootstrap: positions 1–3 absent from MEMBER_VISIBLE.
Physical: PENDING_SG_A1.

### TREE
Business: governed binary organization tree.
Logical identifier: treeCode.
Physical: PENDING_SG_A1.

### BINARY_POSITION
Authority: binaryPositionNo.
Meaning: immutable heap position within Tree.
binaryPath is derived and never the authority.
Physical: PENDING_SG_A1.

### SPONSOR_RELATIONSHIP
Business: formal Qualification Sponsor Ball relationship.
Independent from Binary Parent and Retail Referrer.
Historical evidence/version required.
Physical: PENDING_SG_A1.

### BINARY_PARENT_RELATIONSHIP
Business: topology parent-child relationship.
Not Sponsor.
Physical: PENDING_SG_A1.

### COMPANY_SPONSOR_ALIAS
Business: governed safe alias for explicitly authorized company-sponsored Qualification onboarding.
Not ballNo; Member-safe label does not expose bootstrap 1–3.
v1: Qualification Sponsor only; not Retail Referrer.
Logical: alias, effective dates, config/rule version, target evidence, audit.
Physical: PENDING operational closure / SG-A1.

## 6. Commerce domain

### PRODUCT / SKU
Business: sellable catalog item/configuration.
Logical: sku, product identity, list/qualified pricing snapshots, PV/BV parameters where Core defines them, Retail Referral effective-dated rule.
Historical order uses snapshots, not current SKU config.
Physical: PENDING_SG_A1.

### ORDER
Grain: one Order.
Business: UCell commerce/acquisition transaction.
Logical: order business ID, purchaserPersonRef, orderSource, purpose/type, status, money totals, createdAt, payment/recognition refs.
Customer type at order must be snapshotted/as-of; do not infer from current membership.
ADMIN_PAPER_ORDER is source/channel, not a separate engine.
Physical: PENDING_SG_A1.

### ORDER_LINE
Grain: one line.
Business: immutable/snapshotted product economics used for commerce and award evidence.
Logical: orderRef, sku, qty, list/gross, discount allocation, net paid product amount, PV/BV snapshots where applicable, Retail Referral snapshot/evidence.
Physical: PENDING_SG_A1.

### PAYMENT
Business: authoritative payment lifecycle/evidence.
PAYMENT_CONFIRMED is an event; payment alone does not equal Qualification activation.
Paper evidence entry != payment approval.
Logical: payment business ref, order/acquisition ref, amount Decimal, currency, channel, status, confirmedAt, evidenceRef, approver.
Physical: PENDING_SG_A1.

## 7. Retail Referral domain — MUST NOT COLLAPSE FIELDS

### RETAIL_REFERRER_ATTRIBUTION
Business: WEB_MEMBER retail attribution to a Referrer Ball.
Not Sponsor and not Binary Parent.
First valid attributed order locks member self-edit; Admin correction is forward-only/effective-dated.
Logical: personRef, referrerBallRef/ballNo, effectiveFrom/effectiveTo, source, lock evidence, correction reason/audit.
Physical: PENDING_SG_A1.

### RETAIL_REFERRAL_THEORETICAL_AMOUNT
Meaning: calculated theoretical amount before eligibility/payability gating, retained for Explain/evidence.
This is NOT payable amount.
Example verified behavior: theoretical 10 may coexist with inactive eligibility and payable 0.
Source: authoritative Retail Referral/Award evidence after SG-A1.

### RETAIL_REFERRAL_ELIGIBILITY
Meaning: recognition-time authoritative eligibility of Referrer Ball, including Active evidence/as-of/rule version.
Logical: eligible boolean/status, activeAsOf, activeRuleVersion, evidenceRef.
Historical eligibility cannot use current Active.

### RETAIL_REFERRAL_PAYABLE_AMOUNT
Meaning: amount that became payable after authoritative eligibility/rules.
Inactive referrer => payable 0; no pending/later catch-up under v1.
Official value must come from Economic Core/Award evidence.

### RETAIL_REFERRAL_AWARD
Business: RETAIL_REFERRAL Award Type in existing Award lifecycle.
Must not create Sponsor/Binary/organization/PV effects by itself.
Logical evidence includes line snapshot, referrer Ball, theoretical amount, eligibility, payable amount, rule/rate version.

### RETAIL_REFERRAL_ADJUSTMENT / RECOVERY
Business: append-only economic effects caused by POSTED return/approved adjustment.
Original Award remains immutable.
Partial return creates proportional append-only effect.
Retry must be idempotent.
Paid-state may route to Recovery rather than mutate original Award.
Physical: PENDING_SG_A1.

## 8. R1.0B Economic domain

### ACTIVE_STATE
Type: authoritative STATE.
Source authority: R1.0B Active Core; Semantic/AI must not reimplement formula.
Logical: ballRef, eligible/active state, asOf/effective interval, ruleVersion, evidenceRef.
Physical: PENDING_SG_A1.

### PERFORMANCE_SNAPSHOT
Type: authoritative SNAPSHOT.
Contains approved GPV/RPV/EPV semantics from R1.0B authority.
Do not reconstruct official values from Order analytics.
Physical: PENDING_SG_A1.

### CARRY_SNAPSHOT
Authoritative as-of Carry result.
Logical: Ball/tree scope, leftCarry, rightCarry, asOf, ruleVersion/evidence.
Physical: PENDING_SG_A1.

### RANK_STATE
Authoritative R1.0B rank state/history.
Historical rank uses historical rule/evidence.
Physical: PENDING_SG_A1.

### AWARD_LEDGER_ENTRY
Grain: one authoritative award/adjustment/recovery entry or exact current Core equivalent.
Award generated != Settlement finalized != Payout paid.
Physical: PENDING_SG_A1.

### SETTLEMENT_ENTRY
Grain: one settlement entry/result.
Physical: PENDING_SG_A1.

### PAYOUT
Business: actual payable/payment state/result.
Distinct from Award and Settlement.
Physical: PENDING_SG_A1.

### RESERVOIR
C3 restricted company financial construct.
Member: zero-disclosure, including existence/value/details.
Physical mapping intentionally withheld from general dictionary; SG-A1 finance-only mapping.

## 9. Return domain

### RETURN
Business: governed return lifecycle.
Only authoritative POSTED return enters official return numerators/economic replay.
Logical: return ref, original order/line, qty, amount/effect, status, postedAt, reason/evidence.
Physical: PENDING_SG_A1.

### RETURN_POSTED
Type: EVENT.
Triggers governed Return/Replay economic handling.
Unposted/open return does not alter official Award numerator/effect.

### REPLAY / RECOVERY
Replay deterministically derives append-only adjustment/recovery effects from authoritative events.
Must be idempotent and preserve original evidence.
Physical: PENDING_SG_A1.

## 10. Paper Operations domain

### PAPER_APPLICATION
Business: Admin-entered application provenance/evidence for Person/onboarding.
Must search/reuse existing Person first.
Physical: PENDING operational closure / SG-A1.

### PAPER_ORDER
Business: normal UCell Order with source ADMIN_PAPER_ORDER.
Can represent Retail Product and/or Qualification Package under approved mapping.
Not a separate commerce/economic engine.

### PAPER_RECEIPT_EVIDENCE
Logical:
paperReceiptReference, receivedAt, paymentChannel, amount Decimal, currency, evidenceDocumentRef, enteredBy, confirmedBy, confirmationAt, bounded note.
Idempotency identity follows approved decision.
Raw identity/bank/document bytes excluded from normal logs/OpenAPI.
Physical: PENDING operational closure / SG-A1.

### PLACEMENT_PENDING
State after authoritative payment confirmation and before placement commit.
Current pending age is distinct from completed placement duration.

### PLACEMENT_COMMITTED
Event: authoritative Tree/Parent/Side placement commit.
Admin on-behalf action preserves original Sponsor and records actor/reason.

## 11. ERP boundary domain

### ERP_HANDOFF
Business: UCell fact that an order was transferred/accepted by ERP adapter.
Truth source: UCELL_AUTHORITATIVE for handoff only.
Logical: UCell order ref, ERP system, externalOrderId, transfer status, transferredAt, error/evidence.
ERP_TRANSFER_SUCCESS != shipped/invoiced.

### ERP_FULFILLMENT_FACT
May come later from API/import/manual verification.
Truth sources: EXTERNAL_INTEGRATED / EXTERNAL_IMPORTED / MANUAL_VERIFIED / UNKNOWN.
Logical: externalOrderRef, fulfillment type/status, tracking/invoice refs where authorized, dataThrough, received/importedAt, evidence.
No returned data => UNKNOWN, not not-shipped.

## 12. Governance domain

### DEFINITION
Versioned governed meaning.
Statuses: DRAFT, REVIEW, APPROVED, DEPRECATED, RETIRED.
Approved historical version immutable.

### CERTIFICATION
Operational readiness: UNMAPPED → SOURCE_MAPPED → GOLDEN_VERIFIED → CERTIFIED.
Only CERTIFIED effective metrics are official KPI.

### AUTHORITY_CONFLICT
Records disagreement among governance/runtime/schema/Golden sources.
OPEN conflict blocks certification; AI/Codex cannot silently choose.

### DATA_LINEAGE
Metric → Dataset/Projection → Fact/Core → Rule/Evidence.
Required for certified metrics.

## 13. Join/cardinality dictionary

PERSON 1:N BALL.
ORDER 1:N ORDER_LINE.
ORDER_LINE may 1:N AWARD/adjustment effects.
SPONSOR and BINARY_PARENT are separate edges.
RETAIL_REFERRER is separate from both.
Unsafe fan-out is forbidden; approved joins/cardinality must be registered before governed analytics.

## 14. Physical mapping placeholder contract

SG-A1 will append for each concept:
- authoritative domain/service;
- projection/view;
- table/model;
- field(s);
- business key;
- event timestamp;
- effective/as-of semantics;
- rule version/evidence;
- historical availability;
- indexes/constraints;
- OpenAPI surface;
- Golden evidence;
- known limitation/conflict.

Until then the value is PENDING_SG_A1; no guessed mapping is permitted.

## 15. Cross-layer maintenance

Every future material change must update this dictionary when meaning/logical data changes and disposition its impact under UCELL_CROSS_LAYER_CHANGE_GOVERNANCE_RULE_V1.
GitHub is technical/versioned SSOT. Affected Google Drive formal documents must be assessed/synchronized at closure.
