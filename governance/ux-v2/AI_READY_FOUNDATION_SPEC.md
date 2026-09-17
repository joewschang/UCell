# AI-ready foundation

Status: PROPOSED architecture, not runtime code or persistence. UCell owns semantic definitions, evidence, authorization and tool contracts independently of any model. [AI Core](AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC.md) defines the user experience and security boundary.

## Machine-readable catalog contracts

Versioned JSON in reviewed source/config is the proposed initial home. Runtime editing or database tables are not necessary for stable definitions. Every required property is validated at future build time; version IDs are immutable and effective intervals must not overlap for the same key. Definitions without an authoritative source stay UNAVAILABLE; schema examples do not authorize new economics.

```ts
type BusinessTermDefinition = {
  key: string; version: string; name: Record<string,string>; description: string;
  authorityRefs: string[]; effectiveFrom: string; effectiveTo: string|null;
  grain: 'PERSON'|'QUALIFICATION'|'TREE'|'EVENT'|'PERIOD'|'POOL';
  source: { service: string; fact: string; evidenceKeys: string[] };
  dimensions: string[]; allowedFilters: string[];
  time: { eventField: string; timezone: 'Asia/Taipei'; boundary: '[from,to)';
    current: boolean; period: boolean; asOf: boolean; knowledgeCutoff: boolean };
  replayPolicy: string; returnPolicy: string; rounding: string; nullPolicy: string;
  classification: DataClass;
};
type MetricDefinition = BusinessTermDefinition & {
  unit: 'TWD'|'PV'|'COUNT'|'RATIO'|'STATE'; aggregation: string;
  numerator: string|null; denominator: string|null; zeroDenominator: 'NULL_NOT_APPLICABLE';
  permittedGroupBy: string[]; companyTreatment: string; finalityRequired: string;
};
type DataClass = 'PUBLIC'|'MEMBER_SELF'|'MEMBER_SENSITIVE'|
  'ADMIN_OPERATIONAL'|'FINANCE_CONFIDENTIAL'|'SECRET_NEVER_AI';
```

Catalog registration checklist below is mandatory; detailed formulas and cohorts are in [BI](MANAGEMENT_ANALYTICS_AND_BI_SPEC.md) and [tree statistics](BINARY_TREE_ADMIN_AND_STATISTICS_SPEC.md). Keys are proposal identifiers, never parallel implementations of formulas.

| Keys / grain | Authoritative source and semantic constraint |
|---|---|
| active.member / Qualification-period | Eligible consumption and Active transitions; NT$2,000; no retroactive earlier-event eligibility |
| active.company / Qualification-effective interval | Explicit COMPANY ownership; Always Active; no weakening member rule |
| volume.gpv, volume.rpv, volume.epv / recognition event → Ball-period | Approved recognition/projection; distinguish historical GPV from abstract PV/BV; signed POSTED return/replay effects |
| binary.carry, binary.pairpv / Ball-tree-week | Finalized Binary snapshot and replay revisions; no cross-tree borrowing |
| pool.k0, pool.k1, pool.k2 / pool-period | Core settlement evidence; never compute K per tree just because UI filters tree |
| rank.effective / Qualification-effective interval | Approved rank history; unavailable if only current rank exists |
| return.order_rate, return.amount_rate / original order cohort | Distinct POSTED returns/original eligible orders; money numerator vs original cohort money denominator, never mix cohorts |
| reservoir.a, reservoir.b / entry → period | Separate ledgers; A undistributed Global remainder, B company entitlements; signed corrections are not discretionary outflows |
| recovery.amount, clawback.amount / source event | Explicit recovery/clawback facts, not negative payout guessed from net balances |
| tree.people, tree.balls, founding.people, founding.balls / tree-anchor-time | Distinct Person versus Ball counts, lineage disjointness and founding anchors per statistics spec |
| analytics.retention, analytics.nasl / Person-cohort-period | Management policy/version and captured projection; NASL is not financial Ball Active |
| award.distribution, award.quantile, award.top_share / Ball or Person-period | Finalized award basis explicitly chosen; company separate; continuous decimal bands; no paid/finalized substitution |

Each row expands into individual definitions with all schema fields before implementation. Display terms alone cannot be registered as executable metrics. Ratios with empty denominators return null plus NOT_APPLICABLE; missing facts return UNAVAILABLE, not zero. Decimal strings retain source precision; UI rounding is separate and disclosed. Unsupported dimension combinations are rejected, never silently regrouped.

## Typed authoritative envelope and Explain contracts

