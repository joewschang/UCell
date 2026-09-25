# UCell Governance Authority Map v1.0

**Status:** APPROVED GOVERNANCE INDEX / IMPLEMENTATION-NEUTRAL
**Date:** 2026-09-25 (Asia/Taipei)
**Purpose:** prevent obsolete/draft documents from overriding current UCell authority and provide a single routing map for humans, Codex, AI Brain, APIs, Semantic Core and formal documents.

## 1. Authority precedence

For a concrete runtime/business question, use the narrowest applicable current authority. Do not merge superseded rules.

1. Explicit current Product Owner approved decision / current R1.0B normative SSOT.
2. Current domain-specific approved governance decision.
3. Current runtime Core + Golden evidence where the approved semantic says runtime is authoritative.
4. Semantic & Governance Core for meaning/metric/scope/privacy/lineage, never to invent economic rules.
5. OpenAPI/Data Dictionary for implemented technical contracts.
6. Implementation/Closure reports as evidence of delivery, not business-rule authority.
7. Google Drive formal documents as governed publication/distribution surfaces; if stale, raise synchronization conflict rather than overriding newer approved GitHub/runtime authority.
8. Historical/superseded/draft documents are non-authoritative for new implementation.

If two current sources disagree: create SEMANTIC/AUTHORITY_CONFLICT; fail closed for affected certification/implementation until resolved.

## 2. Current authority domains

