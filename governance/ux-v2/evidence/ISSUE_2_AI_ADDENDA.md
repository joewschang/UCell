Source: https://github.com/joewschang/UCell/issues/2#issuecomment-5721760042

## Product Owner / SA addendum — AI Core: Member Service + Admin Data Copilot

Add AI Core to the Phase-1 Architecture Review package. AI is not a monetary engine or source of truth. Core Engine remains authoritative; AI performs Understand -> Navigate -> Explain -> Analyze -> Detect -> Recommend, with write/actions deferred to a later explicitly approved phase.

Create mandatory Phase-1 deliverable:
`governance/ux-v2/AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC.md`

### 1. Product split
Design two experiences over one governed AI platform:

**Member AI Service** — personal support inside Member/LIFF:
- navigation/help;
- approved制度/FAQ/product/content knowledge;
- current selected Qualification/Ball status;
- Active explanation;
- organization/performance explanation;
- bonus/settlement/payout explanation;
- order/status/support guidance.

**Admin Data Copilot** — natural-language operations/analytics assistant:
- query authoritative Analytics Center metrics;
- explain Tree/founding-Ball statistics;
- explain return/rank/bonus/K/Carry/Reservoir/settlement/replay facts;
- compare periods/Trees/cohorts;
- surface deterministic alerts and explain drivers;
- prepare reports/views.

AI MVP is READ-ONLY. No autonomous Core mutation.

### 2. Architecture boundary
Specify a provider-independent architecture:
`Member/Admin UI -> AI Orchestrator -> UCell AI Tool Gateway -> Authorization/Policy/Audit -> Approved Core/Analytics Read APIs + Approved Knowledge RAG`.

Explicitly prohibit direct LLM-generated SQL against production PostgreSQL. AI may access only approved tools/read contracts with server-side authorization.

### 3. Authoritative truth rule
AI must never independently calculate or assert official GPV/RPV/EPV, Active, Carry, Pair, Award, K0/K1/K2, Reservoir A/B, Recovery/Clawback, settlement or payout as source of truth. It consumes authoritative evidence/read models and explains them.

For explainability, prefer backend-provided calculation/evidence fields. Any arithmetic rendered for explanation is a presentation of authoritative inputs/results, not a second monetary engine.

### 4. Member AI context and Ball isolation
AI session context must include, at minimum where applicable:
- authenticated Person;
- selected Qualification/Ball;
- BinaryTree context when relevant;
- locale;
- Asia/Taipei timezone;
- authorization scope;
- session/correlation ID.

A query such as `我的左區多少？` must resolve against the selected Ball only. AI cannot aggregate or switch Balls implicitly. If context is ambiguous, ask/offer a Ball selection rather than guessing. Backend BOLA/ownership enforcement remains mandatory even if the model supplies a foreign ID.

### 5. Member AI initial intents
Specify tool contracts for at least:
- Navigate — where/how to find a function;
- ExplainActive;
- ExplainPerformance (GPV/RPV/EPV business-language first);
- ExplainBinary/Carry;
- ExplainAward;
- ExplainSettlement/Payout;
- Qualification portfolio/status;
- Order/payment/delivery status where authoritative;
- Return process/status;
- Approved制度/FAQ/product/content knowledge.

Member AI must not expose Admin-only Reservoir/settlement internals beyond member-authorized explanation evidence.

### 6. Explain Award pattern
Define a reusable AI response contract: human explanation + authoritative result + evidence links/deep-links. Example flow: selected Award -> backend Explain read model -> source volume/theory/K/result/status/payout -> natural-language explanation -> `查看計算明細` deep-link. Do not have the model recompute the award from raw organization data.

### 7. Admin Copilot analytics semantic layer
Create an `AI Semantic Layer / Metric Catalog` design shared with `MANAGEMENT_ANALYTICS_AND_BI_SPEC.md`.

Each metric definition must include:
- stable metric key;
- display name/description;
- grain;
- numerator/denominator where applicable;
- authoritative source/read model;
- valid dimensions/filters;
- event/effective timestamp semantics;
- timezone/period boundaries;
- historical/as-of behavior;
- replay/return behavior;
- rounding/null semantics;
- RBAC/data classification.

