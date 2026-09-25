# UCell Semantic & Governance Core Specification v1.0

**Status:** APPROVED FOR PHASE-1 IMPLEMENTATION
**Date:** 2026-09-25 (Asia/Taipei)
**Baseline:** R1.0B ONLY
**Authority:** current governance SSOT and runtime Golden evidence.

## 0. Re-review conclusions and invariants
This specification was rechecked against FINAL_P0_IDENTIFIER_PRIVACY_DECISION, P0_IDENTIFIER_DATA_DICTIONARY, COMPANY_BOOTSTRAP_PROFILE_V1_APPROVED_MAPPING, R1_0B_MEMBER_ONBOARDING_PAPER_LINE_LINK_SPEC and current IMPLEMENTATION_STATUS.

1. Separate Transaction Truth, R1.0B Economic Truth, and Semantic Truth. Semantic Core defines meaning; it never reimplements economics.
2. memberNo is immutable globally unique YYMM###### per Person using Taipei month. UUID remains relational/internal.
3. ballNo is immutable public Ball number derived from treeCode + authoritative binaryPositionNo; binaryPositionNo is bigint and immutable per tree; binaryPath is derived.
4. Member surfaces exclude bootstrap positions 1–3 entirely. Company-held positions >=4 may appear when otherwise authorized. Reservoir is Member zero-disclosure.
5. Company bootstrap #1–#3 remain authoritative Company LEADER/Always Active Core/Admin nodes. Always Active does not bypass Global rank.
6. Retail Referral follows its approved R1.0B onboarding SSOT and is separate from Sponsor/Binary.
7. Unknown definition/privacy/rule/grain/authorization => FAIL CLOSED.
8. Phase 1 adds Semantic Core only: no LLM, free-form SQL, third-party BI, Stage or Production deployment.

## 1. Definition registries
Required registries: BusinessTermDefinition, EntityDefinition, RelationshipDefinition, DimensionDefinition, MetricDefinition, DatasetDefinition, RuleDefinition, PrivacyDefinition, DefinitionVersion, DefinitionDependency, DataLineage.

Common metadata: code, nameZh, nameEn, description, version, status, effectiveFrom, effectiveTo, owner, sourceAuthority, privacyClass, createdAt, approvedAt, deprecatedAt.
Lifecycle: DRAFT → REVIEW → APPROVED → DEPRECATED → RETIRED. Runtime consumers use only APPROVED effective definitions. Approved historical versions are immutable.

## 2. Business terms v1
PERSON; MEMBER_NO; WEB_MEMBER; QUALIFICATION_PENDING; QUALIFIED_MEMBER; BALL; BALL_NO; TREE; BINARY_POSITION; BINARY_PATH; SPONSOR; BINARY_PARENT; RETAIL_REFERRER; QUALIFICATION; ACTIVE; ORDER; ORDER_LINE; PAYMENT; RETURN; AWARD; RETAIL_REFERRAL; SETTLEMENT; PAYOUT; RECOVERY; RESERVOIR; ERP_HANDOFF.

Key meanings:
- WEB_MEMBER = Person with zero effective formal R1.0B Qualification.
- QUALIFIED_MEMBER = Person with >=1 effective formal R1.0B Qualification.
- SPONSOR = formal Qualification Sponsor Ball; BINARY_PARENT is topology and is not Sponsor.
- RETAIL_REFERRER = WEB_MEMBER retail attribution to Ball; not Sponsor.
- ACTIVE = authoritative R1.0B state; no formula duplicated here.
- RETAIL_REFERRAL = approved product referral Award Type.
- ERP_HANDOFF = UCell order transfer fact, not ERP fulfillment truth.

## 3. Entity/grain definitions
PERSON: one Person; business ID memberNo; source Person Core. General analytics excludes full identity document, bank account, LINE subject/token and auth secrets.
BALL: one Ball/Qualification; business ID ballNo; source Qualification/Binary Core; treeCode/binaryPositionNo authoritative, binaryPath derived.
ORDER: one Order; customer classification must be snapshotted/as-of, not inferred from current Person state.
ORDER_LINE: one Order Line; authoritative commerce monetary snapshot grain.
AWARD_LEDGER_ENTRY: one authoritative award/adjustment/recovery ledger entry or exact existing equivalent.
POSTED_RETURN_LINE: one authoritative posted return line/effect.
SETTLEMENT_ENTRY: one authoritative settlement entry.