| Domain | Primary authority | Role |
|---|---|---|
| R1.0B business/economic rules | current R1.0B Decision/Golden/Core evidence | normative economic truth |
| Identifier/privacy | FINAL_P0_IDENTIFIER_PRIVACY_DECISION.md + P0_IDENTIFIER_DATA_DICTIONARY.md | memberNo/ballNo/topology/privacy |
| Company bootstrap | COMPANY_BOOTSTRAP_PROFILE_V1_APPROVED_MAPPING.md + current runtime evidence | #1-#3/company nodes |
| Onboarding/Paper/LINE | R1_0B_MEMBER_ONBOARDING_PAPER_LINE_LINK_SPEC.md + approved paper/company sponsor decision | onboarding truth |
| Retail Referral | onboarding/retail SSOT + current Award/Return runtime evidence | retail referral economics |
| LINE security | LINE_ACCOUNT_SECURITY_LITE_SPEC.md + LINE integration SSOT | binding/rebind/recovery |
| Semantic governance | UCELL_SEMANTIC_GOVERNANCE_CORE_SPEC.md | semantic truth |
| Cross-layer change governance | UCELL_CROSS_LAYER_CHANGE_GOVERNANCE_RULE_V1.md | mandatory change process |
| ERP boundary | ERP_MVP_BOUNDARY_V1.md | system responsibility boundary |
| AI/Data firewall | semantic-core/AI_ANALYTICS_DATA_FIREWALL_THREAT_MODEL_V1.md | future AI safety contract |
| Semantic seed/golden/audit templates | semantic-core/*.yaml | design seeds/evidence templates, not runtime truth |

## 3. Document status taxonomy

AUTHORITATIVE — may govern current implementation within declared scope.
APPROVED_DESIGN — approved design, implementation/source mapping may still be pending.
IMPLEMENTATION_EVIDENCE — proves what code/tests delivered; cannot redefine business rules.
DRAFT — discussion only.
DECISION_REQUIRED — blocked; do not infer.
SUPERSEDED — historical only.
HISTORICAL — retained for audit/reproduction only.

Every new governance document should declare one of these statuses or an equivalent unambiguous status.

## 4. Conflict rules

- Old PPU/rank/Active/bonus prose must never be revived because it appears in an older document.
- Semantic definitions cannot override R1.0B Economic Core.
- Runtime behavior that conflicts with approved normative rules is a defect/conflict, not a new rule.
- Google Drive content that conflicts with newer approved authority becomes DRIVE_SYNC_REQUIRED.
- AI Brain may not resolve authority conflicts itself.
- Codex may identify conflicts but may not choose a business rule without authority.

## 5. Change routing

Every approved change follows:
Decision → Cross-Layer Impact Matrix → Definition/Semantic impact → AI Brain impact → API → DB → Runtime → Tests/Golden/Security → GitHub → Google Drive.

Use UCELL_CROSS_LAYER_CHANGE_IMPACT_MATRIX_TEMPLATE_V1.md.

## 6. Current milestone routing

Current project gate:
R1.0B OPERATIONAL CLOSURE → ONBOARDING_FINAL_HEAD.

Next:
SG-A1 SOURCE AUTHORITY AUDIT → SOURCE_AUTHORITY_AUDITED.

Then:
SEMANTIC RUNTIME → SEMANTIC CORE CERTIFICATION.

Then:
GOVERNED ANALYTICS QUERY ENGINE → ANALYTICS_QUERY_SECURED.

Then:
ADMIN AI DATA ASSISTANT READ-ONLY → AI_READ_ONLY_READY.

Then:
AI/HUMAN/CODEX LEARNING LOOP → ENTERPRISE_LEARNING_LOOP_READY.

## 7. Google Drive authority relationship

GitHub is technical/versioned governance SSOT.
Google Drive is formal business/operating/publication surface.

A Drive document is not automatically authoritative merely because it is labeled formal/final. Its content must be synchronized to current approved authority.
Cross-layer closure must explicitly mark each affected Drive document UPDATED, VERIFIED_NO_CHANGE, or DEFERRED_WITH_OWNER_AND_REASON.

## 8. AI Brain authority rule

AI Brain consumes approved/certified sources. It does not become authority by remembering a conversation.
AI Brain must distinguish:
FACT — supported by certified/authoritative evidence.
DERIVED — deterministic approved derivation.
INTERPRETATION — model analysis of facts.
HYPOTHESIS — plausible but unverified explanation.
DECISION_REQUIRED — no approved answer.

## 9. Repository hygiene rule

When a new authority supersedes an older file:
- update this Authority Map;
- mark/link superseded source where practical;
- update implementation status;
- update affected Semantic/AI/API/DB/code/tests;
- assess Google Drive synchronization;
- preserve historical evidence rather than deleting it blindly.

## 10. Mandatory pre-work check

Before any new Codex work package:
1. identify authority domain(s);
2. list exact governing files;
3. confirm no newer conflicting authority;
4. create/update Cross-Layer Impact Matrix;
5. only then implement.


## 11. Current AI phase boundary

Authority: UCELL_PHASE_BOUNDARY_AI_READY_FOUNDATION_DECISION.md.
Current phase is AI-READY FOUNDATION ONLY. Admin AI natural-language query, LLM runtime, RAG/vector/embedding, AI tool/memory/query-planner runtime and AI write actions are deferred to the next separately approved phase. AI Brain specifications are future design and MUST NOT be interpreted by Codex as current implementation scope.


## 12. Phase 1 scope authority — 2026-09-25 update

Current phase authority is `UCELL_PHASE_1_RELIABLE_MVP_SCOPE_DECISION.md`.
Phase 1 is **Reliable UCell MVP only**. SG-A1 implementation program, Semantic/Data Governance Runtime, Analytics Runtime and all AI/LLM/Agent infrastructure are Phase 2+ and MUST NOT block R1.0B GA. The prior `UCELL_PHASE_BOUNDARY_AI_READY_FOUNDATION_DECISION.md` is SUPERSEDED/HISTORICAL.

Current release routing:
G1 Functional Closure → G2 Migration Integrity → G3 Fresh 0→current → G4 Full Regression → G5 Code/Documentation Closure → G6 Stage RC → G7 Business UAT → G8 Operational Readiness → G9 Production Go/No-Go → G10 R1.0B GA.


## 13. Paper Person identity authority — 2026-09-26

Authority: `PAPER_PERSON_IDENTITY_DUPLICATE_DECISION_V1.md`.
Paper new-Person intake uses an exact normalized government-issued identity document keyed fingerprint as deterministic existing-Person match authority. Name/phone/email are secondary duplicate signals only. Ambiguity fails closed to DUPLICATE_REVIEW_REQUIRED. Automatic Person merge is not authorized in Phase 1. This decision resolves the prior Paper new-Person identity DECISION_REQUIRED blocker.