```ts
type EvidenceResult<T> = {
  result: T|null; status: 'AVAILABLE'|'PARTIAL'|'UNAVAILABLE'|'DENIED'|'STALE';
  finality: 'PROVISIONAL'|'FINALIZED'|'PAID'|'NOT_APPLICABLE';
  scope: { personId?: string; qualificationId?: string; binaryTreeId?: string };
  time: { period?: string; asOf?: string; knowledgeCutoff?: string; timezone: 'Asia/Taipei' };
  updatedAt: string|null; definitionKey: string; definitionVersion: string;
  ruleVersion: string|null; parameterVersion: string|null;
  evidenceRefs: { type: string; id: string; revision?: string }[];
  explainCode: string; deepLink: string|null; classification: DataClass;
};
```

Null versions require an explicit NOT_APPLICABLE reason; absent evidence cannot masquerade as authoritative AVAILABLE. Lists carry snapshot-bound opaque cursor and completeness. Different endpoints have typed payloads; this envelope does not erase settlement/payout distinctions.

| Explain contract | Typed payload / evidence | Current, period, asOf readiness |
|---|---|---|
| ExplainActive | classification, eligible consumption, threshold, transition and rule | Proposed all three; existing member current/ActivePeriod is partial, ownership history missing |
| ExplainPerformance | GPV/RPV/EPV source events, adjustment chain, totals | Existing bounded management history and member volumes partial; arbitrary asOf not promised |
| ExplainBinaryPairCarry | left/right recognized amounts, PairPV, before/after Carry, finalization/replay refs | Existing finalized period snapshot usable; tree/ownership historical context still required |
| ExplainAward | stored theory, caps/K applied, final entitlement, destination, revisions | Existing Award evidence usable; company destination and generalized asOf missing |
| ExplainSettlement | period/calendar, finality, pool provenance, snapshot | Period supported by existing settlement reads; unified asOf projection proposed |
| ExplainPayout | payable/paid state, batch calendar, recovery, masked receipt | Event/period projection proposed; never infer PAID from FINALIZED |
| ExplainReturnImpact | POSTED evidence, original recognition, replay and recovery links | Existing replay evidence partial; full joined historical explanation proposed |
| ExplainReservoirA/B | ledger entry, typed source, destination, signed revision | A source partial; B absent; missing B returns unavailable, not A |
| ExplainRank | approved rank and eligibility evidence, unmet conditions | Only formally supported dimensions; historical rank evidence required, no current fallback |

New reads must declare supported time modes in their schemas. Reject unsupported asOf with HISTORICAL_UNAVAILABLE. Effective time asks what applied; knowledgeCutoff asks what was recorded then. Event ranges use [from,to); effective intervals contain asOf at their inclusive start and exclusive end. Replay does not overwrite prior revisions. Existing Analytics history is captured Person history; sonar is bounded to 12 generations; neither proves complete arbitrary-time, unlimited multi-tree history.

## EventDefinition / EvidenceDefinition

Proposed schema: `{key, version, meaning, grain, source, effectiveAtField, recordedAtField, immutableFields[], revisionOfField, replayBehavior, ruleVersionField, parameterVersionField, safeMemberFields[], safeAdminFields[], classification}`. Every event includes stable ID and correlation/source reference. Safe projections exclude raw payloads, secrets and unrelated Person data.

| Event key | Meaning / grain | Immutable evidence and replay rule |
|---|---|---|
| consumption.recognized | eligible cash consumption / line-Ball | source line, amount, effective/recorded time; append correction; Active timing preserved |
| volume.recognized | recognized GPV/RPV/EPV / event-Ball | kind, exact decimal, source, rule; linked signed adjustments |
| active.transition | eligibility change / Ball | prior/new state, reason, source; effective ownership needed for company rule |
| binary.placed | topology / tree-Ball | parent, side, effective interval, placement evidence; no destructive bootstrap move |
| award.finalized | entitlement / award revision | theory, final amount, rule/K/source; superseding revision with signed delta |
| settlement.finalized | closed calculation / period-scope | snapshot hash, boundary, versions; immutable revision chain |
| return.posted | authoritative return / return-line | original sale/recognition refs, signed basis; retries deduplicated |
| replay.completed | corrected computation / run | source change, before/after revisions, status; replay not another sale |
| recovery.recorded | recoverable paid overage / source-recipient | recovery/clawback type and amount; append resolution |
| payout.recorded | payment state / payout-batch-item | payable source, status, masked receipt reference; provider secret excluded |
| ownership.transferred | holder change / Ball interval | source/target principal, effective boundary, approval; no historic rewrite |
| reservoir.entry | A or B accrual/correction / source revision | reservoir type, typed source, Ball/tree when applicable, signed amount, destination key; exactly once |

## KnowledgeDocument and KnowledgeUnit

Document schema: documentId, type, title, version, status (DRAFT/APPROVED/SUPERSEDED/ARCHIVED), effectiveFrom/effectiveTo, authorityLevel, approvedBy, approvalRef, supersedes/supersededBy, language, sourceURI, sourceHash, classification, ingestionEligibility. Eligibility is computed from approval, effectivity, classification and intended audience, not a manually trusted boolean alone. Approved effective SSOT precedence wins; ambiguous overlapping rules stop retrieval. Superseded versions remain available only for explicitly authorized historical questions with date labels.

