# UCell Management KPI Catalog v1.0

**Status:** APPROVED DESIGN / CERTIFICATION PENDING SG-A1
**Date:** 2026-09-25 (Asia/Taipei)
**Baseline:** R1.0B only
**Authority:** UCELL_GOVERNANCE_AUTHORITY_MAP_V1, UCELL_SEMANTIC_GOVERNANCE_CORE_SPEC, UCELL_ENTERPRISE_DATA_DICTIONARY_V1
**Purpose:** define decision-useful management KPIs before building dashboards or AI. This catalog does not certify numeric sources; physical/source certification remains SG-A1+.

## 1. KPI classes

- EXECUTIVE_KPI: small set of company-level decision signals.
- MANAGEMENT_KPI: recurring management performance measure.
- OPERATIONAL_KPI: queue/SLA/action signal.
- DIAGNOSTIC_METRIC: drill-down/explanation measure, not headline KPI.
- GOVERNANCE_KPI: data/security/definition health.

A KPI may be shown as official only when its underlying Metric(s) are CERTIFIED and effective. REVIEW/UNMAPPED items are design candidates only.

## 2. Common KPI contract

Each KPI defines:
kpiCode, name, class, businessQuestion, metricCode(s), audience, defaultScope, timeGrain/window, dimensions, privacy, freshness expectation, certification dependency, drillDown, suggestedVisualization, alert semantics if approved, AI question examples.

Targets/alerts MUST NOT be invented. A threshold requires an explicit approved business target or deterministic SLA.

## 3. Executive KPI set — intentionally small

### KPI-EX-001 NEW_WEB_MEMBERS
Question: How many new WEB_MEMBER Persons entered in the period?
Metric: NEW_WEB_MEMBER_COUNT
Audience: Executive / Operations
Scope: ADMIN_OPERATIONS
Time: week/month
Drill-down: registration source, cohort
Status: certification pending.

### KPI-EX-002 NEW_QUALIFIED_MEMBERS
Question: How many Persons became formal members for the first time?
Metric: NEW_QUALIFIED_MEMBER_COUNT
Important: additional Balls do not increment this KPI.
Time: week/month.

### KPI-EX-003 NEW_BALLS
Question: How many new effective Balls were activated?
Metric: NEW_BALL_COUNT
Important: distinct from new qualified Persons.
Dimensions: Tree, Sponsor where authorized.

### KPI-EX-004 ACTIVE_BALL_RATE
Question: What share of eligible Balls is Active as-of?
Metrics: ACTIVE_BALL_COUNT + authoritative eligible denominator / ACTIVE_RATE once mapped.
Kind: AUTHORITATIVE_ECONOMIC dependency.
AsOf required.

### KPI-EX-005 COMMERCE_NET_PAID
Question: What is UCell net paid product commerce amount in the period?
Metric: NET_PAID_PRODUCT_AMOUNT
Do not label Accounting Revenue.
Dimensions: product/SKU, customer membership state at order, source.
Status: REVIEW until recognition/status mapping certified.

### KPI-EX-006 WEB_TO_QUALIFIED_30D
Question: Of mature WEB_MEMBER cohorts, what percentage became qualified within 30 days?
Metric: WEB_TO_QUALIFIED_30D_RATE
Mature cohorts only.
Suggested view: cohort trend.

### KPI-EX-007 RETAIL_REFERRAL_PAYABLE
Question: How much Retail Referral became payable?
Metric: RETAIL_REFERRAL_AWARD_AMOUNT / payable economic authority.
Do not substitute theoretical amount.
Dimensions: SKU, Tree, Referrer Ball where authorized.

### KPI-EX-008 RETURN_30D_UNIT_RATE
Question: What share of mature sales-cohort units were POSTED returned within 30 days?
Metric: 30D_RETURN_UNIT_RATE
Do not substitute calendar-period returns/sales.

### KPI-EX-009 PLACEMENT_PENDING_OVER_24H
Question: How many paid qualification acquisitions are still unplaced after 24 hours?
Metric: PLACEMENT_PENDING_OVER_24H_COUNT
Class: EXECUTIVE + OPERATIONAL.
Alert threshold: the metric itself uses >24h; no extra target invented.

## 4. Membership & funnel

KPI-MEM-001 PERSON_COUNT — distinct Persons as-of.
KPI-MEM-002 WEB_MEMBER_COUNT — Persons with zero effective Qualification as-of.
KPI-MEM-003 QUALIFIED_MEMBER_COUNT — Persons with >=1 effective Qualification as-of.
KPI-MEM-004 WEB_TO_QUALIFIED_7D — early cohort conversion.
KPI-MEM-005 WEB_TO_QUALIFIED_30D — primary conversion view.
KPI-MEM-006 WEB_TO_QUALIFIED_90D — longer-cycle conversion.
KPI-MEM-007 CONVERSION_MEDIAN_DAYS — preferred conversion-time central tendency.
KPI-MEM-008 QUALIFICATION_PENDING_PERSONS — paid acquisition awaiting placement.

