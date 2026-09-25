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


## 17. Dataset registry v1 and security

MEMBER_LIFECYCLE — grain one Person; Person + authoritative membership-state projection; C2 detail/C1 safe aggregate.
BALL_ANALYTICS — grain one Ball; Qualification/Ball projection; C2; bootstrap policy mandatory.
TREE_ANALYTICS — grain governed tree×period/as-of projection; C1/C2 by measures; no arbitrary raw join.
ACTIVE_ANALYTICS — grain Ball×as-of/effective evidence or approved aggregate projection; source R1.0B Active Core.
COMMERCE_ANALYTICS — grain one recognized Order Line; C2 detail/C1 aggregate; excludes payment secrets.
PRODUCT_ANALYTICS — approved product/SKU dimensions over commerce projection.
RETURN_ANALYTICS — grain posted return line/effect; Return/Replay authority.
AWARD_ANALYTICS — grain Award Ledger entry; C2; beneficiary scope/RBAC.
RETAIL_REFERRAL_ANALYTICS — grain Retail Referral award/evidence or approved line projection; C2.
SETTLEMENT_ANALYTICS — grain Settlement entry; C2/C3 by fields.
ONBOARDING_ANALYTICS — governed lifecycle events for LINE/Paper/Qualification/Placement; C2; no raw identity document.
ERP_HANDOFF_ANALYTICS — grain ERP handoff/import fact; freshness mandatory.
FINANCE_RESERVOIR_ANALYTICS — C3 RESTRICTED; Admin/Finance governed only; absent from every Member tool/surface.

DatasetDefinition fields: datasetCode, description, grain, sourceProjection/view, allowedMeasures, allowedDimensions, allowedFilters, privacyClass, allowedRoles/policyRef, maxPeriodDays, maxRows, allowDetail, allowExport, freshnessSla, version/effective dates, lineageRef.

## 18. Privacy classification

C0 PUBLIC — approved public product/brand facts.
C1 INTERNAL — safe aggregate operational KPI/tree aggregate without sensitive economics/PII.
C2 CONFIDENTIAL — memberNo/ballNo linked operational detail, individual Ball performance/economics, order/award/settlement detail as governed.
C3 RESTRICTED — identity documents, phone/email/address where sensitive, LINE subject/tokens, bank data, security/recovery evidence, Reservoir/company-sensitive economics, secrets.

Rules:
- Full secrets/tokens/passwords/recovery tokens/private keys are NEVER analytics fields.
- Full bank/identity values are NEVER general analytics/AI fields.
- PII detail uses separate authorized tools/datasets; aggregate analytics defaults to identifiers/minimal fields.
- Member zero-disclosure for Reservoir and bootstrap #1–#3 is invariant.
- Privacy class unresolved => deny.
- Export permission cannot exceed interactive permission.

## 19. Rule Registry

RuleDefinition does not duplicate formulas where an authoritative service exists.
Required refs include:
R1_ACTIVE — authority existing R1.0B Active service/projection.
R1_SPONSOR — authority Sponsor Core/evidence.
R1_BINARY_PLACEMENT — authority Placement Core.
R1_PERFORMANCE — authority current GPV/RPV/EPV performance projection.
R1_CARRY — authority Carry Core/snapshot.
R1_RANK — authority current Rank Core.
R1_AWARD — authority Award engine/ledger.
R1_SETTLEMENT — authority Settlement/Payout Core.
R1_RETURN_REPLAY — authority Return/Replay/Recovery.
R1_RETAIL_REFERRAL — authority approved Retail Referral SSOT + implemented Economic Core.
P0_IDENTIFIER_PRIVACY — authority final P0 decision.
COMPANY_BOOTSTRAP — authority approved Company LEADER binding/current runtime parameters.

RuleDefinition fields: ruleCode, authorityType(SERVICE|PROJECTION|GOVERNANCE_SSOT), authorityRef, ruleVersion, effective dates, evidence/hash where available, semanticConsumers.
Semantic Core must not store old prose percentages/thresholds as a substitute for current runtime rule authority.

## 20. Data lineage

Every approved metric has lineage:
Metric → Dataset/Projection → authoritative fact/service → rule/evidence version.
Lineage nodes record source kind, schema/view/service ref, grain, join key/business identifier, transformation class, version, privacy class.
No approved metric may rely on undocumented arbitrary SQL.

