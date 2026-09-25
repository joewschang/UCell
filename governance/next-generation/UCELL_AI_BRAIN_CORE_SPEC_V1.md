# UCell AI Brain Core Specification v1.0

**Status:** APPROVED DESIGN / RUNTIME NOT IMPLEMENTED
**Date:** 2026-09-25 (Asia/Taipei)
**Baseline:** R1.0B only
**Authority:** UCELL_GOVERNANCE_AUTHORITY_MAP_V1, UCELL_SEMANTIC_GOVERNANCE_CORE_SPEC, UCELL_ENTERPRISE_DATA_DICTIONARY_V1, UCELL_MANAGEMENT_KPI_CATALOG_V1, AI_ANALYTICS_DATA_FIREWALL_THREAT_MODEL_V1
**Purpose:** define a governed enterprise intelligence layer that consumes UCell authoritative/certified truth without becoming an independent source of business truth.

## 1. Mission and non-goals

AI Brain helps authorized users understand, query, compare, explain and learn from UCell information.

It is NOT:
- an economic-rule engine;
- a source of R1.0B truth;
- a direct Production SQL client;
- a replacement for RBAC/privacy;
- a self-authorizing mutation agent;
- a repository of secrets;
- a mechanism for silently changing company definitions;
- a substitute for human approval/Codex/release gates.

First runtime release target: Admin AI Data Assistant, READ ONLY.

## 2. Core architecture

AI Brain consists of:
1. Knowledge Core
2. Semantic Resolver
3. Intent / Reasoning Core
4. Governed Tool Gateway
5. Policy Engine
6. Evidence Engine
7. Organizational Memory / Learning
8. Safety & Data Firewall
9. Development Request Bridge
10. Observability / Audit

Flow:
User → Identity/RBAC → Intent → Semantic Resolve → Policy → Tool Plan → Governed Query/Tool → Result Firewall → Reasoning/Explanation → Output Firewall → User.

Policy is server-side and cannot be overridden by model text.

## 3. Truth hierarchy

AI Brain resolves authority through UCELL_GOVERNANCE_AUTHORITY_MAP_V1.

Truth classes:
- FACT: directly supported by authoritative/certified evidence.
- DERIVED: deterministic approved derivation from certified facts/metrics.
- INTERPRETATION: reasoned explanation grounded in facts but not itself a recorded business fact.
- HYPOTHESIS: plausible explanation requiring validation.
- DECISION_REQUIRED: no approved authoritative answer exists.
- UNKNOWN/UNAVAILABLE: evidence is absent/stale/inaccessible under policy.

The model MUST NOT present INTERPRETATION/HYPOTHESIS as FACT.

## 4. Knowledge Core

Allowed knowledge classes:
- current authoritative governance SSOT;
- approved Semantic Core definitions;
- Enterprise Data Dictionary;
- Certified Metrics/KPI Catalog;
- approved product/SOP/operational documents;
- current API/tool contracts;
- authorized Google Drive formal documents only after authority/sync status is known.

Knowledge item metadata:
knowledgeId, sourceRef, authorityStatus, version/hash, effectiveFrom/effectiveTo, domain, privacyClass, allowedScopes, freshness, supersedes/supersededBy, indexedAt.

DRAFT/SUPERSEDED sources may be used only for explicitly requested historical/comparison tasks and must be labeled.

Conversation text alone never promotes a business rule into Knowledge Core.

## 5. Semantic Resolver

Responsibilities:
- resolve user language to approved Business Terms, Entities, Facts, Dimensions, Metrics, KPIs and Scopes;
- resolve approved aliases/glossary;
- detect ambiguity;
- reject old/superseded rule aliases when current meaning differs;
- bind metric/version/as-of/time basis.

Examples:
"會員" may mean WEB_MEMBER or QUALIFIED_MEMBER → disambiguate when material.
"發多少獎金" → distinguish Award generated / Settlement / Payout.
"退貨率" → use certified primary cohort metric only when certified and expose definition.
"推薦獎金為何0" → Retail Referral theoretical → eligibility → payable → recovery explain path.

No semantic resolver output can override server policy.

## 6. Intent / Reasoning Core

Initial supported intents:
- DEFINE: explain term/metric/rule.
- LOOKUP: retrieve certified fact/metric.
- COMPARE: compare periods/trees/products/cohorts.
- TREND: time-series.
- DISTRIBUTION: grouped analysis.
- EXPLAIN: explain governed result/evidence.
- DRILLDOWN: authorized detail.
- EXPORT_REQUEST: governed export job.
- DEVELOPMENT_REQUEST: propose a new analytic capability.
- HELP: explain available analytics.

