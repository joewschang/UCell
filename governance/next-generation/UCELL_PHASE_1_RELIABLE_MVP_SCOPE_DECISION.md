# UCell Phase Boundary Decision — Reliable MVP First

**Status:** AUTHORITATIVE / MANDATORY
**Date:** 2026-09-25 (Asia/Taipei)
**Baseline:** R1.0B
**Supersedes:** UCELL_PHASE_BOUNDARY_AI_READY_FOUNDATION_DECISION.md as the current phase-scope authority.
**Decision:** Phase 1 is strictly the Reliable UCell MVP. Semantic/Data/Analytics/AI foundation implementation is moved to Phase 2 or later and is NOT a Phase 1 release gate.

## 1. Phase 1 — Reliable UCell MVP

Objective: finish, verify, deploy and operationalize the R1.0B member/commerce/economic system.

In scope:
- R1.0B Transaction and Economic Core.
- Person / WEB_MEMBER / Qualification / Ball.
- Sponsor / Binary / Placement.
- Product / Order / Payment.
- Retail Referral.
- Return / Adjustment / Recovery.
- Award / Settlement / Payout.
- LINE OA/Login/link/rebind security required for operations.
- Paper Application / Order / Receipt / Payment / Placement.
- Admin and Member operational UX.
- P0 Identifier / Privacy, including BallNo-topology decoupling.
- Operational/security audit required by current flows.
- Migration integrity and fresh 0→current.
- Full regression / Golden / privacy / security gates.
- Stage Release Candidate and Business UAT.
- Backup/restore, minimum monitoring, operational/release/incident runbooks.
- ERP Order Handoff only when required for MVP; manual governed transfer remains acceptable if ERP API is not ready.
- GitHub / Google Drive closure for Phase 1 affected documents.

## 2. Explicitly NOT a Phase 1 gate

Move to Phase 2+:
- SG-A1 Source Authority Audit as an implementation program.
- Semantic Governance Runtime.
- Semantic DB migrations.
- Metric Certification Platform.
- Data Governance Center.
- Data lifecycle/ownership/quality runtime beyond current operational necessities.
- Analytics projections and governed analytics query engine.
- advanced data-access governance runtime for analytics/AI.
- Admin AI natural-language query.
- AI Brain Runtime.
- LLM/provider integration.
- Copilot/Claude/Kimi/Qwen agent runtime.
- sovereign AI inference infrastructure.
- MCP/AI Tool Gateway.
- RAG/vector DB/embeddings.
- AI memory/query planner/evidence composer/output firewall runtime.
- AI Development Request Bridge.
- AI write/action runtime.

Existing specifications for these topics are retained as future design references/backlog and MUST NOT be interpreted as current implementation scope.

## 3. Phase 1 release gates

G1 FUNCTIONAL_CLOSURE
G2 MIGRATION_INTEGRITY
G3 FRESH_0_TO_CURRENT
G4 FULL_REGRESSION
G5 CODE_AND_DOCUMENTATION_CLOSURE
G6 STAGE_RELEASE_CANDIDATE
G7 BUSINESS_UAT
G8 OPERATIONAL_READINESS
G9 PRODUCTION_GO_NO_GO
G10 R1_0B_GA

Phase 1 is complete only at G10.

## 4. Current known status

- Migration blocker 20260925140000 is resolved locally; fresh 0→current/DB Golden has passed for the verified source head documented in the blocker report.
- Functional closure remains the current critical path.
- Semantic/Analytics/AI work must not delay Phase 1 GA.

## 5. BallNo privacy decision

BallNo is a business identifier/sequence and MUST NOT encode or expose Binary topology.
Authoritative topology remains in binaryPositionNo / binaryPath and governed Tree data.
No external/member logic may derive position from BallNo.
Any prior BallNo↔position arithmetic mapping is superseded for ordinary Balls.
Sequence lifecycle, uniqueness, concurrency and non-reuse behavior must be covered by P0 tests and reflected in affected identifier/data dictionary/API/documentation artifacts.

## 6. Phase 2 — Governed Data & Intelligence Foundation

Starts only after Phase 1 GA or explicit separate approval.

Planned scope:
- SG-A1 Source Authority Audit.
- Data ownership/stewardship/lifecycle/quality governance.
- Semantic Foundation.
- Certified Metrics.
- Analytics projections.
- Governed Query Engine.
- data authorization/usage governance runtime.
- analytics/data-access audit and evidence.
- preparation for provider-independent AI.

Phase 2 may finish without any LLM.

## 7. Phase 3 — Intelligent UCell

- UCell Tool/Agent Gateway.
- provider/model adapters.
- Copilot / Claude / Kimi / Qwen or other approved providers.
- sovereign/self-hosted model option.
- Admin AI natural-language analytics.
- first release READ ONLY.
- model selection occurs only after data authorization.

## 8. Phase 4 — Assisted Operations

AI proposal → Human approval → Governed command.
No arbitrary autonomous Production mutation is approved.

## 9. Mandatory Codex boundary

For all current Phase 1 work:

PHASE 1 = RELIABLE UCELL MVP ONLY.

Do NOT implement Semantic Runtime, Analytics Runtime, Data Governance Runtime, AI/LLM/Agent/MCP/RAG/Vector/Embedding capabilities unless separately and explicitly approved as a Phase 1 blocker fix.

Future-design documents are reference material only.

Focus on closing G1→G10.

## 10. Cross-layer governance

UCELL_CROSS_LAYER_CHANGE_GOVERNANCE_RULE_V1 remains mandatory for material Phase 1 changes.
AI Brain impact may be VERIFIED_NO_CHANGE or FUTURE_DESIGN_IMPACT_ONLY; it does not authorize AI implementation.
Google Drive impact must still be assessed at release/document closure.

## 11. Success criterion

Phase 1 succeeds when the company can safely and correctly operate R1.0B in Stage/UAT and proceed through Production readiness with reproducible DB, full regression, operational security, backup/restore, monitoring/runbooks and synchronized affected formal documentation.