Examples: RETURN_AMOUNT_RATE, ACTIVE_RATE, MONTHLY_NEW_BALLS, GPV, LEFT_CARRY, K1, RESERVOIR_B_INFLOW. AI must not invent a new definition for an existing metric.

### 8. Query-plan confirmation
For broad/ambiguous Admin questions, design a query-plan preview/confirmation mechanism. Example: period, Tree scope, grain (Qualification vs Person), bonus basis (Finalized vs Paid), Company Balls included/separate, selected metric definitions. Low-risk unambiguous reads may execute directly; broad financial/organization comparisons should expose the interpreted scope so users can correct it.

### 9. AI-generated charts/tables
AI may request/render charts/tables only from Analytics API results. Chart data must retain metric key, period, filter scope and updatedAt/evidence metadata. No invented data, no browser-side official metric recomputation.

### 10. Detect / Alert boundary
Deterministic analytics/rule services should generate material alerts such as return-rate spike, Active-rate decline, K deterioration, Carry concentration, Recovery spike or settlement integrity failure. AI explains likely drivers from authoritative data. LLM-only intuition must not create a formal integrity alert without a deterministic evidence-backed rule/result.

### 11. Recommend boundary
AI may provide descriptive operational recommendations such as where to inspect a Tree/subtree or which trend warrants attention. It must not autonomously change Sponsor, Binary placement, Active, Carry, Award, K values, RuleVersion, payout, Reservoir routing or member eligibility.

### 12. Future assisted actions (not MVP)
Specify future pattern only:
`AI collect/prepare -> Draft -> Human review -> explicit confirm -> normal RBAC command -> audit`.

High-risk actions such as Return POSTED, membership approval, placement, payout approval, rule changes or account changes must never be autonomous. Do not implement write actions in Phase 1/MVP-1.

### 13. Knowledge RAG vs structured tools
Separate:
- Structured personal/operational facts -> approved Core/Analytics tools;
- Approved documents/制度/FAQ/product/content -> versioned RAG knowledge.

Knowledge sources must be approved, versioned and effective-dated where rules can change. AI must prefer the effective R1.0B SSOT and must not answer current制度 from superseded documents without explicitly identifying historical context.

### 14. RAG citation/evidence UX
Member/Admin answers based on knowledge should carry source title/version/effective date and a deep-link where authorized. Answers based on structured facts should expose period, selected Ball/Tree, updatedAt and evidence/deep-link where appropriate. The user should be able to distinguish `制度文件說明` from `我的實際資料`.

### 15. Tool Gateway security
Authorization belongs in the tool/API layer, not merely the prompt. Required controls:
- Member Qualification ownership/BOLA;
- Admin RBAC;
- field/row-level masking where required;
- tool allowlists by role;
- rate/usage limits;
- request/correlation IDs;
- no arbitrary URL/database access;
- fail closed on missing/ambiguous evidence for sensitive financial answers.

### 16. Prompt-injection / untrusted content defense
Design isolation between user text, retrieved documents and tool instructions. Retrieved content must never grant tool permissions or override system policy. Specify content sanitization, tool allowlist, argument validation, URL/domain policy for external content, and refusal/fail-closed behavior for attempts to retrieve unauthorized member/admin data.

### 17. PII and sensitive data
Define data classification/redaction rules. AI should receive only fields necessary for the requested task. Mask bank/payment identifiers, formal application sensitive fields and other protected data according to role. Do not put secrets/tokens/passwords into model context or logs.

### 18. AI audit
Propose an `AiInteraction` / audit model or equivalent capturing minimally necessary evidence such as:
- actor/person/admin identity;
- role;
- selected Qualification/Tree context;
- intent/tool names;
- authorized data scopes;
- evidence references/metric keys;
- model/provider/version where operationally required;
- timestamps/correlation IDs;
- outcome/error category.

Do not default to indefinite storage of full raw prompts/responses containing PII. Specify retention/redaction policy and audit-vs-privacy tradeoff.

### 19. Model/provider abstraction and Sovereign AI path
AI Core must not hardwire business logic to one model vendor. Define provider abstraction for hosted OpenAI/Azure OpenAI/private or future sovereign model deployment. Tool contracts, authorization, semantic layer, RAG metadata and evidence must remain UCell-owned and provider-independent.