Examples:
RETAIL_REFERRAL_AWARD_AMOUNT → AWARD_ANALYTICS → Award Ledger(RETAIL_REFERRAL) → Retail Referral rule/evidence → OrderLine snapshot + Active evidence.
ACTIVE_BALL_COUNT → ACTIVE_ANALYTICS → authoritative Active projection/service → R1_ACTIVE version.
BALL_COUNT → BALL_ANALYTICS → Ball/Qualification Core → P0 identifier/bootstrap scope.
ERP_TRANSFER_SUCCESS_COUNT → ERP_HANDOFF_ANALYTICS → UCell ERP transfer fact; does not lineage into EzTooL fulfillment unless import exists.

## 21. Definition dependency graph

definition_dependency stores fromDefinition, toDefinition, dependencyType (USES_METRIC, USES_DIMENSION, USES_DATASET, USES_RULE, LINEAGE_SOURCE, PRIVACY_POLICY).
Changing/deprecating a definition must enumerate impacted metrics, dashboards, exports and future AI tools.
Breaking semantic changes require a new version/effective date, not silent mutation.

## 22. Runtime storage design

Preferred PostgreSQL schemas:
- governance: definitions/versions/dependencies/approval metadata.
- analytics: internal projections/materialized views/jobs.
- analytics_ai (future): AI-safe approved views only; NOT part of Phase 1 runtime access until AI firewall is implemented.

Phase-1 logical tables (names may adapt to repository conventions after schema audit):
governance.definition
governance.definition_version
governance.metric_definition
governance.dataset_definition
governance.dimension_definition
governance.rule_definition
governance.privacy_definition
governance.definition_dependency
governance.data_lineage

Avoid one table per trivial concept if repository patterns favor typed JSON metadata; however enforce DB constraints for code/version/status/effective intervals and immutable approved versions.

## 23. Code-seeded vs DB-governed definitions

Immutable/system semantics (PERSON, BALL, SPONSOR vs BINARY_PARENT, identifiers, privacy invariants) are version-controlled code/governance seeds and cannot be freely edited in Admin.
Business metrics/datasets may be DB-registered/versioned but promotion to APPROVED requires governance workflow.
Runtime DB and Git governance evidence must have deterministic seed/hash verification to prevent drift.
Production must not allow arbitrary SQL/formula text to become APPROVED merely through UI.

## 24. Governance workflow / RBAC

Roles/capabilities should map to existing RBAC rather than create a parallel identity system:
- Analytics Viewer: read approved definitions allowed by data policy.
- Analytics Analyst: create DRAFT proposals.
- Governance Approver: review/approve semantic definitions within authority.
- Finance-governed approval for C3 finance/Reservoir definitions.
- Super Admin does not bypass audit/evidence requirements.

Approval:
DRAFT → REVIEW → APPROVED.
Requester should not self-approve high-risk C3/economic semantic changes where existing governance supports dual control.
Every transition records actor, timestamp, reason, previous hash/new hash.

## 25. Definition API v1

Read endpoints for approved definitions:
GET /api/v1/governance/definitions/terms
GET /api/v1/governance/definitions/entities
GET /api/v1/governance/definitions/relationships
GET /api/v1/governance/definitions/dimensions
GET /api/v1/governance/definitions/metrics
GET /api/v1/governance/definitions/metrics/{code}
GET /api/v1/governance/definitions/datasets
GET /api/v1/governance/definitions/rules/{code}
GET /api/v1/governance/definitions/lineage/{code}

Admin mutation endpoints, if implemented in Phase 1, only manage DRAFT/REVIEW lifecycle and must use RBAC/audit/idempotency. System-seeded invariants cannot be overwritten.

## 26. Semantic Golden suite

A new Semantic Golden layer is required in addition to Economic Golden.

Mandatory assertions:
- PERSON_COUNT counts Persons, never Balls.
- NEW_QUALIFIED_MEMBER_COUNT does not increment for a second Ball.
- NEW_BALL_COUNT does increment for additional effective Ball.
- default Member/business BALL_COUNT excludes bootstrap #1–#3; explicit governed Admin scope can include them.
- non-direct PII/Reservoir/bootstrap privacy remains unchanged.
- WEB_MEMBER and QUALIFIED_MEMBER derive from effective Qualification state, not login/LINE friendship.
- Sponsor != Binary Parent.
- Retail Referrer != Sponsor.
- RETAIL_REFERRAL official amount equals authoritative Award result, not semantic recomputation.
- inactive Retail Referrer historical eligibility is not reconstructed from current Active.
- Return metrics use POSTED returns only.
- Award/Settlement/Payout remain distinct.
- ERP handoff success does not imply shipment.
- ZERO/NULL/UNKNOWN behavior.
- Rate storage/presentation convention.
- Taipei time boundary for memberNo/calendar periods.
- definition version/as-of reproducibility.
- privacy classification fail-closed.
- lineage exists for every APPROVED metric.