Unit schema: unitId, semanticKey/topic (ACTIVE_RULE, BINARY_SETTLEMENT, PAYOUT_CALENDAR, MATCHING_RULE, PRODUCT_TIP_636), parentDocumentId/version/hash, heading/section, sourceRange, citation, effective interval, authority, language, supersession context, classification. Units inherit parent controls and cannot widen scope. No vector DB or ingestion is performed here.

## Request context, exposure and canonical links

UCellRequestContext contains server-resolved actorId/type, roles, personId, selectedQualificationId, binaryTreeId, permittedScopes, locale, timezone and correlationId. Authentication token validation is necessary but insufficient: lookup current grants and ownership for every call. Client selection is a request, not authority. Historical reads apply current access controls plus approved historical policy. Context version/correlation prevents a late response from a previous Ball leaking into the next selection.

PUBLIC: approved public content. MEMBER_SELF: own scoped facts. MEMBER_SENSITIVE: minimally projected private member facts, normally omit contacts/application text. ADMIN_OPERATIONAL: role-scoped operational aggregates. FINANCE_CONFIDENTIAL: finance-authorized evidence and separate company ledgers. SECRET_NEVER_AI: all credentials, passwords, tokens, keys and raw payment secrets, never provider input or telemetry. Bank/payment identifiers are omitted by default; authorized UI can use masked display references without exposing raw fields to AI.

Canonical link registry proposal: Person `/admin/members/:personId`; Ball `/member/balls/:qualificationId` or authorized Admin detail; tree `/admin/organization/binary-trees/:treeId`; Award `/member/awards/:awardId`; settlement `/admin/finance/settlements/:settlementId`; order `/member/orders/:orderId`; return `/member/returns/:returnId`; reservoir `/admin/finance/reservoirs/:kind/entries/:entryId`; metric `/admin/analytics?metric=:key&period=:period`; content `/member/content/:contentId`; knowledge `/knowledge/:documentId/versions/:version#section`. These are proposed canonical aliases, not claims that all routes exist; existing route migration is in [PAGE_MAPPING](PAGE_MAPPING.md). IDs are opaque; link resolution rechecks access, supports correct Member/Admin variants, and contains no tokens/secrets. Unsupported links are null, never fabricated URLs.

## Unified query and evaluation

QueryMetric input: metricKeys (max 10), definitionVersions, period or asOf plus optional knowledgeCutoff, allowlisted dimensions/filters/groupBy, explicit companyTreatment and finality, optional comparable prior period, cursor and limit (default 50/max 200). Schema rejects arbitrary SQL/expressions, incompatible grains, unauthorized dimensions and contradictory time modes. Return envelope includes resolved query plan, denominators, source watermark, completeness, nextCursor and source evidence. Expensive exports use authorized audited jobs with the same immutable query snapshot; no unbounded model tool response.

[AI_GOLDEN_QUESTIONS](evidence/AI_GOLDEN_QUESTIONS.json) is a curated seed specification, not an executed evaluation or the final 100–300-case corpus. Expand to 120 cases: 40 Member, 40 Admin, 20 authorization/injection, 20 historical/version/error cases, balancing positive and negative outcomes. Every case specifies question, locale, intent, context, required tools/metrics/knowledge, allowed/forbidden scope, evidence/link and fail-closed assertions. Synthetic IDs only.

Provider-free simulator proposal: deterministic test principals/roles and fixture facts → real gateway schema/authorization → stub authoritative services → typed results; assert exact decimals/evidence, RBAC/BOLA, unsupported history, field masking, bounded pagination, timeouts, context cancellation and audit redaction. No LLM or network provider needed. Proposed budget: ordinary reads p95 ≤2 seconds, bounded analytics ≤5 seconds; expensive queries become jobs. These budgets require measurement and approval, not performance claims.

Evaluation gates: exact structured fact equality; complete mandatory grounding; zero BOLA/RBAC or PII leakage; correct Ball/tree/period; unavailable rather than hallucinated values; effective knowledge version; correct allowlisted tool selection. Evaluate narrative factual/grounding quality later with reviewed answer rubrics and adversarial prompts; latency/cost/provider quality only after connection is approved. Persist minimal audit as specified in AI Core; stable catalogs stay reviewed config. Knowledge approval workflow and interaction audit may justify later persistence, but no AI migration is created now.

Sequence: semantic/metric catalog → evidence/Explain → context/classification → historical readiness → canonical links → query contract → governed knowledge/units → simulator/golden questions → implementation-phase read APIs → separately approved provider/RAG. Architecture review answers are in [review report](PHASE1_ARCHITECTURE_REVIEW_REPORT.md).