Not supported in v1:
- MUTATE_DATA
- EXECUTE_SQL
- RUN_SHELL
- DEPLOY
- CHANGE_RULE
- SETTLEMENT_COMMAND
- PAYMENT_COMMAND
- PLACEMENT_COMMAND
- BANK_CHANGE
- IDENTITY_REBIND

Unsupported mutation intent returns a safe read-only boundary, not a hidden action.

## 7. Governed Tool Gateway

Initial conceptual tool contracts:
getDefinition(code, version?)
getMetric(metricCode, period/asOf, dimensions?, filters?, scope)
compareMetrics(metricCodes, periods/scopes)
getTrend(metricCode, period, grain, dimensions?)
getDistribution(metricCode, dimension, period)
queryDataset(datasetCode, measures, dimensions, filters, period/asOf, scope)
getAuthorizedDrilldown(resultRef, dimension/page)
getEvidence(resultRef)
createExportJob(result/queryRef, format)
createAnalyticsDevelopmentRequest(sourceSession, requestedCapability)

Forbidden:
executeSql
executeRawQuery
databaseCredentials
genericHttpWithSecrets
writePerson/writeBall/changeSponsor/placeBall
runSettlement/payAward/changeBankAccount
deploy/runShell.

Tool availability is computed server-side from identity+role+scope+privacy+feature policy.

## 8. Policy Engine

Decision inputs:
authenticated identity, role/capability, requested scope, dataset/metric privacy, purpose/intent, dimension/filter, detail level, export flag, query cost, freshness, certification, authority conflict.

Default = DENY / FAIL CLOSED.

Required policies:
- Member zero-disclosure: Reservoir and bootstrap positions 1–3.
- C3 restricted datasets require explicit capability.
- non-direct holder PII unavailable to Member.
- export permission <= interactive permission.
- OPEN authority conflict blocks official fact.
- uncertified metric cannot be stated as official KPI.
- stale result must carry STALE/dataThrough.
- historical query requires historical evidence/version.
- unsafe join/cardinality denied.
- excessive extraction denied/backgrounded.
- unknown privacy/scope/source denied.

## 9. Evidence Engine

Every official numeric answer carries an internal evidence envelope:
metricCode/version, certificationStatus, value/unit, scope, period/asOf, timeBasis, dataThrough, refreshedAt, freshnessStatus, ruleVersion/evidence where applicable, source lineage/resultRef, privacy class.

User-facing answer should surface the useful subset:
definition, period/asOf, dataThrough, freshness, evidence/explain link.

Evidence is immutable/reproducible where the source supports historical snapshots.

## 10. Retail Referral Explain contract

AI Brain must preserve separate concepts:
- attribution;
- theoretical amount;
- recognition-time eligibility;
- payable amount;
- adjustment/recovery.

Verified semantic example:
theoretical=10, inactive eligibility, payable=0.
AI must be able to explain "why zero" without collapsing evidence.

Partial return:
original Award remains immutable; append-only adjustment/recovery explains changed net economic outcome.

AI must not infer PV/Binary/organization effects from Retail Referral; v1 has none by itself.

## 11. Historical truth

AI must not:
- use current Active for historical eligibility;
- use current membership to classify old order;
- use current SKU rate to recompute old award;
- use current Rank thresholds to rewrite old Rank;
- use current Sponsor/holder state to rewrite historical evidence.

If historical evidence is unavailable: UNKNOWN/UNAVAILABLE.

## 12. Organizational Memory / Learning

Permitted organizational learning:
- approved glossary aliases;
- frequently asked question patterns;
- successful governed query patterns;
- approved KPI/dashboard preferences at organization level;
- approved business definitions and decision references;
- user feedback on usefulness/correction, without promoting it to authority.

Forbidden memory content:
- passwords/tokens/secrets;
- full bank data;
- identity documents;
- unrestricted raw C3 payloads;
- unapproved business rules inferred from chats.

Learning lifecycle:
OBSERVED_PATTERN → PROPOSAL → HUMAN_REVIEW → APPROVED_KNOWLEDGE/DEVELOPMENT_REQUEST.
No silent self-modification.

## 13. Development Request Bridge