### 20. Reliability / fail-closed UX
Define response states:
- authoritative answer available;
- knowledge answer available;
- partial evidence;
- unavailable;
- permission denied;
- ambiguous context;
- stale/read-model updating;
- tool timeout/error.

For sensitive monetary questions, missing evidence should produce `目前無法取得可驗證資料` rather than a guessed answer.

### 21. Member UX integration
Specify AI entry points without replacing normal navigation:
- Home `UCell AI` card / ask box;
- contextual `為什麼？` on Active/Performance/Bonus/Settlement/Order;
- AI answer deep-links back to normal authoritative screens;
- selected Ball indicator always visible in personalized answers.

AI is an acceleration layer, not the only way to use the system.

### 22. Admin UX integration
Specify:
- persistent Copilot entry in Admin shell;
- contextual `Ask about this` on Tree/Founding stats, Person 360, Ball 360, Settlement, Return, Reservoir and Analytics dashboards;
- query-plan scope chips;
- evidence/metric definition drawer;
- save/share authorized analysis view/report without storing unauthorized raw data.

### 23. AI MVP phases
Define roadmap:

MVP-1 — Read / Navigate / Explain
- Member support and personal explanations;
- Admin natural-language analytics/explanations;
- approved RAG;
- read-only tools;
- evidence/audit/security.

MVP-2 — Detect / Recommend
- deterministic alerts;
- trend/root-driver explanation;
- Tree/operation insights;
- still no autonomous mutation.

MVP-3 — Assisted Actions
- draft/preparation workflows;
- explicit human confirmation;
- normal command/RBAC/audit path.

### 24. Required Phase-1 API/tool proposal
Update `API_V2_PROPOSAL.md` with proposed read-only AI tool contracts. At minimum cover selected-Ball context, Active explain, performance explain, Binary/Carry explain, Award explain, settlement/payout explain, order/return status, metric query, Tree/founding analytics, rank/bonus/return analytics, Reservoir explain, settlement/replay explain, knowledge search and source retrieval.

Each tool contract must define input scope, authorization, output evidence, error/fail-closed semantics, pagination/limits where relevant and data classification.

### 25. Required future executable evidence plan
The spec must define tests for at least:
1. Member AI cannot read another Person's Ball;
2. selected Ball context is honored and not silently switched;
3. multi-Ball data never merged unless an explicitly authorized aggregate tool is used;
4. Admin role restrictions apply through AI tools;
5. AI cannot bypass BOLA/RBAC by prompt injection;
6. ExplainAward result reconciles to authoritative Award/evidence and does not create a second calculation;
7. historical question uses as-of evidence, not current-state fallback;
8. RAG current制度 uses effective approved source/version;
9. superseded document is not silently used as current rule;
10. metric query uses the declared MetricDefinition;
11. chart/table values exactly match Analytics API output;
12. unavailable monetary evidence yields fail-closed response;
13. retrieved document content cannot grant tool permissions;
14. PII masking is enforced by role/tool response;
15. AI audit records evidence/tool scope without exposing secrets;
16. provider switch does not change UCell tool/evidence semantics;
17. AI cannot perform placement/payout/rule/Return-POSTED mutations in MVP-1;
18. deterministic alerts remain distinct from LLM recommendations.

### 26. Phase-1 document impact
Add `AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC.md` to the mandatory review package and update:
- `INFORMATION_ARCHITECTURE.md`
- `COMPONENT_SPEC.md`
- `PAGE_MAPPING.md`
- `ARCHITECTURE_GAP_ANALYSIS.md`
- `API_V2_PROPOSAL.md`
- `MIGRATION_43_PLUS_PROPOSAL.md` only for proposed AI audit/semantic metadata storage if actually needed
- `PENDING_ARCHITECTURE_DECISIONS.md` only for truly unresolved choices.

Still STOP after Phase 1. Do not implement AI provider calls, vector DB, RAG ingestion, AI database tables, write tools, Migration 43+, Stage redeployment or Production changes until Product Owner/SA Architecture Review.

---

Source: https://github.com/joewschang/UCell/issues/2#issuecomment-5721811201

## SA addendum — AI-Ready Foundation work before AI provider integration

Phase 1 must explicitly prepare UCell for AI before selecting/connecting an LLM or vector database. The objective is to make semantics, evidence, APIs, authorization and knowledge machine-consumable without creating a second source of truth.

