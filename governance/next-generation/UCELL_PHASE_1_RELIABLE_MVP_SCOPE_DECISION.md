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


## 12. Phase 1 Core Operational Resilience Rules

**Status:** MANDATORY PHASE 1 RELEASE RULES.
**Implementation timing:** These rules define required outcomes for G8 Operational Readiness. They MUST NOT interrupt the current G1→G4 closure train. Codex may implement them only in a separately authorized Operational Readiness work package after local Functional Closure / Full Regression, unless a P0 defect requires earlier action.

The purpose is not to build an enterprise DR platform. Phase 1 requires the smallest reliable recovery baseline necessary to operate R1.0B safely.

### OR-1 Release identity and reproducibility

Every Stage RC and GA release MUST have a reproducible release identity containing at minimum:
- release name/tag;
- exact Git HEAD;
- migration count and migration manifest/hash;
- OpenAPI SHA-256;
- deployable artifact/image digest where applicable;
- required Golden/regression status;
- known limitations;
- release timestamp.

Git tag/manifest MUST identify exactly what was tested and released. A moving branch name is not sufficient release identity.

### OR-2 Source repository independent recovery

GitHub remains the technical SSOT, but MUST NOT be the only recoverable copy.

Before GA, establish and verify an independent full Git repository mirror/archive that preserves commit history, branches and tags. A source ZIP is not an adequate substitute for the repository recovery copy.

The mirror/archive location and restore procedure MUST be documented. Secrets MUST NOT be added to the mirror.

### OR-3 Database backup and verified restore

Production database backup policy MUST be defined before GA and meet approved business RPO/RTO.

At minimum:
- automated database backup;
- point-in-time recovery or another explicitly approved mechanism meeting RPO;
- release-associated backup/snapshot where operationally appropriate;
- documented restore procedure.

A backup is not considered VERIFIED until it has been restored into an isolated database and critical integrity checks have passed.

Required evidence:
BACKUP_EXISTS
→ RESTORE_COMPLETED
→ SCHEMA_INTEGRITY_PASS
→ CRITICAL_DATA_INTEGRITY_PASS
→ GOLDEN/SMOKE_PASS
→ RESTORE_VERIFIED.

Never use Production as the restore-test target.

### OR-4 Migration-chain integrity

The committed migration chain MUST remain sufficient to build an empty supported database from 0→current.

Historical migrations MUST NOT be silently rewritten.

For every RC/GA:
- migration preflight;
- fresh 0→current;
- DB Golden;
- migration manifest/hash verification.

A migration-history discrepancy is a release blocker until resolved by traceable evidence or an explicitly approved recovery decision.

### OR-5 Evidence/object-storage recoverability

If operational records reference external evidence/files (including Paper receipt evidence), database recovery alone is insufficient.

Before GA:
- inventory authoritative object/file storage;
- define backup/retention policy;
- verify restored DB references can resolve required evidence objects;
- protect storage with encryption/access control appropriate to data classification.

Do not place unrestricted Production DB dumps, secrets or raw restricted member data into ordinary Google Drive folders as a backup shortcut.

### OR-6 Environment inventory and configuration recovery

Maintain a versioned environment inventory for Stage and Production sufficient to rebuild/diagnose the environment.

At minimum record:
- domain/DNS/Cloudflare dependencies;
- Azure subscription/resource group/service names;
- container/application revisions and image references;
- PostgreSQL/storage/registry references;
- LINE OA/Login callback/configuration identifiers;
- ERP adapter endpoints/configuration identifiers where used;
- health endpoints;
- environment-variable NAMES and secret REFERENCES.

Actual secret values MUST NOT be committed to Git or stored in the environment inventory.

### OR-7 Secret recovery and service identity

Maintain a Secret/Service Identity inventory containing metadata only:
- secret/service identity name;
- system and environment;
- owner;
- vault/reference location;
- rotation/recovery procedure;
- expiry/last-rotation metadata where available.

Local, Stage and Production credentials MUST remain separated.
LINE/ERP/AI or other adapters MUST NOT reuse Core DB credentials.
No backup process may export plaintext secrets merely for convenience.

### OR-8 Minimum monitoring and alertability

Before GA, the company MUST be able to detect material operational failure without waiting for a member complaint.

Minimum monitored surfaces:
- API health;
- worker/background-job health;
- database connectivity/critical failure;
- Payment processing/confirmation failures;
- Placement failures;
- Award/Return/Replay/Recovery processing failures;
- LINE integration failures;
- ERP handoff failures when ERP handoff is enabled.

Logs/errors SHOULD carry correlation/trace identifiers sufficient to connect an operational incident to relevant business/audit evidence while excluding secrets and unnecessary PII.

### OR-9 Operational recovery runbooks

Before GA, maintain concise executable runbooks for at least:
- backup/restore;
- application release rollback;
- database/data recovery escalation;
- failed Payment/Pending Placement recovery;
- LINE account compromise/rebind;
- Award/Return/Recovery dispute investigation;
- ERP handoff failure/retry where enabled;
- security/data incident escalation.

Runbooks MUST distinguish application rollback from data recovery. A bad application release does not automatically justify restoring the database.

### OR-10 RPO/RTO business approval

Before Production Go/No-Go, business owners MUST approve:
- RPO: maximum acceptable data-loss window;
- RTO: maximum acceptable service-restoration time.

Infrastructure cost/HA/backup frequency MUST be driven by approved RPO/RTO, not guessed by Codex.

If no approved values exist, Codex MUST mark DECISION_REQUIRED and MUST NOT invent them.

### OR-11 Disaster/recovery decision classes

Use the smallest safe recovery action:
- bad single/business record → governed business correction/recovery;
- bad application release → application rollback;
- data corruption → approved data recovery/PITR;
- database loss → full restore;
- environment loss → environment rebuild;
- GitHub loss/unavailability → repository mirror recovery.

Do not use full DB restore as a generic response to application defects.

### OR-12 G8 Operational Readiness gate

G8 cannot PASS until all required Phase 1 operational resilience dispositions are recorded:

- SOURCE_RECOVERY = PASS
- DB_BACKUP_RESTORE = PASS
- MIGRATION_REPRODUCIBILITY = PASS
- EVIDENCE_STORAGE_RECOVERY = PASS or NOT_APPLICABLE_WITH_EVIDENCE
- ENVIRONMENT_INVENTORY = PASS
- SECRET_RECOVERY = PASS
- MINIMUM_MONITORING = PASS
- OPERATIONS_RUNBOOKS = PASS
- INCIDENT_RELEASE_ROLLBACK_RUNBOOKS = PASS
- RPO_RTO = APPROVED

Any BLOCKED/FAIL/DECISION_REQUIRED item prevents G9 Production Go/No-Go from becoming GO.

### OR-13 Scope control

Do NOT expand this into:
- multi-region active-active;
- enterprise SIEM;
- autonomous remediation;
- AI-based incident response;
- complex data-governance runtime;
- analytics/AI backup infrastructure.

Those require separate approval in later phases.

Phase 1 goal: prove that the exact released UCell system and its critical business data can be identified, backed up, rebuilt/restored, verified, monitored and operationally recovered.