Metrics explicitly marked DRAFT/DECISION_REQUIRED must not be exposed as official KPI.

## 27. Freshness / quality metadata

Every Dataset/metric result carries:
definitionVersion, ruleVersion where applicable, asOf, dataThrough, refreshedAt, freshnessStatus.
Freshness statuses: FRESH, STALE, UNKNOWN.
Manual ERP imports expose lastImportAt.
Quality checks: duplicate grain key, missing dimension key, orphan business ID, projection lag, invalid effective interval, definition hash drift.
UNKNOWN/STALE must be visible to Admin consumers.

## 28. Query safety contract for future AI

Phase 1 prepares but does not implement LLM.
Future consumers MUST:
- use approved Metric/Dataset Registry only;
- never receive Production DB credentials;
- never execute free-form SQL;
- use server-side governed query DSL/compiler;
- enforce RBAC/privacy before retrieval;
- cap rows/time/cardinality;
- aggregate/mask before LLM;
- treat retrieved text as untrusted DATA, never instructions;
- keep first AI release read-only;
- preserve evidence/asOf/dataThrough/definition versions;
- separate Codex development workflow from Production AI runtime.

## 29. Admin Data Governance Center (Phase 1 scope)

Admin read UI should show:
Business Terms, Entities, Relationships, Dimensions, Metrics, Datasets, Rules, Privacy, Lineage.
Metric detail shows definition, status/version, grain, time basis, unit, source authority, rule reference, privacy, dimensions, freshness and Golden status.
DRAFT items visibly marked non-official.
C3/Reservoir metadata itself follows RBAC; Member has no route/tool/surface.

## 30. Explicit unresolved decisions — DO NOT GUESS

The following require mapping/approval before official metric status:
- exact order statuses defining ORDER_COUNT/recognized sales;
- exact sales recognition timestamp if not already explicit in Core;
- NET_RECOGNIZED_SALES return timing/accounting semantics;
- RETURN_UNIT_RATE and RETURN_AMOUNT_RATE cohort/period alignment;
- WEB_TO_QUALIFIED_CONVERSION_RATE cohort/window/eligible denominator;
- PLACEMENT_PENDING_AVG_HOURS start/end/exclusion policy;
- any new Rank label/threshold not already authoritative in R1.0B runtime;
- any old PV/BV/bonus prose not present in current R1.0B authority;
- OA friend count until LINE source/evidence is available;
- EzTooL shipment/invoice truth until imported or integrated.

These definitions remain DRAFT/DECISION_REQUIRED. Their absence MUST NOT block Phase 1 registry foundation.

## 31. Implementation order

Phase SG-A1 — Audit existing schema/projections/metrics and map exact source authority. No migrations until audit.
Phase SG-A2 — Governance registry schema + deterministic seeds + hashes + RBAC/audit.
Phase SG-A3 — Dataset/Metric/Rule/Privacy registry APIs and Data Governance read UI.
Phase SG-A4 — Semantic Golden + lineage/freshness/quality gates.
Phase SG-A5 — Only after closure: governed Analytics Query Engine.
AI Data Assistant starts only after Query Engine security closure.

## 32. Release gates

Required before Semantic Core Phase 1 closure:
- forward-only migrations/fresh migration PASS;
- deterministic seed/hash drift PASS;
- no old R1.0B rules introduced;
- P0 privacy Golden PASS;
- existing Economic Golden unchanged;
- Semantic Golden PASS;
- definition lifecycle/RBAC/BOLA PASS;
- C3/Reservoir denial PASS;
- approved version immutability PASS;
- OpenAPI regenerate/validate/diff PASS;
- Backend/Admin/Shared full regression PASS;
- no LLM/AI provider credentials;
- no free SQL;
- no Stage/Production mutation.

## 33. Deliverables

UCELL_SEMANTIC_GOVERNANCE_CORE_IMPLEMENTATION_REPORT.md
UCELL_SEMANTIC_GOVERNANCE_CORE_PASS_FAIL_MATRIX.md
UCELL_SEMANTIC_GOVERNANCE_CORE_DATA_DICTIONARY.md
UCELL_SEMANTIC_GOLDEN_CATALOG.md
UCELL_DATA_LINEAGE_CATALOG.md
UCELL_ANALYTICS_DATASET_CATALOG.md
Update IMPLEMENTATION_STATUS.md and OpenAPI artifacts.