Add a mandatory Phase-1 deliverable:
`governance/ux-v2/AI_READY_FOUNDATION_SPEC.md`

### 1. Business semantic catalog
Design a UCell-owned machine-readable catalog for `BusinessTermDefinition` and `MetricDefinition`. It must cover at least Active, GPV, RPV, EPV, Carry, PairPV, K0/K1/K2, ranks, Return rates, Reservoir A/B, Recovery/Clawback, Tree/founding statistics and core Analytics metrics.

Each definition should specify stable key, human name, description, grain, source authoritative read model/fact, dimensions/filters, numerator/denominator where applicable, event/effective timestamp, Asia/Taipei period semantics, historical/as-of behavior, replay/return behavior, rounding/null behavior, data classification and effective version.

Dashboard, Analytics API and future AI must consume the same definitions rather than reimplementing them independently.

### 2. AI-friendly authoritative result envelope
Propose a common response/evidence envelope for important read APIs. Candidate fields where applicable:
- value/result;
- status/finality;
- entity/Qualification/BinaryTree scope;
- period/asOf;
- authoritative updatedAt;
- definition/metric key;
- RuleVersion/ParameterVersion;
- evidenceRefs;
- explainCode;
- deepLink;
- data classification.

Do not force every endpoint into an identical shape if semantics differ; define a reusable envelope/pattern with typed payloads.

### 3. Structured Explain contracts before LLM
Design backend Explain read contracts independent of any model provider. Initial contracts should include:
- ExplainActive
- ExplainPerformance / GPV/RPV/EPV
- ExplainBinaryPairCarry
- ExplainAward
- ExplainSettlement
- ExplainPayout
- ExplainReturnImpact
- ExplainReservoirA/B
- ExplainRank/qualification progress where formally supported

The Explain contract returns structured authoritative facts/evidence. Experience v2 can use it directly; future AI translates it to natural language. This is specifically intended to reduce hallucination and duplicate monetary logic.

### 4. Historical/as-of readiness
All new Multi-Tree/Analytics/Explain read-model proposals must explicitly state whether they support current, period and/or as-of queries. Historical questions must resolve against effective-dated/historical evidence, never current-state fallback. Phase 1 must identify existing endpoints/read models that are not yet historical-ready.

### 5. Event/Evidence Dictionary
Design a machine-readable `EventDefinition/EvidenceDefinition` catalog for key facts such as ConsumptionRecognition, VolumeRecognition, Active transition, Binary placement, Award, Settlement, Return POSTED, Replay, Recovery/Clawback, Payout, Qualification ownership transfer and Reservoir entries.

At minimum define business meaning, entity/grain, effectiveAt vs recordedAt, source, immutable/evidence fields, replay behavior, relation to RuleVersion and safe fields for Member/Admin/AI explanation.

### 6. Knowledge governance metadata
Before RAG/vector ingestion, define a governed `KnowledgeDocument` model/metadata contract:
- documentId/type/title;
- version;
- status: DRAFT / APPROVED / SUPERSEDED / ARCHIVED;
- effectiveFrom/effectiveTo;
- authorityLevel;
- approvedBy/approval reference;
- supersedes/supersededBy;
- language;
- source URI/reference;
- data classification;
- ingestion eligibility.

Current-rule AI/RAG must default to APPROVED + effective knowledge and respect SSOT precedence.

### 7. Knowledge Units
Propose chunk-level `KnowledgeUnit` metadata so retrieval is not just arbitrary PDF/Word chunks. A unit should retain stable semantic key/topic where useful, parent document/version, heading/section, effective period, authority, language, citation/source range and supersession context. Example topics: ACTIVE_RULE, BINARY_SETTLEMENT, PAYOUT_CALENDAR, MATCHING_RULE, PRODUCT_TIP_636.

Do not implement vector DB in Phase 1.

### 8. Canonical Deep-Link Contract
Define stable canonical routes/identifiers for AI/explain responses to return users to authoritative UI. Cover at least Person, Qualification/Ball, BinaryTree, Award, Settlement, Order, Return, Reservoir Entry, Analytics view/metric and relevant content/knowledge. Deep links must respect authorization and must not encode secrets.

### 9. Standard Request/Authorization Context
Propose a shared `UCellRequestContext` (or equivalent) for Member/Admin/future AI Tool Gateway containing only required context such as actor identity/type, roles, Person, selected Qualification, BinaryTree, permissions/scopes, locale, timezone and correlation ID.