## 4. Relationships
PERSON_OWNS_BALL; SPONSOR_BALL_RELATIONSHIP; BINARY_PARENT_RELATIONSHIP; RETAIL_REFERRER_ATTRIBUTION; LINE_IDENTITY_BINDING; ORDER_CUSTOMER; AWARD_BENEFICIARY; RETURN_SOURCE.
Each declares cardinality, authority, effective dating, privacy and evidence. Sponsor and Binary Parent MUST remain independent.

## 5. Time semantics
Company timezone = Asia/Taipei.
Every MetricDefinition declares timeBasis; generic "date" is forbidden.
Standard concepts: CREATED_AT, EFFECTIVE_AT, PAID_AT, RECOGNIZED_AT, PLACED_AT, ACTIVATED_AT, RETURN_POSTED_AT, AWARD_RECOGNIZED_AT, SETTLED_AT, PAID_OUT_AT, AS_OF, DATA_THROUGH, REFRESHED_AT.
Calendar periods use Taipei time unless a versioned cohort/window definition explicitly differs.

## 6. Numeric semantics
MONEY = NUMERIC/Decimal + currency; never float.
RATE = decimal ratio (0.125 means 12.5%).
COUNT = integer/bigint.
PV/BV/GPV/RPV/EPV reuse Core precision.
POSITION = bigint, string-safe in JSON where needed.
ZERO = known zero; NULL = not applicable/no value; UNKNOWN = source/projection unavailable. They are not interchangeable.
Rounding references existing Core policy; Semantic Core cannot create another rounding engine.

## 7. Dimensions v1
DATE, WEEK, MONTH, TREE, BALL, SPONSOR_BALL, PERSON_MEMBERSHIP_STATE, REGISTRATION_SOURCE, ORDER_SOURCE, QUALIFICATION_PACKAGE, PRODUCT, SKU, PRODUCT_CATEGORY, AWARD_TYPE, RETURN_STATUS, RETURN_REASON, ACTIVE_STATUS, SETTLEMENT_STATUS, PAYOUT_STATUS, ERP_TRANSFER_STATUS, RANK.
Each dimension declares source, grain compatibility, privacy, allowed datasets and version.

## 8. MetricDefinition required fields
metricCode, nameZh, nameEn, businessDefinition, metricKind(BASE|DERIVED|AUTHORITATIVE_PROJECTION), sourceDataset, sourceMeasure/sourceField or authoritativeServiceProjection, aggregation, grain, timeBasis, allowedDimensions, allowedFilters, defaultPeriod, unit/currency, nullPolicy, roundingPolicyRef, includeRules, excludeRules, privacyClass, policyRef, ruleRef/ruleVersion, definitionVersion, effectiveFrom/effectiveTo, owner, status, freshnessSla, dependsOnMetrics, lineageRef, goldenFixtureRef.
No metric becomes APPROVED without grain, time basis, privacy, lineage and Golden evidence.

## 9. Membership/growth metrics
PERSON_COUNT: distinct effective Persons; never Ball count.
WEB_MEMBER_COUNT: distinct Persons with zero effective Qualification as-of.
QUALIFIED_MEMBER_COUNT: distinct Persons with >=1 effective Qualification as-of.
QUALIFICATION_PENDING_PERSON_COUNT: Persons with paid acquisition awaiting placement.
BALL_COUNT: effective Balls; scope must explicitly include/exclude bootstrap. Default member/business growth excludes positions 1–3.
NEW_WEB_MEMBER_COUNT: first WEB_MEMBER transition in period.
NEW_QUALIFIED_MEMBER_COUNT: Person first transition to QUALIFIED_MEMBER; second Ball does not increment.
NEW_BALL_COUNT: effective Ball activation/creation event; distinct from new member.
WEB_TO_QUALIFIED_CONVERSION_RATE: remains DRAFT/DECISION_REQUIRED until cohort/window and denominator eligibility are formally approved. Do not invent production KPI.

## 10. Commerce metrics
ORDER_COUNT: distinct effective orders; exact included statuses must map to Order Core before APPROVED.
UNITS_SOLD: recognized quantity; recognition status mapping required.
GROSS_PRODUCT_SALES: authoritative pre-discount product line amount; excludes shipping/non-product fees.
DISCOUNT_AMOUNT: authoritative allocated product discount.
NET_PAID_PRODUCT_AMOUNT: authoritative line net paid product amount after allocated discount; excludes shipping/non-product fees.
BUYER_COUNT: distinct Person buyers in approved recognized order scope.
AOV = NET_PAID_PRODUCT_AMOUNT / ORDER_COUNT; denominator zero => NULL.
NET_RECOGNIZED_SALES remains DRAFT until current return/recognition accounting semantics are exactly mapped.