## 34. Self-review checklist

Before closure verify:
- no Person/Ball conflation;
- no Sponsor/Binary Parent/Retail Referrer conflation;
- no current-state reconstruction of historical Active/economic truth;
- no bootstrap 1–3 Member leakage;
- no Reservoir Member leakage;
- no UUID promoted to operational identifier;
- no LINE friend/login equated with formal member;
- no payment equated with qualification activation before placement;
- no Retail Referral double-award for QUALIFIED_MEMBER under v1 policy;
- no stale ERP data described as current;
- no rate stored inconsistently;
- no money float;
- no undefined denominator hidden inside a rate;
- no unversioned approved metric;
- no metric without lineage/privacy/grain/time basis/Golden.


## 35. Fact Registry — required semantic layer

FactDefinition is added as a first-class registry between Core truth and Dataset/Metric. Metrics MUST NOT depend directly on accidental physical table names when a stable business fact can be defined.

Fact kinds:
- EVENT: something happened at a business timestamp.
- STATE: effective state valid as-of a point/interval.
- SNAPSHOT: authoritative captured state at a specific as-of.
- LEDGER: append-only economic/accounting effect.

FactDefinition fields:
factCode, nameZh/nameEn, factKind, businessDefinition, authorityRef, grain, eventTime/effectiveTime/asOf semantics, businessKeys, requiredEvidence, ruleRef/ruleVersion, privacyClass, scopePolicyRef, sourceMapping, version/effective dates, status, lineageRef.

Initial Fact Catalog (source mappings MUST be verified by SG-A1 before APPROVED):
- PERSON_REGISTERED — EVENT — Person Core.
- WEB_MEMBER_EFFECTIVE — EVENT — membership-state authority.
- QUALIFICATION_ORDERED — EVENT — Order/Qualification Core.
- PAYMENT_CONFIRMED — EVENT — Payment authority.
- PLACEMENT_COMMITTED — EVENT — Binary Placement Core.
- QUALIFICATION_ACTIVATED — EVENT — Qualification Core.
- BALL_STATE — STATE — Ball/Qualification Core.
- ACTIVE_STATE — STATE — R1.0B Active authority.
- PERFORMANCE_SNAPSHOT — SNAPSHOT — R1.0B performance authority.
- CARRY_SNAPSHOT — SNAPSHOT — Carry authority.
- RANK_STATE — STATE — Rank authority.
- ORDER_RECOGNIZED — EVENT — Commerce authority; exact recognition mapping must be audited.
- RETURN_POSTED — EVENT — Return Core.
- AWARD_RECOGNIZED — LEDGER/EVENT — Award authority.
- AWARD_ADJUSTED — LEDGER — Award/Adjustment authority.
- RECOVERY_RECOGNIZED — LEDGER — Recovery authority.
- SETTLEMENT_FINALIZED — EVENT — Settlement authority.
- PAYOUT_PAID — EVENT — Payout authority.
- RETAIL_ATTRIBUTION_EFFECTIVE — STATE/EVENT — Retail attribution authority.
- LINE_BINDING_EFFECTIVE — STATE — Identity authority; C3 details excluded from general analytics.
- ERP_ORDER_TRANSFERRED — EVENT — UCell ERP Adapter.
- ERP_STATUS_IMPORTED — EVENT — governed ERP import, if implemented.

A Fact stays DRAFT if exact source event/state semantics cannot be proven from current Core.

## 36. Scope Registry — meaning is not the same as permission

ScopeDefinition is a first-class registry. Scope defines what population/data meaning is included; RBAC defines who may request it. A privileged role MUST NOT silently change the meaning of a named metric.

Initial scopes:
- MEMBER_VISIBLE — applies Member privacy semantics; bootstrap #1–#3 and Reservoir absent.
- ADMIN_OPERATIONS — operational population approved for Operations.
- ADMIN_SUPPORT — support-safe operational scope with minimized economics/PII.
- ADMIN_FINANCE — finance-governed scope; C3 only where explicitly authorized.
- ADMIN_AUDIT — audit/evidence scope; still no secret/token exposure.
- SYSTEM_INTERNAL — service-only scope; never implies Member/Admin UI permission.

MetricDefinition and DatasetDefinition MUST declare allowed/default scopes. Example: a metric explicitly named/member-scoped as MEMBER_VISIBLE_BALL_COUNT cannot include bootstrap nodes merely because a Finance user executes it.