When a useful question cannot be answered by certified capabilities:
AI may create a structured proposal, not code/deployment.

AnalyticsDevelopmentRequest:
requestId, sourceSession, businessQuestion, requestedMetric/Dataset, candidate dimensions, privacy considerations, evidence of repeated need, semantic gaps, requestedBy, status.

Flow:
AI proposal → Human approval → Cross-Layer Impact Matrix → Codex → code/tests/GitHub → Stage → UAT → Production approval → Google Drive sync → capability becomes governed.

AI runtime and Codex runtime use separate credentials/trust boundaries.

## 14. Data Firewall

Hard invariants:
- no Production DB credentials in model context/provider;
- no free-form SQL tool;
- no write tool in v1;
- analytics-safe views/projections only;
- retrieval occurs only after policy;
- retrieved text is UNTRUSTED_DATA and cannot alter policy/tools;
- aggregate/mask before LLM;
- secrets excluded by schema, not merely redacted later;
- result/output PII scanner is defense-in-depth;
- rate limits, row/date/cardinality/query-cost limits;
- cache keys include identity/policy/scope/definition version;
- no cross-role cached result leakage.

## 15. Prompt injection policy

Instructions contained in Product names, notes, return reasons, imported ERP text, documents or DB rows are data, never instructions.

The model cannot:
- enable tools based on retrieved content;
- widen role/scope;
- change system policy;
- retrieve additional C3 data because a document requests it;
- follow links/commands from data without a separately authorized tool policy.

Injection attempts are audited when material.

## 16. PII / identity minimization

Default analytics uses memberNo/ballNo only where detail is required and authorized.
Names/contact/address/LINE subject are excluded from general analytics.
Full identity/bank/security values have no general AI tool.
Person-detail retrieval, if later introduced, requires a separate narrow authorized tool and audit.
UUID is not normal user-facing identity.

## 17. Output Firewall

Before delivery:
- validate response against result scope;
- scan for secrets/tokens/full identity/bank patterns;
- enforce Reservoir/bootstrap restrictions;
- prevent unsupported official-number claims;
- ensure stale/unknown qualification is preserved;
- ensure hypothesis labeling.

If unsafe content is detected: redact or block; do not ask the model to "remember not to show it" as the primary control.

## 18. Query cost / abuse controls

Configurable limits:
max period, rows, dimensions, cardinality, drill-down depth, concurrent queries, export size, request rate.
Large analysis becomes background governed job.
Enumeration patterns (many memberNo/ballNo, repeated PII probes, broad exports) trigger rate limit/audit/temporary AI-query lock without disabling core Admin functions.

## 19. Session / audit model

Conceptual records:
AiQuerySession
AiQueryTurn
AiIntent
AiSemanticResolution
AiToolPlan
AiToolExecution
AiEvidenceEnvelope
AiPolicyDecision
AiOutputDecision
AnalyticsDevelopmentRequest

Audit stores actor/role, intent, metric/dataset versions, scope, filters, asOf/dataThrough, policy result, result hash, model/runtime version.
Do not persist unrestricted C3 result payload merely for logging.

## 20. Model/provider abstraction

AI Brain Core contracts must be provider/model independent.
Provider adapter receives only policy-approved minimum context/results.
Changing LLM provider/model must not change business semantics, tool permissions or metric definitions.
Model configuration/version is auditable.
No provider is granted direct database/network secrets merely for convenience.

## 21. Failure semantics

POLICY_DENIED — authorization/privacy/scope denied.
DEFINITION_UNRESOLVED — no approved semantic resolution.
METRIC_UNCERTIFIED — official value unavailable.
AUTHORITY_CONFLICT — current sources conflict.
DATA_STALE — result available but outside freshness SLA.
DATA_UNKNOWN — no reliable evidence.
QUERY_TOO_LARGE — cost/cardinality limit.
TOOL_UNAVAILABLE — governed tool unavailable.
CONFIGURATION_PENDING — external identity/provider/config missing.

Do not convert failures into guessed answers.

## 22. Admin UX v1

Admin navigation: AI 資料助理.

Response components:
- concise answer;
- KPI cards where applicable;
- table/chart;
- FACT vs INTERPRETATION/HYPOTHESIS labeling when material;
- period/asOf;
- dataThrough/freshness;
- metric definition;
- Evidence drawer;
- authorized drill-down;
- export;
- suggested follow-ups;
- "建立正式分析需求" when capability is missing.