Primary dimensions after historical snapshot validation:
cohort month/week, registration source, initial Retail Referrer Ball, first Qualification Package.
Never classify historical cohort by current membership/referrer/package state.

## 5. Organization health

KPI-ORG-001 BALL_COUNT
KPI-ORG-002 NEW_BALL_COUNT
KPI-ORG-003 ACTIVE_BALL_COUNT
KPI-ORG-004 ACTIVE_RATE
KPI-ORG-005 TREE_GPV
KPI-ORG-006 TREE_RPV
KPI-ORG-007 TREE_EPV
KPI-ORG-008 LEFT_CARRY
KPI-ORG-009 RIGHT_CARRY
KPI-ORG-010 RANK_DISTRIBUTION

Rules:
- Active/performance/carry/rank are authoritative economic metrics; no analytics recomputation.
- AsOf/rule version required where applicable.
- MEMBER_VISIBLE excludes bootstrap positions 1–3. Executive/Admin scopes use their explicitly defined populations; caller privilege never mutates metric scope.

## 6. Commerce

KPI-COM-001 ORDER_COUNT
KPI-COM-002 UNITS_SOLD
KPI-COM-003 GROSS_PRODUCT_SALES
KPI-COM-004 DISCOUNT_AMOUNT
KPI-COM-005 NET_PAID_PRODUCT_AMOUNT
KPI-COM-006 BUYER_COUNT
KPI-COM-007 AOV
KPI-COM-008 COMMERCE_NET_AFTER_POSTED_RETURNS — candidate only until exact period/source mapping certified.

Do not call UCell commerce metrics Accounting Revenue.
Dimensions: SKU/product/category, order source, customer state-at-order, time.
Order→OrderLine fan-out safety mandatory.

## 7. Product

KPI-PRD-001 SKU_UNITS_SOLD
KPI-PRD-002 SKU_NET_PRODUCT_SALES
KPI-PRD-003 SKU_BUYER_COUNT
KPI-PRD-004 SKU_ORDER_COUNT
KPI-PRD-005 SKU_30D_RETURN_UNIT_RATE
KPI-PRD-006 SKU_RETAIL_REFERRED_NET_SALES
KPI-PRD-007 SKU_RETAIL_REFERRAL_PAYABLE

Diagnostic dimensions: SKU rule version, order source, cohort.
Current SKU config must not rewrite historical order/referral economics.

## 8. Retail Referral

### Headline
KPI-RR-001 RETAIL_REFERRED_NET_SALES
KPI-RR-002 RETAIL_REFERRAL_THEORETICAL_AMOUNT
KPI-RR-003 RETAIL_REFERRAL_PAYABLE_AMOUNT
KPI-RR-004 RETAIL_REFERRAL_RECOVERY_AMOUNT

### Diagnostic
KPI-RR-005 ACTIVE_ELIGIBLE_BASE
KPI-RR-006 INACTIVE_INELIGIBLE_BASE
KPI-RR-007 ACTIVE_REFERRER_AWARD_COUNT
KPI-RR-008 INACTIVE_REFERRER_ZERO_PAYABLE_COUNT
KPI-RR-009 RETURN_ADJUSTMENT_RECOVERY_COUNT

Mandatory semantic separation:
theoretical amount != eligibility != payable amount != recovery.
Inactive at recognition: theoretical may exist, payable=0, no later catch-up.
Retail Referral itself creates no PV/Binary/Sponsor/organization side effect.
Return effects are append-only; original Award immutable.

## 9. Returns

KPI-RET-001 POSTED_RETURN_UNITS_BY_PERIOD
KPI-RET-002 POSTED_RETURN_AMOUNT_BY_PERIOD
KPI-RET-003 30D_RETURN_UNIT_RATE
KPI-RET-004 30D_RETURN_AMOUNT_RATE — REVIEW until money-base mapping certified.
KPI-RET-005 PARTIAL_RETURN_COUNT — diagnostic.
KPI-RET-006 RECOVERY_AMOUNT — governed economic recovery.

Operational period return activity and sales-cohort quality rate must never share one ambiguous label "Return Rate".

## 10. Onboarding / operations