## 37. Metric kind firewall

MetricKind is refined:
- OBSERVED — deterministic aggregation of approved Fact/Dataset.
- DERIVED — calculation using approved Metrics with declared dependency graph.
- AUTHORITATIVE_ECONOMIC — value must come from R1.0B Core projection/service/ledger; semantic layer cannot recompute it.

Examples:
ORDER_COUNT = OBSERVED after order recognition mapping is approved.
AOV = DERIVED from NET_PAID_PRODUCT_AMOUNT / ORDER_COUNT.
ACTIVE_BALL_COUNT, TREE_GPV/RPV/EPV, LEFT/RIGHT_CARRY, authoritative Rank/Award values = AUTHORITATIVE_ECONOMIC.

Query/AI consumers MUST be blocked from substituting an ad-hoc derived calculation for an AUTHORITATIVE_ECONOMIC metric.

## 38. Semantic identity and naming

Every definition has:
- immutable code;
- version;
- stable canonical name;
- localized labels;
- optional approved aliases.

Aliases do not create new metrics. Example "新球" may resolve to NEW_BALL_COUNT only after glossary approval.
Codes are case-normalized and globally unique within definition type. Deprecated definitions remain resolvable for historical evidence but are not offered for new official analysis.

## 39. Historical truth policy

Historical analysis MUST prefer historical evidence/snapshot/effective version over current state reconstruction.
Forbidden examples:
- use current Active to decide a historical Retail Referral eligibility;
- use current member status to classify an old retail order;
- use current SKU referral rate to recompute an old order;
- use current Rank thresholds to rewrite historical rank;
- use current holder identity to imply historical holder if ownership history differs.

If historical evidence is absent, result is UNKNOWN/UNAVAILABLE, not guessed.

## 40. Join safety and fan-out firewall

DatasetDefinition declares grain and approved joins. Query engines MUST prevent unsafe many-to-many fan-out.
ApprovedJoin metadata:
leftDataset, rightDataset, joinKey, cardinality(1:1,1:N,N:1), temporalJoinPolicy, allowedMeasuresAfterJoin, privacyImpact.

Examples:
- Person→Ball is 1:N; PERSON_COUNT after Ball join requires distinct Person-safe semantic aggregation.
- Order→OrderLine is 1:N; ORDER_COUNT must remain distinct Order.
- OrderLine→Award may be 1:N; product sales must not multiply by award rows.

Unknown cardinality => query denied until mapped.

## 41. Definition quality score / readiness

Do not create subjective business rankings. Internally, implementation readiness is a deterministic checklist, not an evaluative score.
A definition is OFFICIAL_READY only when all required booleans are true:
authorityMapped, grainDefined, timeBasisDefined, scopeDefined, privacyDefined, lineageDefined, versioned, goldenCovered, freshnessDefined, RBACMapped.
Otherwise status remains DRAFT/REVIEW/DECISION_REQUIRED as applicable.

## 42. Consumer contract

Every governed analytics response should carry:
metricCode, metricVersion, value, unit, scopeCode, period/asOf, dataThrough, refreshedAt, freshnessStatus, ruleVersion where applicable, result/evidence reference.
Dashboard, export and future AI must preserve these fields or equivalent metadata.
A chart title alone is not a semantic contract.

## 43. Audit of definition changes

Definition audit events:
DEFINITION_DRAFT_CREATED
DEFINITION_SUBMITTED
DEFINITION_APPROVED
DEFINITION_DEPRECATED
DEFINITION_RETIRED
DEFINITION_SEED_DRIFT_DETECTED
LINEAGE_CHANGED
PRIVACY_CLASS_CHANGED
SCOPE_CHANGED

Audit stores actor, reason, old/new hashes, effective date and approval evidence; it must not store secrets or raw C3 payloads.

## 44. Additional Semantic Golden cases

Add:
- EVENT vs STATE vs SNAPSHOT semantics cannot be interchanged.
- current Active cannot answer historical ACTIVE_STATE without historical evidence.
- MEMBER_VISIBLE scope remains invariant regardless caller privilege.
- Finance role does not mutate a metric's scope.
- Person→Ball join does not multiply PERSON_COUNT.
- Order→OrderLine join does not multiply ORDER_COUNT.
- OrderLine→Award join does not multiply sales.
- AUTHORITATIVE_ECONOMIC metric cannot be overridden by ad-hoc formula.
- missing historical evidence => UNKNOWN/UNAVAILABLE.
- alias resolution cannot bypass metric version/status/privacy.