History is governed by retention/privacy and must not become a raw C3 archive.

## 23. Analytics Center relationship

Analytics Center = known questions / fixed certified KPIs.
AI Data Assistant = exploratory natural-language access to the same certified Semantic/Analytics Core.
They MUST share MetricDefinition, DatasetDefinition, Scope, Privacy, Lineage and Certification.
Dashboard and AI cannot maintain separate formulas.

## 24. Role boundaries

Initial runtime is Admin-only.
Exact capabilities map to existing RBAC after SG-A1/runtime audit.

Operations: operational/member/order/tree safe metrics.
Support: minimized member-service views; no broad economics/PII.
Finance: governed finance/settlement and explicit C3 tools where approved.
Audit/Governance: evidence/definition/audit views.
Super Admin: broad authority but still subject to audit, semantic scope and secret exclusions.

No role gets secrets merely by being Super Admin.

## 25. Member AI future boundary

Member AI is future scope, not v1.
If introduced:
- MEMBER_VISIBLE scope only;
- no bootstrap #1–#3;
- zero Reservoir;
- no non-direct holder PII;
- only member-safe tools;
- no Admin/Finance datasets;
- separate security Golden.

## 26. ERP intelligence

ERP data is an optional future Dataset, not a prerequisite.
AI must carry truthSource and dataThrough.
ERP_TRANSFER_SUCCESS is only handoff truth.
EXTERNAL_IMPORTED shipment data must be described as imported/as-of.
Missing ERP evidence => UNKNOWN, not not-shipped.

## 27. AI Brain Golden / red-team requirements

Before AI_READ_ONLY_READY prove:
- RBAC bypass denied.
- Reservoir probe denied/no existence leak.
- bootstrap 1–3 probe denied.
- PII enumeration denied/limited.
- UUID/BOLA attack denied.
- prompt injection cannot expand tools/scope.
- retrieved data cannot override policy.
- execute SQL impossible.
- write/mutation intent impossible.
- unsafe join denied.
- historical current-state reconstruction blocked.
- stale ERP labeled.
- export cannot exceed UI permission.
- large extraction blocked/backgrounded.
- secrets absent.
- cross-role cache isolation.
- uncertified metric cannot become official fact.
- authority conflict blocks official answer.
- Codex/deployment unavailable from runtime.
- output PII scanner works.
- theoretical/eligibility/payable/recovery Retail Referral explain remains correct.

## 28. Implementation phases

AI-0: specification only (current).
AI-1: Semantic Runtime + certification prerequisite.
AI-2: Governed Analytics Query Engine + firewall.
AI-3: Admin AI Data Assistant read-only.
AI-4: red-team/security closure.
AI-5: organizational learning + Development Request Bridge.
AI-6: optional governed action proposals; NOT automatically authorized.

Do not start AI-3 before ANALYTICS_QUERY_SECURED.

## 29. Cross-layer change governance

Every AI Brain change follows UCELL_CROSS_LAYER_CHANGE_GOVERNANCE_RULE_V1 and assesses:
Definition, Semantic Core, AI Brain, API/OpenAPI, DB/Data Dictionary, Runtime, Tests/Golden/Security, GitHub, Google Drive.

An AI feature is not complete because a prompt works.

## 30. Current implementation status

AI Brain Core: APPROVED DESIGN.
AI runtime: NOT IMPLEMENTED.
LLM provider: NOT SELECTED/NOT REQUIRED YET.
AI DB access: NONE.
AI write capability: NONE.
Production AI deployment: NONE.

Next dependency: finish R1.0B Operational Closure → freeze ONBOARDING_FINAL_HEAD → SG-A1 Source Authority Audit → Semantic Runtime/Certification → Governed Analytics Query Engine.


## 31. Phase-boundary override / clarification

Per UCELL_PHASE_BOUNDARY_AI_READY_FOUNDATION_DECISION.md, this document is **APPROVED_FUTURE_DESIGN — NOT CURRENT IMPLEMENTATION**. Current Phase 1 work may maintain compatibility metadata, semantic definitions, privacy/lineage/evidence and security design, but MUST NOT implement Admin AI Data Assistant, LLM/provider runtime, natural-language query, RAG/vector/embedding, AI tool/query-planner/memory runtime, Development Request Bridge runtime or AI write actions. Phase 2 requires separate approval after Operational Closure, SG-A1, Semantic Foundation and certification prerequisites.