KPI-OPS-001 PLACEMENT_PENDING_COUNT
KPI-OPS-002 PLACEMENT_PENDING_OVER_24H_COUNT
KPI-OPS-003 PLACEMENT_PENDING_MEDIAN_HOURS
KPI-OPS-004 PLACEMENT_PENDING_P95_HOURS
KPI-OPS-005 PAPER_APPLICATION_COUNT
KPI-OPS-006 PAPER_ORDER_COUNT
KPI-OPS-007 PAPER_PAYMENT_CONFIRMATION_COUNT
KPI-OPS-008 PAPER_PAYMENT_REVERSAL_COUNT
KPI-OPS-009 EXISTING_MEMBER_LINE_LINK_PENDING_COUNT
KPI-OPS-010 LINE_LINK_COMPLETED_COUNT
KPI-OPS-011 COMPANY_SPONSOR_ALIAS_RESOLUTION_COUNT

Completed placement duration and open pending age are separate populations.
Payment confirmed does not equal membership activation.

## 11. Award / finance management

KPI-FIN-001 AWARD_AMOUNT
KPI-FIN-002 AWARD_PENDING_AMOUNT
KPI-FIN-003 AWARD_SETTLED_AMOUNT
KPI-FIN-004 AWARD_ADJUSTMENT_AMOUNT
KPI-FIN-005 AWARD_RECOVERY_AMOUNT
KPI-FIN-006 SETTLEMENT_GROSS_AMOUNT
KPI-FIN-007 SETTLEMENT_ADJUSTMENT_AMOUNT
KPI-FIN-008 SETTLEMENT_RECOVERY_AMOUNT
KPI-FIN-009 SETTLEMENT_NET_AMOUNT
KPI-FIN-010 PAYOUT_AMOUNT

These remain separate events. Natural-language "發多少獎金" is ambiguous and must be disambiguated or show clearly labeled generated/settled/paid values.
Finance detail privacy C2/C3 as mapped.
Reservoir is NOT a general management KPI and remains separate C3 restricted analytics.

## 12. ERP / fulfillment management

KPI-ERP-001 ERP_TRANSFER_PENDING_COUNT
KPI-ERP-002 ERP_TRANSFER_SUCCESS_COUNT
KPI-ERP-003 ERP_TRANSFER_FAILED_COUNT
KPI-ERP-004 ERP_TRANSFER_FAILURE_RATE
Future after governed import:
KPI-ERP-005 ERP_SHIPPED_COUNT
KPI-ERP-006 ERP_RETURN_POSTED_COUNT
KPI-ERP-007 ERP_IMPORT_REJECTED_ROWS

All reverse ERP metrics display truthSource + dataThrough + freshness.
No ERP data => UNKNOWN, not not-shipped.
ERP handoff success != shipment/invoice.

## 13. Governance / data health

KPI-GOV-001 CERTIFIED_METRIC_COUNT
KPI-GOV-002 UNMAPPED_APPROVED_DEFINITION_COUNT
KPI-GOV-003 OPEN_AUTHORITY_CONFLICT_COUNT
KPI-GOV-004 STALE_DATASET_COUNT
KPI-GOV-005 DEFINITION_DRIFT_BLOCK_COUNT
KPI-GOV-006 DRIVE_SYNC_PENDING_CHANGE_COUNT

These are deterministic governance health indicators, not subjective scores.

## 14. Dashboard structure v1

Executive Overview:
EX-001..009 only, plus concise trend/context. Keep headline count intentionally small.

Membership & Funnel:
MEM series + cohort views.

Organization:
ORG series with Tree/period/as-of filters.

Commerce & Product:
COM + PRD series.

Retail Referral:
RR series; Explain drill-down must expose theoretical/eligibility/payable/recovery separately.

Operations:
OPS + ERP queue/freshness.

Finance:
FIN series behind finance RBAC; Reservoir separate restricted surface.

Governance:
GOV series for Super Admin/Governance roles.

## 15. AI Brain question routing examples

"這個月新增多少會員？"
→ disambiguate WEB_MEMBER vs first-time QUALIFIED_MEMBER if context does not resolve.

"這個月發多少獎金？"
→ distinguish Award generated, Settlement finalized, Payout paid.

"推薦獎金為什麼是0？"
→ Retail Referral Explain: theoretical → eligibility → payable → recovery, without exposing unauthorized PII.

"退貨率多少？"
→ default to approved primary 30D_RETURN_UNIT_RATE only after certified; also offer operational posted-return activity when useful and label semantics.

"我的ERP訂單出貨了嗎？"
→ use last governed ERP fulfillment fact; state dataThrough/truthSource; UNKNOWN if no current evidence.

## 16. Certification and release rule

No KPI becomes an official Dashboard card/AI fact until every underlying metric is CERTIFIED.
KPI catalog approval does not equal data certification.
A KPI with REVIEW/UNMAPPED dependency may exist in Governance UI/design but not as official number.

## 17. Cross-layer maintenance

Any future KPI change triggers UCELL_CROSS_LAYER_CHANGE_GOVERNANCE_RULE_V1 and must assess Definition, Semantic Core, AI Brain, API, DB, Runtime, Tests/Golden, GitHub and Google Drive.