## 11. Product/Return metrics
SKU_ORDER_COUNT, SKU_UNITS_SOLD, SKU_BUYER_COUNT, SKU_NET_PRODUCT_SALES are SKU dimensions over approved commerce facts.
RETURNED_UNIT_COUNT: POSTED return quantity only; timeBasis RETURN_POSTED_AT unless approved cohort metric differs.
POSTED_RETURN_AMOUNT: authoritative posted return monetary effect.
RETURN_UNIT_RATE and RETURN_AMOUNT_RATE remain DRAFT until period alignment is approved (return-period vs sales-cohort). Never silently divide this month's returns by this month's sales when returns may belong to prior cohorts.

## 12. Retail Referral metrics
RETAIL_REFERRED_NET_SALES: WEB_MEMBER retail line net amount with valid attribution snapshot; does not imply payable award.
RETAIL_REFERRAL_ELIGIBLE_BASE: approved base meeting SKU rule + valid attribution + referrer Active at authoritative recognition as-of.
RETAIL_REFERRAL_INELIGIBLE_BASE: only available if historical Active ineligibility evidence is persisted; never reconstructed from current Active.
RETAIL_REFERRAL_AWARD_AMOUNT: authoritative Award Ledger amount where Award Type=RETAIL_REFERRAL; Semantic Core does not recompute official amount.
RETAIL_REFERRAL_ADJUSTMENT_AMOUNT / RETAIL_REFERRAL_RECOVERY_AMOUNT: authoritative ledger effects.
All preserve WEB_MEMBER boundary, SKU/rule snapshot, Active evidence/as-of, no Sponsor/Binary side effects and Return/Replay semantics.

## 13. Active/Tree/Performance metrics
ACTIVE_BALL_COUNT, INACTIVE_BALL_COUNT, ACTIVE_RATE: authoritative R1.0B Active projection/evidence only. Denominator maps to Active Core and bootstrap scope is explicit.
TREE_BALL_COUNT, TREE_NEW_BALL_COUNT, TREE_ACTIVE_BALL_COUNT, TREE_ACTIVE_RATE: tree-scoped approved variants.
TREE_GPV, TREE_RPV, TREE_EPV: authoritative performance projection only; no order re-aggregation.
LEFT_CARRY, RIGHT_CARRY: authoritative carry snapshot; AS_OF mandatory.
RANK_DISTRIBUTION, BALL_COUNT_BY_RANK, NEW_RANK_ACHIEVEMENT_COUNT: authoritative rank result/history + rankRuleVersion; never inferred from thresholds.

## 14. Award/Settlement/Payout metrics
AWARD_AMOUNT: authoritative Award Ledger/result; dimensions Award Type/Ball/Tree/period/status when authorized.
AWARD_PENDING_AMOUNT, AWARD_SETTLED_AMOUNT, AWARD_ADJUSTMENT_AMOUNT, AWARD_RECOVERY_AMOUNT must map to exact current Core vocabulary before APPROVED.
SETTLEMENT_GROSS_AMOUNT, SETTLEMENT_ADJUSTMENT_AMOUNT, SETTLEMENT_RECOVERY_AMOUNT, SETTLEMENT_NET_AMOUNT, PAYOUT_AMOUNT source Settlement/Payout Core.
Award generated, Settlement finalized and Payout paid are distinct. Ambiguous "發多少獎金" must be disambiguated or present clearly labeled values.

## 15. Onboarding/LINE/Paper metrics
LINE_BOUND_PERSON_COUNT; WEB_MEMBER_REGISTRATION_COUNT; PAPER_APPLICATION_COUNT; PAPER_TO_LINE_LINK_COUNT; QUALIFICATION_ORDER_COUNT; PLACEMENT_PENDING_COUNT; QUALIFICATION_ACTIVATION_COUNT.
PLACEMENT_PENDING_AVG_HOURS remains DRAFT until exact clock start/end/exclusions map to workflow.
OA friend count is separate and requires LINE evidence; never equate OA friends with UCell members.

## 16. ERP handoff metrics
ERP_TRANSFER_PENDING_COUNT, ERP_TRANSFER_SUCCESS_COUNT, ERP_TRANSFER_FAILED_COUNT, ERP_TRANSFER_FAILURE_RATE source UCell handoff state only.
Future manual/import facts: ERP_SHIPPED_COUNT, ERP_RETURN_POSTED_COUNT, ERP_IMPORT_BATCH_COUNT, ERP_IMPORT_REJECTED_ROWS.
ERP imported/manual metrics MUST expose DATA_THROUGH/lastImportAt and UNKNOWN when not imported; never imply real-time fulfillment.