Authorization remains server-side. AI cannot elevate scope by changing context fields supplied by the client/model.

### 10. Data classification / AI exposure policy
Define machine-enforceable classes such as PUBLIC, MEMBER_SELF, MEMBER_SENSITIVE, ADMIN_OPERATIONAL, FINANCE_CONFIDENTIAL, and SECRET_NEVER_AI (names may be refined). Explicitly classify credentials/tokens/passwords/secrets as NEVER_AI. Specify masking/minimization for bank/payment identifiers, applications, contact details and other protected fields.

### 11. Unified Analytics Query Contract
Design an AI-friendly but non-AI-specific analytics query contract, e.g. metric(s), period, dimensions, filters, groupBy, asOf, pagination/limit and comparison. It must resolve only registered MetricDefinitions and authorized dimensions; no arbitrary SQL/expression execution.

### 12. AI Golden Questions dataset
Create a Phase-1 proposal and initial curated dataset specification for `AI_GOLDEN_QUESTIONS`. Target future 100–300 questions across Member and Admin. Each case should define question/locale, expected intent, selected context, required tool/metric/knowledge source, allowed data scope, forbidden scope, expected evidence/deep-link, expected fail-closed behavior and evaluation assertions.

Include representative cases for Active, Ball isolation, Carry, Award explanation, payout, Return/recovery, Tree/founding analytics, rank, return rate, Reservoir B and historical questions.

### 13. AI evaluation framework
Specify evaluation dimensions at minimum:
- factual correctness vs authoritative facts;
- grounding/evidence completeness;
- authorization/BOLA/RBAC;
- Ball/Tree/period scope correctness;
- hallucination/fail-closed behavior;
- effective-version knowledge correctness;
- PII leakage;
- tool-selection correctness;
- latency/cost later when a provider is connected.

### 14. Tool Gateway simulator / contract tests
Before connecting an LLM, propose a provider-free `AI Tool Gateway Simulator` / contract-test harness that can invoke proposed tools such as getActiveStatus, explainAward, explainBinaryCarry, queryMetric, getTreeStats, explainReservoirB and knowledge lookup using deterministic test identities/contexts. It must test authorization, evidence schema, errors, historical semantics and latency budget without any model dependency.

### 15. AI audit preparation
Coordinate with `AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC.md` on a minimal auditable interaction/tool-call model. Phase 1 should determine what metadata genuinely needs persistence versus operational logs, with retention/redaction requirements. Do not store secrets or default to indefinite raw prompt/response retention.

### 16. Implementation sequencing recommendation
The Phase-1 report should recommend a sequence similar to:
1. Semantic/Metric catalog
2. Evidence/Explain contracts
3. Request context + data classification
4. Historical/read-model readiness
5. Canonical deep links
6. Analytics query contract
7. Knowledge governance/units
8. Tool Gateway simulator + Golden Questions
9. Explain APIs / analytics read models during implementation phase
10. Only then choose/connect LLM provider and RAG/vector retrieval

Provider/model/vector database selection must not drive Core domain design.

### 17. Migration/API impact
Update `MIGRATION_43_PLUS_PROPOSAL.md` only with proposed persistence that is actually justified (for example semantic/knowledge metadata or AI audit if persistence is necessary). Prefer code/config schemas for stable definitions when database persistence is not required. Update `API_V2_PROPOSAL.md` with Explain/read/metric/tool-friendly contracts. No Migration 43 implementation in Phase 1.

### 18. Architecture review checklist
`PHASE1_ARCHITECTURE_REVIEW_REPORT.md` must explicitly answer:
- Can an AI explain an Award without recalculating it?
- Can it answer historical questions without current-state fallback?
- Can every metric be traced to one declared definition?
- Can Member AI be cryptographically/server-authoritatively restricted to owned Balls?
- Can Admin AI respect RBAC/field masking?
- Can current制度 RAG exclude superseded rules?
- Can model providers be changed without changing Core semantics/tools?
- Can the AI layer be tested before any LLM is connected?

Still STOP after Phase 1. No LLM/API provider integration, vector DB, RAG ingestion, AI tables, Migration 43+, Stage redeployment or Production changes until Product Owner/SA review.
