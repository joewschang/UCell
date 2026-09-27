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


## 13. Phase 1 Error Recording, Reporting & Codex Repairability Rules

**Status:** MANDATORY G8 OPERATIONAL READINESS FOUNDATION.
**Timing:** define now; implement in a separately authorized G8 Operational Readiness train after G1→G4 closure unless required earlier to fix a P0 defect.
**Goal:** make runtime failures diagnosable and safely repairable without granting Codex autonomous Production mutation.

### ER-1 Structured Error Event

Backend, Worker and enabled external adapters MUST emit a common structured error envelope for material failures.

Minimum fields:
- errorId
- traceId
- occurredAt
- environment
- service/component
- releaseVersion/gitHead
- severity
- errorCode
- errorClass
- operation/route/job
- safe business references where necessary (memberNo, ballNo, orderNo; never unrestricted PII)
- retryable
- firstSeen/lastSeen/occurrenceCount where aggregation exists
- sanitized message
- sanitized stack/diagnostic reference

MUST NOT log plaintext passwords, access tokens, private keys, LINE tokens, full banking data, unrestricted identity data, raw request bodies containing sensitive PII, or Production DB credentials.

### ER-2 Trace Correlation

Every material request/background operation MUST carry or create a traceId/correlation identifier sufficient to connect:
request → API/service → worker/job → external adapter → business/audit/error evidence.

The identifier MUST NOT itself encode sensitive business data.

Member-facing errors may expose a safe support/error reference, not internal stack traces.

### ER-3 Controlled Error Code Catalog

Material business/technical failures MUST use stable controlled error codes instead of relying only on HTTP 500/free-text messages.

Initial domains include:
- PAYMENT_*
- PLACEMENT_*
- LINE_LINK_* / LINE_REBIND_*
- RETAIL_REFERRAL_*
- RETURN_REPLAY_* / RECOVERY_*
- ERP_HANDOFF_*
- AUTH_* / ACCESS_*
- INTERNAL_*

New codes require documentation and must preserve backward-safe API behavior where applicable.

### ER-4 Error Fingerprint and Deduplication

Monitoring/reporting SHOULD derive a privacy-safe fingerprint from stable diagnostic attributes such as:
service + errorCode + exceptionClass + normalized stack location + release version.

Repeated equivalent failures SHOULD update occurrence metadata rather than create unbounded duplicate incidents/issues.

Fingerprint inputs MUST exclude raw PII/secrets.

### ER-5 GitHub Issue Repair Contract

GitHub is the Phase 1 engineering issue/repair SSOT.

A repairable runtime issue SHOULD contain:
- environment;
- affected release/gitHead;
- errorCode/fingerprint;
- first/last seen;
- occurrence count;
- sanitized trace references;
- expected vs actual behavior;
- privacy classification;
- sanitized diagnostic/log artifact reference;
- reproduction status;
- severity/priority;
- affected Gate/domain.

Issue content MUST NOT contain secrets or unrestricted Production data.

### ER-6 Sanitized Diagnostic Package

Codex MUST receive only the minimum diagnostic evidence required to reproduce/fix:
- Issue metadata;
- relevant code/test authority;
- error code;
- sanitized stack/log slice;
- trace metadata;
- release/version;
- safe business references;
- test/Golden evidence.

Do NOT provide Codex unrestricted Production DB access, Production credentials, raw DB dumps, secrets or unnecessary member PII merely to speed diagnosis.

### ER-7 Codex Repair Workflow

Authorized Codex repair work MUST follow:
1. read governing authority and issue evidence;
2. reproduce the defect where feasible;
3. create/update a regression test that fails for the defect;
4. verify the test fails for the expected reason;
5. implement the smallest safe fix;
6. run focused tests;
7. run affected Golden/security/privacy gates;
8. run required broader regression according to impact;
9. commit/push to authorized development branch or PR;
10. report evidence and remaining risks.

Codex MUST NOT weaken an approved assertion/Golden merely to make CI green.

### ER-8 Repair Automation Classes

AUTO_FIX_CANDIDATE:
- deterministic null/serialization/rendering defect;
- stale test assertion where current authority proves the expected contract changed;
- retry/idempotency implementation defect with approved semantics;
- other low-risk deterministic defects with an existing authoritative expected result.

HUMAN_REVIEW_REQUIRED:
- Payment;
- Placement;
- LINE identity/link/rebind;
- Award/Settlement/Payout;
- Return/Recovery;
- Privacy/security;
- migrations/schema/data repair;
- any economic or identity-affecting behavior.

DECISION_REQUIRED / NEVER_AUTO_DECIDE:
- ambiguous R1.0B meaning;
- bonus/rank/Active/Sponsor rule conflict;
- Person merge/identity ownership decision;
- bank-account ownership/change decision;
- historical migration reconstruction;
- bulk Production data correction;
- authority conflict.

Codex may analyze/propose for these classes but MUST NOT invent business truth.

### ER-9 Production Mutation Boundary

No runtime error may trigger direct Codex mutation of Production.

The allowed automated target is at most:
error/monitor → issue/evidence → Codex diagnosis/fix → development branch/PR → CI.

Stage/Production deployment remains governed by release approval. Production data correction follows a separately approved business/data recovery procedure.

### ER-10 Issue Creation Automation

Phase 1 requires the Issue Contract and repairability foundation; automatic Issue creation and automatic Codex invocation are OPTIONAL until separately approved.

If later enabled:
- deduplicate by fingerprint;
- apply severity/rate thresholds;
- sanitize before GitHub;
- prevent PII/secrets from issue body/artifacts;
- rate-limit issue creation;
- never auto-close a security/economic incident solely because errors stop.

### ER-11 Minimum Monitoring Integration

The OR-8 monitoring surfaces MUST produce enough structured evidence to identify:
- service/operation;
- release;
- errorCode;
- traceId;
- occurrence trend;
- actionable diagnostic reference.

Monitoring products/vendors are implementation choices and are not mandated by this rule.

### ER-12 G8 Repairability Acceptance

Before G8 Operational Readiness can PASS:
- ERROR_STRUCTURED_LOGGING = PASS
- TRACE_CORRELATION = PASS
- ERROR_CODE_CATALOG = PASS
- ERROR_FINGERPRINT = PASS or explicitly DEFERRED_WITH_APPROVED_REASON if monitoring backend cannot yet aggregate
- GITHUB_ISSUE_REPAIR_CONTRACT = PASS
- SANITIZED_DIAGNOSTIC_PACKAGE = PASS
- CODEX_REPAIR_RUNBOOK = PASS
- PRODUCTION_AUTO_MUTATION = DISABLED

AUTO_CREATE_ISSUE and AUTO_INVOKE_CODEX are not required for Phase 1 GA unless separately approved.


## 14. Phase 1 User Activity Audit & Operational Audit Rules

**Status:** MANDATORY G8 OPERATIONAL READINESS FOUNDATION.
**Timing:** define now; implement in a separately authorized G8 Operational Readiness train after G1→G4 closure unless a P0 security/financial defect requires earlier implementation.
**Goal:** provide a minimal, trustworthy, privacy-safe audit trail for high-risk user/admin actions and security events without expanding Phase 1 into a full SIEM or enterprise data-access governance platform.

### UA-1 Audit domains and separation

Maintain three logically distinct evidence classes:
1. Application/Error Log — engineering diagnostics and failures.
2. Security Audit — authentication, authorization, denied access, session/security events.
3. Business Audit — authoritative evidence of high-risk business/admin actions.

They MAY share traceId/correlation context but MUST NOT be treated as one undifferentiated log stream.

### UA-2 AuditEvent core

Implement a common append-oriented AuditEvent contract for Security/Business audit events.

Minimum fields:
- auditEventId
- eventCode
- occurredAt
- environment
- traceId
- actorType (USER/SERVICE/SYSTEM)
- actorRef
- actorRole/capability snapshot where relevant
- action
- resourceType
- safe business resourceRef
- result (SUCCESS/DENIED/FAILED)
- reasonCode
- evidenceRef where applicable
- changedFieldNames where applicable
- beforeHash/afterHash or masked change evidence where justified
- severity
- privacyClass
- retentionClass
- createdAt

Normal Admin/Member audit views SHOULD prefer business identifiers such as memberNo, ballNo, orderNo and paperApplicationNo rather than internal UUIDs.

### UA-3 Mandatory Phase 1 business audit events

At minimum audit successful and failed/denied high-risk mutations for:
- Person/member creation and approved sensitive identity changes;
- Paper Application creation;
- Paper Receipt evidence entry/change attempt;
- Payment confirmation/reversal;
- Qualification state-changing admin operations;
- Placement commit and Admin placement-on-behalf;
- LINE link/rebind/recovery approval and completion;
- Order cancellation/refund/return where operationally available;
- Retail Referral attribution correction;
- Award/Recovery/Settlement/Payout administrative corrections or approvals where available;
- Company Sponsor Alias create/change/disable;
- role/permission/security-sensitive configuration changes.

Existing domain-specific immutable evidence remains authoritative where already defined; AuditEvent links to it rather than replacing or duplicating it.

### UA-4 Mandatory Phase 1 security audit events

At minimum:
- LOGIN_SUCCEEDED
- LOGIN_FAILED
- LOGOUT or SESSION_REVOKED where observable
- ACCESS_DENIED
- BOLA/IDOR_BLOCKED where detected
- SENSITIVE_ACTION_APPROVED/DENIED
- LINE_LINK/REBIND security events
- ROLE_OR_PERMISSION_CHANGED

Security events MUST NOT store credentials, tokens or unrestricted PII.

### UA-5 Read-access scope control

Phase 1 does NOT require permanent audit of every ordinary page read.

Required Phase 1 read/access audit is limited to high-risk cases such as:
- restricted/security/finance views where implemented;
- bulk export/download of sensitive operational data;
- explicit privileged access to protected data.

Comprehensive data-read/purpose/export/AI access governance is Phase 2+.

### UA-6 Append-only and correction semantics

Business/Security audit history MUST be append-oriented.
Application code MUST NOT silently rewrite or delete historical audit events as a normal business operation.

If audit metadata must be corrected, create a correction/superseding event referencing the original event.

Retention/purge, if legally or operationally required, must use an approved retention process rather than arbitrary application DELETE.

### UA-7 Privacy minimization

Audit MUST NOT become a second PII database.

Do not copy entire request/response payloads or full entity snapshots into AuditEvent.

For changes:
- store changed field names;
- use beforeHash/afterHash where sufficient;
- use masked before/after only where operationally justified;
- link to authoritative evidence by evidenceRef.

Never audit plaintext password, access token, private key, LINE token, full banking credential/account data, or raw sensitive identity documents.

### UA-8 Trace linkage

Audit events for a business operation MUST carry the same traceId/correlation context used by application/error diagnostics where feasible.

This must allow an authorized operator to correlate:
Business operation → security decision → runtime error → worker/external adapter evidence
without exposing secrets.

### UA-9 Audit search

Before GA provide a minimal RBAC-protected Admin audit search/read model.

At minimum support authorized lookup by applicable identifiers:
- traceId
- memberNo
- ballNo
- orderNo
- paperApplicationNo
- eventCode
- actorRef
- time range

Search results MUST apply privacy/RBAC rules and MUST NOT expose hidden bootstrap/Reservoir/member PII contrary to existing P0 policy.

### UA-10 Audit RBAC

Audit visibility is itself protected data.

Support/Operations/Finance/Security/Super Admin access MUST follow least privilege.
The ability to perform an operation does not automatically grant unrestricted visibility into all audit domains.

No role, including Super Admin, receives plaintext secrets through audit.

### UA-11 Integrity baseline

Phase 1 requires append-only application semantics and integrity evidence sufficient to detect unauthorized mutation.

Hash chaining/daily immutable checkpoints MAY be implemented in G8 if low-risk and operationally justified, but are not mandatory for Phase 1 GA unless required by an approved security decision.

A future Phase 2 may add stronger immutable storage/SIEM retention controls.

### UA-12 Relationship to Error/Codex repair

AuditEvent is not the error log and does not automatically create repair work.

When an audited operation fails:
Audit/security evidence + structured error evidence + traceId
may form the sanitized diagnostic package defined by ER-6.

Any GitHub Issue/Codex repair automation remains subject to ER-7 through ER-10 and may never mutate Production directly.

### UA-13 G8 audit acceptance

Before G8 Operational Readiness can PASS:
- AUDIT_EVENT_CORE = PASS
- HIGH_RISK_WRITE_AUDIT = PASS
- SECURITY_EVENT_AUDIT = PASS
- TRACE_LINKAGE = PASS
- APPEND_ONLY_AUDIT = PASS
- PII_MINIMIZATION = PASS
- AUDIT_SEARCH = PASS
- AUDIT_RBAC = PASS

Any FAIL/BLOCKED item prevents G9 Production Go/No-Go from becoming GO.

### UA-14 Scope control

Do NOT expand Phase 1 audit into:
- full user clickstream analytics;
- permanent logging of every page read;
- enterprise SIEM;
- behavioral surveillance;
- AI-agent audit;
- comprehensive purpose-based data-access governance;
- data lake/log warehouse.

Those require separate later-phase approval.

Phase 1 objective: reliably answer, for important operational/security actions, **who did what, when, to which business object, under what authority, with what result, and which evidence/trace proves it**.


## 15. Phase 1 Operational Recovery Objectives — Business Approval

**Status:** AUTHORITATIVE / APPROVED
**Approved date:** 2026-09-26 (Asia/Taipei)
**Scope:** Phase 1 Production operational readiness and disaster recovery.

The business owner approves the following Phase-1 recovery objectives:

- **RPO_TARGET = 1 hour maximum**
- **RTO_TARGET = 4 hours maximum**

Definitions:
- RPO is the maximum acceptable data-loss window following a qualifying disaster/recovery event.
- RTO is the target maximum elapsed time to restore the approved core UCell service following a qualifying major outage.

These are operational objectives, not assumptions that current infrastructure automatically satisfies them.

G8 MUST evaluate actual Azure PostgreSQL PITR capability, backup/restore procedures, application/environment rebuild dependencies, and measured restore-drill evidence against these targets.

The configured PITR retention window (currently evidenced separately as 7 days on Stage) is NOT itself proof of RPO compliance.

Required G8 evidence:
- RPO_TARGET = 1H
- RTO_TARGET = 4H
- RPO_EVIDENCE = PASS / FAIL with basis
- RTO_EVIDENCE = PASS / FAIL with basis
- any remediation gap if current capability does not satisfy either objective.

Codex MUST NOT weaken these targets or mark them PASS without evidence.

Changes to these targets require a new explicit business-owner decision.


## 16. Serialized Product Unit Identification v1.0 — Approved Future Fulfillment Rule

**Status:** AUTHORITATIVE BUSINESS DEFINITION / FUTURE IMPLEMENTATION
**Approved date:** 2026-09-26 (Asia/Taipei)
**Implementation phase:** Post-R1.0B / Phase 1.1 Serialized Fulfillment unless separately promoted by authority.
**Phase-1 freeze impact:** Definition only. This approval MUST NOT reopen the frozen R1.0B Business Core or block G8/G9.

### SF-1 Purpose

UCell physical fulfillment requires traceability from Order → SKU → Lot/Batch → individual serialized product unit → Shipment → customer/member.

The serialized identifier is an individual physical-unit identity. It is not inventory quantity, PV/BV, order identity, Ball identity, or member identity.

### SF-2 Product code authority

Initial controlled product-code mapping:

- A = TIP-363
- B = TIP-999
- C = TIP-580
- D = TIP-696
- E = TIP-777

Product codes are controlled master data and MUST NOT be inferred from display names or freely assigned by warehouse operators.

### SF-3 Serial format

Approved v1 format:

`PBBBSSSS`

- P = product code, exactly 1 controlled alphanumeric character.
- BBB = product-specific batch sequence, exactly 3 decimal digits, 001–999.
- SSSS = unit sequence within that product batch, exactly 4 decimal digits, 0001–9999.
- Total serialized unit identifier length = 8 characters.

Examples:
- A0010001 = TIP-363, batch 001, unit 0001.
- A0012000 = TIP-363, batch 001, unit 2000.
- A0010001 through A0012000 represents 2,000 individually serialized TIP-363 units in batch 001.

The final 4 digits are formally named **unit sequence / 流水號**, not quantity.

### SF-4 Capacity and overflow

One product batch can contain at most 9,999 serialized units under v1.

The system MUST NOT silently overflow, wrap, reuse, truncate, or extend SSSS beyond 9999.

If a planned physical batch exceeds 9,999 units, implementation MUST require an explicit approved batch-splitting or serial-format-version decision before serial allocation. Codex MUST NOT silently change the identifier length.

### SF-5 Batch semantics

BBB is a product-specific batch sequence.

Therefore A001 and C001 are valid independent batches for different products.

For the same product code, a batch sequence MUST NOT be reused after allocation.

Batch sequence is an identifier component, not a substitute for full manufacturing/lot metadata.

The authoritative ProductLot/Batch record SHOULD separately retain applicable manufacturing and traceability attributes such as:
- lotNo/manufacturer lot;
- manufacturedAt;
- expiryAt;
- receivedAt;
- manufacturer/supplier reference;
- status.

### SF-6 Database decomposition

Do not store only an opaque serial string.

The authoritative serialized-unit model MUST retain, at minimum:
- serialNo;
- productId/SKU reference;
- productCode;
- batch/lot reference;
- batchSeq;
- unitSeq;
- status;
- createdAt and provenance.

Recommended integrity:
- `serialNo UNIQUE`;
- `(productCode, batchSeq, unitSeq) UNIQUE`;
- controlled productCode → SKU mapping;
- batchSeq/unitSeq range checks.

Serial allocation MUST be server-authoritative. Warehouse users MUST NOT freely create arbitrary serial strings.

### SF-7 Barcode payload

The primary serialized-unit barcode MAY encode the canonical 8-character `serialNo` directly, e.g. `A0010001`.

Barcode scanning does not itself establish business truth. Server-side lookup/validation remains authoritative for SKU, batch, status, shipment eligibility and order matching.

SKU/product barcode and serialized-unit barcode are distinct concepts:
- SKU barcode identifies product type;
- serial barcode identifies one unique physical unit.

If a future label combines them, the data model MUST still preserve this semantic distinction.

### SF-8 Serialized-unit lifecycle

Minimum lifecycle vocabulary for future implementation:

- CREATED
- AVAILABLE
- ALLOCATED
- PACKED
- SHIPPED
- DELIVERED where delivery confirmation exists

Exception states include, as applicable:
- RETURNED
- QUARANTINED
- DAMAGED
- EXPIRED
- RECALLED
- VOID

Return MUST NOT automatically imply AVAILABLE. Re-release requires an approved inspection/disposition rule.

### SF-9 Fulfillment verification workflow

Target warehouse workflow:

1. scan/enter public Order barcode/orderNo;
2. load authoritative shippable Order lines;
3. for each physical unit, scan product/SKU barcode where required;
4. scan serialized-unit barcode;
5. server validates:
   - serial exists;
   - serial maps to the required SKU;
   - serial is in an eligible status;
   - serial is not already allocated/shipped;
   - applicable lot/expiry/recall rules;
   - scanned quantity does not exceed Order line quantity;
6. accumulate verified units per Order line;
7. shipment/pack completion is prohibited until every required serialized quantity exactly matches the authoritative Order quantities;
8. successful fulfillment binds Order/OrderLine/Shipment to the serialized units.

Wrong SKU, duplicate scan, already-shipped serial, unknown serial, excess quantity, ineligible/expired/quarantined/recalled unit MUST fail closed.

### SF-10 Traceability

Future implementation MUST support authorized traceability in both directions:

Order/Shipment → serialized units

and

serialNo → Product/SKU → Lot/Batch → Shipment/Order → authorized customer/member reference.

Privacy/RBAC applies to customer/member lookup; a serial lookup does not grant unrestricted member PII access.

### SF-11 ERP boundary

The existing architectural principle remains: UCell MUST NOT unnecessarily recreate ERP inventory/warehouse functions.

Preferred implementation order:

1. If EzTooL (or the approved ERP) natively supports authoritative per-unit serial management, scan-to-order verification, duplicate prevention, lot/expiry traceability and usable integration interfaces, use ERP authority and integrate UCell.
2. If ERP supports inventory/shipment but not the required serialized verification, implement a narrowly scoped UCell Fulfillment Scanner / serialized verification layer integrated with ERP.
3. Only if ERP integration cannot satisfy the approved requirements should a separate UCell warehouse serialized module be considered.

Direct unsupported writes to ERP internal database tables are prohibited.

### SF-12 Integration boundary

UCell remains authoritative for approved UCell business domains such as member/person, UCell order identity, qualification/economic rules and member-facing history.

ERP/fulfillment authority should own physical inventory/shipment facts where supported.

Integration SHOULD use stable business identifiers such as orderNo, SKU, shipmentNo and serialNo, not internal UUID exposure.

### SF-13 Required future implementation evidence

Before Serialized Fulfillment can be considered complete, future implementation must prove at least:
- serial generation uniqueness and concurrency;
- batch/unit range enforcement;
- exact order quantity matching;
- wrong-SKU rejection;
- duplicate scan rejection;
- already-shipped serial rejection;
- shipment exactly-once/idempotency;
- return/disposition behavior;
- lot/expiry/recall handling where applicable;
- Order ↔ Serial traceability;
- Serial ↔ Shipment/Order traceability;
- RBAC/privacy;
- audit evidence for high-risk fulfillment corrections;
- ERP synchronization/retry behavior if integrated.

### SF-14 Current scope control

This decision establishes definitions and future implementation authority only.

Do NOT modify the current frozen R1.0B runtime merely because this definition exists.
Do NOT add Serialized Fulfillment to current G8 blockers.
Do NOT delay G9 solely for this future capability unless separately promoted as a mandatory release requirement.

Any implementation must update all affected layers under the UCell cross-layer rule:
Definition → Semantic/Core terminology → API → DB → Program → Tests/Golden → GitHub → formal documentation/Drive impact.


## 17. R1.0B CR-001 — Seven Company Bootstrap Balls

**Status:** BOARD-APPROVED / AUTHORITATIVE CHANGE REQUEST
**Approved date:** 2026-09-26 (Asia/Taipei)
**Change ID:** R1.0B-CR-001
**Scope:** Binary Tree bootstrap, placement, test/stage data, affected economic/privacy/read-model/API/DB/test/documentation layers.
**Effect on freeze:** This change intentionally reopens only the affected R1.0B scope. Unaffected Phase-1 capabilities remain frozen.

### CR1-1 Board decision

Every Binary Tree MUST begin with exactly seven Company-controlled bootstrap/reservoir Balls.

Authoritative topology:
- binary positions 1 through 7 = Company bootstrap/reservoir Balls only;
- first member-eligible binary position = 8;
- member-owned Balls MUST NOT occupy positions 1 through 7.

This supersedes the prior three-Company-Ball bootstrap rule.

### CR1-2 Topology authority and privacy

- `binaryPositionNo` / `binaryPath` remain topology authority.
- `ballNo` remains an opaque public business identifier and MUST NOT encode or permit derivation of topology.
- Normal Member projections MUST NOT expose protected Company bootstrap/reservoir topology or internal UUIDs.
- Server-side placement is authoritative and MUST reject member placement into reserved positions 1–7.

### CR1-3 Company bootstrap economic isolation

Company bootstrap/reservoir Balls are structural system/company nodes only.

Creating or existing Company bootstrap Balls MUST NOT by themselves create:
- member Qualification;
- member Active status;
- member count;
- PV/BV/GPV/RPV/EPV;
- Retail Referral Award;
- Binary/Matching/Equal-level/Global/Fund entitlement;
- member payout/payable;
- other member economic entitlement.

Any existing economic rule that traverses the tree must preserve its approved member/economic eligibility semantics and MUST NOT treat the four additional Company Balls as member production.

### CR1-4 New-tree initialization

A newly initialized Binary Tree MUST atomically establish the complete seven-Ball Company bootstrap structure at positions 1–7 before member placement is allowed.

The first valid member placement position begins at 8, subject to all other approved placement/authorization/slot rules.

### CR1-5 Existing test and Stage data disposition

The current non-Production databases contain test/UAT data and are explicitly authorized for controlled transformation, cleanup, or rebuild for CR-001.

For Local test databases and Stage/UAT only:
- existing synthetic/test topology MAY be updated using controlled SQL/migration/reseed procedures;
- inconsistent, obsolete, duplicate, or otherwise non-authoritative test data MAY be deleted;
- affected synthetic/UAT trees MAY be rebuilt from approved seeds/fixtures;
- test/UAT business journeys MAY be reseeded after transformation.

Requirements:
- Production remains untouched.
- Do not rewrite committed historical migration files.
- Use forward-only migration/reseed/reconciliation artifacts.
- capture pre-change Stage evidence/recovery point before destructive cleanup;
- preserve any evidence required for prior release/audit reports separately from disposable UAT data;
- verify the resulting Stage/UAT database satisfies the new seven-bootstrap topology and all current schema/runtime invariants.

Because Stage data is non-Production test data, CR-001 does NOT require preservation of obsolete synthetic member positions 4–7. They may be deleted/reseeded rather than historically reparented when that is safer and simpler.

### CR1-6 Migration/reseed strategy

Implementation MUST distinguish:
1. schema/runtime rule changes;
2. deterministic Company bootstrap creation;
3. disposable Local/Stage test-data transformation/reseed.

Do not encode arbitrary UAT cleanup as irreversible Production business-data migration logic.

Production-capable migrations MUST remain safe for an empty/new Production environment. Stage-specific destructive reseed/cleanup SHOULD be implemented as controlled deployment/UAT tooling or explicitly scoped reconciliation, not as a hidden Production data mutation.

### CR1-7 Affected-layer synchronization

CR-001 implementation MUST perform impact assessment and update all affected layers:

- business definition / terminology;
- semantic/core constants and future AI Brain semantic preparation;
- DB schema/constraints/functions/views/migrations/reseed tooling;
- Binary Tree initialization;
- Organization/Placement/Sponsor behavior;
- Paper and WEB_MEMBER onboarding/placement;
- economic traversal/eligibility;
- Admin/Member read models and topology/privacy;
- API/OpenAPI if contract behavior changes;
- tests/Golden/fixtures;
- release/UAT documentation;
- GitHub governance/implementation status;
- Google Drive impact assessment/formal documents where affected.

Phase-2 AI/LLM runtime remains out of scope.

### CR1-8 Mandatory Golden evidence

At minimum:
- NEW_TREE_BOOTSTRAP_7_COMPANY_BALLS = PASS
- POSITIONS_1_TO_7_COMPANY_ONLY = PASS
- FIRST_MEMBER_POSITION_8 = PASS
- MEMBER_PLACEMENT_1_TO_7_REJECTED = PASS
- COMPANY_BOOTSTRAP_NO_PV_BV = PASS
- COMPANY_BOOTSTRAP_NO_AWARD = PASS
- COMPANY_BOOTSTRAP_NO_QUALIFICATION = PASS
- MEMBER_PROJECTION_BOOTSTRAP_PRIVACY = PASS
- BALLNO_TOPOLOGY_PRIVACY = PASS
- PARENT_CHILD_TOPOLOGY = PASS
- PAPER_PLACEMENT_7_BOOTSTRAP = PASS
- WEB_MEMBER_PLACEMENT_7_BOOTSTRAP = PASS
- BINARY_ECONOMIC_GOLDEN = PASS
- BOLA_SECURITY = PASS

### CR1-9 Re-certification

All prior certification materially affected by the three→seven bootstrap change is invalidated until impact-based re-certification completes.

Required before the revised R1.0B baseline can be frozen:
- fresh 0→current migration;
- previous deployed Stage baseline → current upgrade/reseed evidence;
- DB Golden;
- affected economic Golden;
- API/Worker/Admin/Member affected tests/builds;
- OpenAPI governance if affected;
- privacy/BOLA;
- Paper/LINE;
- Retail/Commerce;
- isolated RC/full regression according to impact.

Stage deployment requires controlled authorization and a recovery point. Production remains NOT AUTHORIZED until the revised baseline completes the normal G8/G9 governance path.


## 18. R1.0B CR-001 Amendment A — Company Ball Active & Reservoir-B Economic Routing

**Status:** BOARD-APPROVED / AUTHORITATIVE / SUPERSEDING ECONOMIC RULE
**Approved date:** 2026-09-26 (Asia/Taipei)
**Change ID:** R1.0B-CR-001-A
**Scope:** All Company-owned Balls, including the seven bootstrap Balls at positions 1–7 and Company Balls at any other binary positions.

This amendment supersedes any conflicting language in CR-001, especially CR1-3 statements that Company bootstrap Balls do not participate in Award/economic entitlement.

### CR1A-1 Company Ball Active authority

Every Company-owned Ball is **ALWAYS_ACTIVE** for all approved bonus/award eligibility calculations.

This applies to:
- the seven Company bootstrap/reservoir Balls at binary positions 1–7; and
- any Company-owned Ball located at other valid binary positions.

Company Ball Active eligibility does not depend on member repurchase, rolling-30-day consumption, member Active qualification, or other member-maintenance conditions.

A Company Ball is not a natural-person/member Active record merely because it is ALWAYS_ACTIVE. Person/member identity semantics remain separate.

### CR1A-2 Award participation

Company-owned Balls participate in the approved bonus distribution/award calculations wherever the applicable R1.0B award rule uses Ball/tree eligibility.

They MUST NOT be filtered out merely because ownership is Company rather than Member.

The seven bootstrap Balls therefore are structural nodes **and** eligible Company economic recipients under the approved award rules.

This amendment does not by itself create new award formulas, rates, generations, pools, PV/BV generation rules, or traversal rules. Existing approved R1.0B calculation semantics remain authoritative except that Company Balls are always Active and eligible to receive applicable Awards.

### CR1A-3 Reservoir B routing

All monetary/economic Award results attributable to any Company-owned Ball MUST route to **Reservoir B / 水庫B** as the economic beneficiary/destination.

Required invariant:

`Company-owned Ball Award → Reservoir B`

The Award engine MUST preserve source evidence sufficient to identify:
- source Company Ball;
- award type;
- calculation period/event;
- theoretical/final amount as applicable;
- Reservoir B as beneficiary/destination;
- trace/audit/economic evidence.

Company Ball Awards MUST NOT create a personal member payable or be paid to a synthetic/bootstrap Person.

### CR1A-4 Identity and accounting separation

The system MUST distinguish:
- Ball ownership = COMPANY;
- Active eligibility = ALWAYS_ACTIVE;
- Award source = Company Ball;
- economic destination/beneficiary = Reservoir B.

Do not model this by pretending the Company Ball is an ordinary member or by assigning a fake member consumption state.

Reservoir B routing must use the approved company/reservoir accounting authority and must remain auditable.

### CR1A-5 Volume-generation boundary

This amendment authorizes Company Balls to be always Active and to participate as Award recipients.

It does **not** independently authorize synthetic PV/BV/GPV/RPV/EPV production merely from the existence of a Company Ball.

Any volume entering award calculations must still originate from the existing approved transaction/volume rules.

If an existing award formula uses descendant/team volume, Company Balls may receive the resulting applicable Award under the normal formula; their existence alone does not manufacture volume.

### CR1A-6 Placement and privacy unchanged

CR-001 topology rules remain unchanged:
- positions 1–7 are Company-only;
- first member-eligible position is 8;
- Company Balls may also exist at other valid positions under approved Company placement rules;
- ballNo remains opaque;
- binaryPositionNo/binaryPath remain topology authority;
- protected bootstrap/reservoir topology remains hidden from normal Member projections.

### CR1A-7 Required implementation impact

CR-001 implementation MUST additionally inspect/update:
- Active eligibility resolver;
- Ball owner-type policy;
- award recipient eligibility;
- Binary/Matching/Equal-level/Global/Fund calculations as applicable;
- payable/settlement routing;
- Reservoir B ledger/accounting;
- Explain/read models;
- Admin economic evidence;
- DB constraints/views/functions;
- Golden/economic replay;
- audit/trace evidence;
- Stage reseed/UAT data.

Do not hard-code Reservoir B routing separately in each award formula when a common authoritative beneficiary-routing layer can enforce it safely.

### CR1A-8 Mandatory Golden evidence

Replace conflicting CR1-8 economic-isolation expectations with:

- COMPANY_BALL_ALWAYS_ACTIVE = PASS
- BOOTSTRAP_1_TO_7_ALWAYS_ACTIVE = PASS
- OTHER_COMPANY_BALL_ALWAYS_ACTIVE = PASS
- COMPANY_BALL_PARTICIPATES_APPLICABLE_AWARDS = PASS
- COMPANY_BALL_AWARD_ROUTES_RESERVOIR_B = PASS
- COMPANY_BALL_NO_PERSONAL_MEMBER_PAYABLE = PASS
- COMPANY_BALL_EXISTENCE_DOES_NOT_SYNTHESIZE_VOLUME = PASS
- RESERVOIR_B_ROUTING_IDEMPOTENT = PASS
- RESERVOIR_B_ROUTING_REPLAY_STABLE = PASS
- COMPANY_BALL_AWARD_EXPLAIN_AUDIT = PASS

The following prior CR1-8 expectations are explicitly **SUPERSEDED and MUST NOT be implemented**:
- COMPANY_BOOTSTRAP_NO_PV_BV, to the extent it was interpreted as excluding Company Balls from award participation; the correct rule is no synthetic volume generation from mere existence.
- COMPANY_BOOTSTRAP_NO_AWARD.
- any test asserting Company Balls are economically ineligible solely because they are Company-owned.

### CR1A-9 Re-certification consequence

Any CR-001 implementation/test work based on the superseded economic-isolation assumption MUST be corrected before certification.

Re-certification must prove both:
1. seven-Company-Ball topology / member starts at position 8; and
2. all Company Balls are ALWAYS_ACTIVE, participate in applicable Awards, and route resulting Company economic benefit to Reservoir B.

Production remains NOT AUTHORIZED until the revised CR-001-A behavior completes Local and Stage re-certification.


## 19. R1.0B CR-001 Amendment B — Founder Company Ball Qualification

**Status:** BOARD-APPROVED / AUTHORITATIVE / SUPERSEDING WHERE CONFLICTING
**Approved date:** 2026-09-26 (Asia/Taipei)
**Change ID:** R1.0B-CR-001-B
**Scope:** The first seven founder Company Balls of every Binary Tree.

### CR1B-1 Founder Company Ball qualification

Each Binary Tree's first seven Company Balls at binary positions 1 through 7 are formally classified as **Founder Company Balls / 創始公司球**.

Every Founder Company Ball MUST carry the approved **NT$72,000 Leader Membership Qualification / 72,000 領袖會員資格**.

Required invariant:

`binaryPositionNo in 1..7 AND ownerType = COMPANY → qualification = LEADER_72000`

This qualification is system/company bootstrap authority. It is not acquired through an ordinary natural-person member purchase or member consumption transaction.

### CR1B-2 Relationship to Active and Award rules

CR-001 Amendment A remains authoritative:

- Founder Company Balls are ALWAYS_ACTIVE.
- Founder Company Balls participate in all applicable approved Award calculations.
- Award/economic benefit attributable to a Founder Company Ball routes to Reservoir B.
- No personal/synthetic Member payable is created.

The 72,000 Leader qualification therefore establishes the Founder Company Ball's qualification/rank baseline for applicable R1.0B eligibility calculations.

### CR1B-3 No synthetic purchase/volume side effect

Assigning the 72,000 Leader qualification to a Founder Company Ball MUST NOT be implemented as a fake member purchase, fake order, fake payment, or fake member consumption merely to manufacture qualification.

Unless another approved rule explicitly states otherwise, bootstrap assignment of LEADER_72000 MUST NOT by itself synthesize transaction-derived PV/BV/GPV/RPV/EPV.

The system must distinguish:
- qualification/rank baseline = LEADER_72000;
- Active eligibility = ALWAYS_ACTIVE;
- Ball ownership = COMPANY;
- economic beneficiary = RESERVOIR_B;
- transaction/volume provenance = governed by actual approved volume rules.

### CR1B-4 Scope distinction for other Company Balls

This amendment specifically assigns the 72,000 Leader qualification to the **first seven Founder Company Balls of each Binary Tree**.

Other Company-owned Balls at positions outside 1–7 remain subject to Amendment A's ALWAYS_ACTIVE and Reservoir-B routing rules, but MUST NOT automatically inherit LEADER_72000 solely because they are Company-owned unless separately authorized by an approved rule.

### CR1B-5 Initialization and persistence

New Binary Tree initialization MUST atomically establish positions 1–7 with:
- ownerType = COMPANY;
- founderCompanyBall = true or equivalent authoritative classification;
- qualification/rank baseline = LEADER_72000;
- Active eligibility = ALWAYS_ACTIVE;
- economic beneficiary routing = RESERVOIR_B.

The implementation should use controlled constants/policy/master data rather than duplicating literal 72000 logic throughout award engines.

### CR1B-6 Test/Stage reseed

Under the previously approved CR-001 test/UAT data authority, Local and Stage synthetic trees may be deleted/rebuilt/reseeded so that every tree's positions 1–7 conform to this Founder Company Ball qualification rule.

Production remains untouched.

### CR1B-7 Required implementation impact

CR-001 implementation MUST additionally inspect/update:
- qualification/rank model and controlled constants;
- tree bootstrap initializer;
- Company Ball policy;
- Active resolver;
- award/rank eligibility;
- Reservoir B beneficiary routing;
- Admin read/explain models;
- DB constraints/views/functions if affected;
- UAT seed/fixtures;
- economic Golden/replay;
- data dictionary and formal documentation.

Do not create a fake Person/member record merely to represent the 72,000 Leader qualification if Company Ball qualification can be represented directly by the authoritative Company/Ball model.

### CR1B-8 Mandatory Golden evidence

Add the following mandatory CR-001 Golden evidence:

- FOUNDER_COMPANY_BALL_COUNT_7 = PASS
- FOUNDER_COMPANY_POSITIONS_1_TO_7 = PASS
- FOUNDER_COMPANY_QUALIFICATION_LEADER_72000 = PASS
- FOUNDER_COMPANY_ALWAYS_ACTIVE = PASS
- FOUNDER_COMPANY_AWARD_ELIGIBILITY = PASS
- FOUNDER_COMPANY_AWARD_ROUTES_RESERVOIR_B = PASS
- FOUNDER_COMPANY_NO_FAKE_MEMBER_PURCHASE = PASS
- FOUNDER_COMPANY_QUALIFICATION_NO_SYNTHETIC_VOLUME = PASS
- OTHER_COMPANY_BALL_NO_IMPLICIT_LEADER_72000 = PASS
- FOUNDER_COMPANY_REPLAY_STABLE = PASS

Any prior CR-001 implementation or fixture that creates positions 1–7 without the LEADER_72000 qualification baseline is incomplete and must be corrected before CR-001 certification.


## 20. R1.0B CR-002 — Unified Qualification Enrollment, Product Selection, Subscription & Paper Evidence

**Status:** APPROVED REQUIREMENT / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-26 (Asia/Taipei)
**Change ID:** R1.0B-CR-002
**Implementation timing:** Hold for the current change-batch consolidation; do not implement until explicitly authorized.
**Relationship:** Must be designed consistently with CR-001 seven-Founder-Company-Ball topology and current Paper/Person/Order/Placement authorities.

### CR2-1 Channels and shared authority

CR-002 establishes one shared qualification/product-selection authority for:
1. Admin paper fast-enrollment workbench; and
2. LINE OA / Member mobile enrollment and purchase flow.

Admin and LINE/Member MUST NOT maintain independent package quantities, product eligibility, pricing, PV/BV, subscription rules, or Order semantics.

Both channels must reuse authoritative PackageConfig/Product/Order/Person/Sponsor/Placement services where applicable.

### CR2-2 Qualification package selection quantities

Initial approved selectable qualification package quantities across the controlled five-product pool:

- STARTER / 啟航: total exactly 3 units
- ELITE / 菁英: total exactly 9 units
- LEADER / 領袖: total exactly 15 units

Controlled product pool:
- TIP-363
- TIP-999
- TIP-580
- TIP-696
- TIP-777

The operator/member selects the quantity of each product. The sum across the five products MUST equal the package-required quantity.

Do not hard-code 3/9/15 independently in Admin or LINE UI. PackageConfig/versioned authority must provide requiredSelectionQty and eligible products.

Unless separately approved, no per-SKU minimum/maximum is implied beyond total package quantity and product eligibility.

### CR2-3 Additional purchase

Additional Purchase is optional and semantically separate from Qualification Package selection.

Order lines must distinguish at least:
- QUALIFICATION_PACKAGE
- ADDITIONAL_PURCHASE
- SUBSCRIPTION

Additional units MUST NOT alter the qualification package's required 3/9/15 count.

Pricing, PV/BV and product rules remain server-authoritative from current SKU/rule configuration; Admin users must not manually invent PV/BV.

### CR2-4 Subscription plans

Approved initial subscription plan selection quantities:
- QUARTERLY / 季重銷: 2 units
- SEMI_ANNUAL / 半年重銷: 4 units
- ANNUAL / 年重銷: 8 units

Subscription product selection uses the same controlled five-product pool unless a versioned subscription rule later narrows eligibility.

The following subscription semantics remain **DECISION_REQUIRED before implementation**:
- whether 2/4/8 means units per shipment/period or total units across the entire subscription term;
- whether the selected product mix is fixed for the whole subscription or may be changed for later deliveries;
- scheduling/cutoff behavior for future subscription deliveries.

Codex MUST NOT infer these rules.

### CR2-5 Admin Paper Fast Enrollment Workbench

The target Admin workbench must support, through one controlled workflow:
- member/applicant information;
- existing-Person reuse / duplicate-review safeguards;
- Sponsor/recommending Ball using public Ball business identifier and server SponsorResolver;
- placement parent/slot using approved public placement semantics;
- qualification package selection;
- five-product quantity detail;
- optional additional purchase;
- optional subscription plan and subscription product detail;
- preview/confirmation;
- document generation/printing.

CR-001 applies to placement: Founder Company Balls occupy positions 1–7 and normal member placement begins under the approved position-8+ topology rules.

Fast enrollment MUST NOT bypass Person identity, Sponsor, Order, Payment, Placement, privacy or idempotency authority.

### CR2-6 LINE OA / Member mobile selection UX

LINE OA / Member flow must use the same package/subscription validators and Order Core.

Mobile UX should present stepwise selection and quantity controls suitable for touch use.

For qualification package selection:
- show required total (3/9/15);
- show selected total;
- prevent completion while under-selected;
- prevent qualification allocation above the package total;
- additional quantities must be explicitly classified as Additional Purchase rather than silently increasing qualification quantity.

For subscription:
- show selected plan and required product-selection quantity;
- enforce the authoritative plan configuration.

### CR2-7 Paper document set

Paper enrollment must generate the applicable current-version documents for printing:
1. Membership Application / 會員申請表
2. Order Form / 訂購單
3. Distributor Agreement / 經銷商合約

The Order Form must preserve the confirmed breakdown of:
- qualification;
- qualification product selection;
- additional purchase;
- subscription plan;
- subscription product selection;
- authoritative pricing and other required transaction fields.

Contract/application/order document versions must be captured so the system can identify what content/version was printed at the time.

### CR2-8 Paper evidence policy

**SIGNED PAPER ORIGINAL IS AUTHORITATIVE.**

After system generation:
- documents are printed;
- member signs the physical paper originals;
- the company retains the signed paper records.

Phase-1 CR-002 does **NOT** require:
- scanning signed documents;
- uploading signed PDF/images;
- OCR;
- signature-image storage;
- electronic signature capture;
- PDF digital-signature validation.

The system retains structured print-time/document-version evidence, not the member's signature image.

At minimum retain, where applicable:
- paperApplicationNo;
- orderNo;
- memberNo after authoritative creation;
- applicant/member snapshot required for the printed document;
- Sponsor/placement business-reference snapshot;
- qualification/package/version;
- product-selection snapshot;
- additional-purchase snapshot;
- subscription-plan/product-selection snapshot;
- pricing/PV/BV/rule snapshot as required by the authoritative document;
- applicationFormVersion;
- orderFormVersion;
- contractVersion;
- generatedAt/printedAt;
- generatedBy/printedBy;
- print batch/reference;
- paper evidence status.

Recommended paper evidence states:
- GENERATED
- PRINTED
- SIGNED_CONFIRMED
- FILED

SIGNED_CONFIRMED means an authorized operator confirms receipt of the signed physical paper. It is NOT an electronic-signature verification.

### CR2-9 Paper cross-reference

The three printed documents should carry common business references sufficient for controlled filing/retrieval, such as:
- paperApplicationNo;
- orderNo;
- memberNo when available.

A document barcode/QR may encode a safe business document/application reference for Admin retrieval. It MUST NOT expose internal UUIDs or sensitive identity data.

### CR2-10 Snapshot/version authority

Printed evidence must be reproducible as the historical confirmed business snapshot, not regenerated from today's current Package/Product/Contract rules.

Historical document evidence must therefore reference/version the effective rules and document templates used at generation/confirmation time.

### CR2-11 Scope exclusions

CR-002 does not authorize:
- a separate Paper economic engine;
- a separate LINE package engine;
- direct client authority over Sponsor/Placement;
- manual Admin PV/BV invention;
- signed-document image storage;
- OCR/document AI;
- electronic signature;
- Phase-2 AI runtime.

### CR2-12 Cross-layer implementation requirement

When implementation is later authorized, assess/update all affected:
Definition → Semantic/Core terminology → PackageConfig/Product rules → Subscription rules → Person/Paper → Sponsor/Placement → Order/Payment → API/OpenAPI → DB → Admin → Member/LINE → document templates/snapshots → tests/Golden → GitHub → Google Drive impact.

Current status remains IMPLEMENTATION_PENDING until the change batch is explicitly released for development.


## 21. R1.0B CR-BATCH-01 — Membership, Fulfillment & Company-Ball Integrated Change Package

**Status:** BOARD/OWNER-APPROVED REQUIREMENT BATCH / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-26 (Asia/Taipei)
**Batch ID:** R1.0B-CR-BATCH-01
**Implementation timing:** Requirements consolidation first. Do not implement until explicit batch-release authorization.
**Supersession/relationship:** This batch groups and governs CR-001 (including Amendments A/B), CR-002, and the Serialized Fulfillment / Order-to-Fulfillment / ERP handoff requirement. Existing detailed sections remain authoritative source detail; this section is the integrated change-package control plane.

### B01-1 Integrated scope

This batch contains three coordinated workstreams:

**A. Binary Tree / Company Ball policy**
- seven Founder Company Balls at positions 1–7 of every Binary Tree;
- normal member Balls begin at position 8;
- Founder Company Balls carry LEADER_72000 qualification;
- all Company-owned Balls are ALWAYS_ACTIVE;
- all Company-owned Balls participate in applicable approved Awards;
- Company-owned Ball economic Awards route to Reservoir B;
- qualification/bootstrap existence alone does not synthesize transaction-derived volume;
- BallNo remains opaque and topology authority remains binaryPositionNo/binaryPath.

**B. Unified Enrollment / Product Selection / Subscription / Paper Evidence**
- Admin Paper Fast Enrollment Workbench;
- LINE OA / Member mobile selection using the same server authority;
- qualification product selection across TIP-363/TIP-999/TIP-580/TIP-696/TIP-777;
- STARTER 3, ELITE 9, LEADER 15 exact qualification selection quantities;
- optional Additional Purchase;
- QUARTERLY 2, SEMI_ANNUAL 4, ANNUAL 8 subscription selection quantities, with unresolved delivery semantics retained as DECISION_REQUIRED;
- Membership Application, Order Form and Distributor Agreement printing;
- signed physical paper original is authoritative;
- no signed-document scanning/OCR/e-signature requirement;
- structured historical document/version snapshot retained.

**C. Serialized Fulfillment / Order-to-Fulfillment Projection / ERP Handoff**
- physical-unit serial authority using the approved PBBBSSSS v1 format;
- Product → SKU → Lot/Batch → Serialized Unit → Shipment traceability;
- Business Order preserves why/how the customer selected products;
- Fulfillment Projection determines what must physically ship now;
- ERP receives executable SKU/quantity/shipping requirements, not UCell qualification/economic semantics;
- warehouse scan verification binds actual serialized units to fulfillment/shipment;
- ERP shipment result is reconciled back to UCell;
- ERP adapter boundary must support EzTooL initially and preserve future Dynamics 365 BC replacement capability.

### B01-2 Four-layer authority model

The integrated design must preserve four distinct authorities:

1. **Commercial Authority — UCell Order**
   - member/customer selections;
   - qualification package;
   - additional purchase;
   - subscription;
   - price/PV/BV/rule snapshots;
   - business order identity.

2. **Fulfillment Authority — UCell Fulfillment Projection**
   - which SKU/quantity must ship in a specific fulfillment cycle;
   - source OrderLine allocation;
   - ship window;
   - fulfillment version/status;
   - ERP handoff identity/idempotency.

3. **Inventory/Warehouse Authority — ERP**
   - inventory availability;
   - pick/pack/ship execution;
   - warehouse/shipment/tracking facts;
   - ERP-side fulfillment status.

4. **Physical Traceability Authority — Serialized Unit**
   - exact physical unit/serial shipped;
   - lot/batch;
   - serialized lifecycle;
   - Order/Shipment traceability.

Do not collapse these authorities into a single ERP Order table or a single UCell OrderLine.

### B01-3 Business Order versus Fulfillment

Business OrderLine and FulfillmentLine are different concepts.

Business OrderLine must preserve at least the source purpose:
- QUALIFICATION_PACKAGE
- ADDITIONAL_PURCHASE
- SUBSCRIPTION

Fulfillment Projection may aggregate identical SKU quantities for warehouse execution, but UCell MUST preserve allocation back to the source OrderLines.

Example:
ERP may receive TIP-580 x6 while UCell preserves:
- Leader Qualification source x4;
- Additional Purchase source x2.

This allocation is mandatory for correct return/refund/qualification/economic recovery semantics.

### B01-4 Multi-fulfillment authority

One UCell Order may produce zero, one, or multiple Fulfillment Orders/Shipments.

Supported reasons include:
- immediate qualification/additional purchase shipment;
- future subscription cycles;
- partial/backorder shipment;
- approved replacement/reshipment;
- different fulfillment windows/warehouses.

Order MUST NOT be modeled as permanently one-to-one with Shipment.

### B01-5 Fulfillment Projection

A paid/otherwise-authorized UCell Order does not automatically mean every ordered unit ships immediately.

The Fulfillment Projection must convert confirmed commercial semantics into an executable physical request:
- fulfillmentNo;
- source orderNo;
- source OrderLine allocations;
- SKU;
- required quantity;
- fulfillment/ship window;
- delivery snapshot/reference;
- status/version;
- idempotency identity.

Subscription items generate fulfillment according to the approved subscription schedule semantics once those semantics are finalized.

### B01-6 ERP handoff

ERP must not become authoritative for:
- member qualification;
- Sponsor/Binary;
- PV/BV;
- Award;
- subscription entitlement semantics;
- qualification 3/9/15 interpretation.

ERP handoff should contain only the physical/operational facts required for execution, using stable business identifiers such as:
- fulfillmentNo/externalOrderNo;
- orderNo reference;
- SKU;
- quantity;
- recipient/delivery reference or approved delivery payload;
- ship window;
- warehouse where applicable;
- idempotency key.

Direct unsupported writes into ERP internal tables are prohibited.

### B01-7 ERP adapter abstraction

Integrate through an ERP Adapter boundary.

Conceptual flow:

UCell Core → Fulfillment Service → ERP Adapter → EzTooL

Future:
UCell Core → Fulfillment Service → ERP Adapter → Dynamics 365 BC

Changing ERP should not require rewriting qualification/order/economic semantics.

### B01-8 Integration reliability

ERP handoff must use durable integration semantics, preferably an Outbox/Inbox or equivalent governed mechanism.

Required properties:
- idempotency;
- retry-safe handoff;
- no duplicate ERP fulfillment/order caused by timeout/retry;
- external ERP identity captured;
- request/result evidence;
- reconciliation status;
- exception handling.

A transient ERP/API timeout MUST NOT cause UCell to guess whether a shipment/order exists.

### B01-9 Fulfillment reconciliation

ERP shipment result must be reconciled against the authoritative Fulfillment Projection.

Minimum outcomes:
- MATCHED;
- PARTIAL;
- MISMATCH / FULFILLMENT_EXCEPTION.

UCell Order/Fulfillment must not be marked fully fulfilled merely because ERP reports a generic shipped status.

Actual SKU/quantity/shipment evidence must reconcile.

### B01-10 Fulfillment versioning and corrections

Once an ERP handoff exists, do not silently overwrite historical fulfillment intent.

If an authorized pre-shipment order change requires a new physical request:
- supersede/cancel the prior Fulfillment version where allowed;
- create a new version;
- preserve actor/reason/evidence;
- reconcile ERP cancellation/update capability.

After pick/pack/ship, corrections must use exception/return/replacement flows rather than historical mutation.

### B01-11 Serialized warehouse verification

The approved serialized-unit rules remain:
- product code mapping A–E;
- PBBBSSSS serial format;
- SKU barcode and Serial barcode are semantically distinct;
- server-side serial validation is authoritative.

Target warehouse workflow:
Order/Fulfillment scan → SKU scan → Serial scan → exact quantity verification → PACK_VERIFIED → Shipment.

Wrong SKU, duplicate serial, already-shipped serial, unknown/ineligible/expired/quarantined/recalled serial, and excess quantity fail closed.

Shipment must bind the actual serialized units to Fulfillment/Order allocations.

### B01-12 Returns and economic provenance

Return of a serialized physical unit must be traceable:

Serial → Shipment → FulfillmentLine/Allocation → source OrderLine → linePurpose.

This is required so the system can distinguish, for example:
- Additional Purchase return;
- Qualification Package return;
- Subscription return.

Any resulting qualification/Award/recovery consequence remains governed by the existing authoritative economic/recovery engine, not ERP.

RETURNED serial state must not automatically become AVAILABLE.

### B01-13 Shared product-selection authority

Admin Paper and LINE/Member must use the same versioned Product Selection authority.

Do not duplicate:
- eligible product pool;
- 3/9/15 qualification counts;
- 2/4/8 subscription counts;
- price/PV/BV rules;
- Order validation.

Client/UI selection is a proposal; server validation is authoritative.

### B01-14 Paper evidence

The signed physical paper original remains authoritative for paper enrollment.

System retains structured historical print/document snapshots and versions, but no signed image upload/OCR/e-signature is required by this batch.

### B01-15 Subscription decisions still open

Before implementation of subscription fulfillment, the business owner must decide:
1. whether QUARTERLY 2 / SEMI_ANNUAL 4 / ANNUAL 8 means units per shipment/period or total units for the entire plan term;
2. whether product mix is fixed at subscription creation or may change for future cycles;
3. shipment cadence, cutoff/change deadline, skip/pause/cancel rules where applicable.

Until resolved, subscription fulfillment scheduling remains DECISION_REQUIRED.

### B01-16 Test/Stage data authority

Current Local and Stage/UAT data is disposable test data under the prior approved authority.

For this batch, controlled cleanup/reseed/rebuild is allowed where safer than preserving obsolete synthetic topology/order/fulfillment data.

Production remains untouched.

Do not encode destructive Stage cleanup as hidden Production migration behavior.

### B01-17 Cross-layer synchronization

When this batch is explicitly released for implementation, all affected layers must be updated together:

Definition
→ Semantic/Core terminology
→ future AI Brain semantic preparation
→ Package/Product/Subscription
→ Binary/Company Ball
→ Person/Paper/Sponsor/Placement
→ Order/Payment
→ Fulfillment Projection
→ Serialized Unit
→ ERP Adapter
→ API/OpenAPI
→ DB/migrations
→ Admin
→ Member/LINE
→ Worker/integration jobs
→ tests/Golden
→ audit/trace
→ GitHub
→ Google Drive impact/formal documents.

Phase-2 AI/LLM runtime remains out of scope.

### B01-18 Implementation control

CR-001, CR-002, and Serialized Fulfillment/ERP Handoff are now managed as one integrated requirement batch: **R1.0B-CR-BATCH-01**.

Detailed prior CR sections remain source authority and are not deleted.

Do NOT begin implementation merely because the batch is defined.

Current batch status:
**APPROVED_REQUIREMENTS / CONSOLIDATION_IN_PROGRESS / IMPLEMENTATION_PENDING**

Before development authorization, perform:
- conflict/inconsistency review across all batch rules;
- unresolved-decision inventory;
- complete cross-layer impact matrix;
- implementation slicing and migration strategy;
- revised Golden/re-certification plan;
- Stage reseed/deployment plan.

Only an explicit later instruction to release R1.0B-CR-BATCH-01 for implementation changes this status.


## 22. R1.0B CR-BATCH-01 UI Foundation — Adaptive Theme System

**Status:** APPROVED DESIGN / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-26 (Asia/Taipei)
**Scope:** Admin and Membership/Member web frontends, including supported browser and LINE in-app webview/LIFF surfaces.
**Implementation timing:** Part of R1.0B-CR-BATCH-01; do not implement until the integrated batch is explicitly released for development.

### UI-THEME-1 Objective

Admin and Membership MUST use one shared adaptive theme foundation rather than independent per-page dark-mode CSS.

Supported user preferences:
- SYSTEM
- LIGHT
- DARK

Default = SYSTEM.

SYSTEM follows the best available host/browser color-scheme preference. This controls application appearance only; UCell MUST NOT attempt to control physical device display brightness.

### UI-THEME-2 Resolution priority

Theme resolution priority:

1. authenticated user's explicit LIGHT/DARK preference;
2. supported LINE/LIFF host theme context where available and authoritative for the embedded experience;
3. browser/OS `prefers-color-scheme`;
4. LIGHT fallback.

If authenticated preference = SYSTEM, continue to host/browser resolution.

The resolver MUST fail safely when LINE/host theme information is unavailable.

### UI-THEME-3 Shared semantic design tokens

Admin and Membership must share semantic design tokens. Components/pages must consume semantic tokens rather than hard-coded light/dark colors.

Minimum token categories:
- surface.page
- surface.card
- surface.elevated
- text.primary
- text.secondary
- text.disabled
- border.default
- input.background
- input.border
- action.primary
- action.secondary
- status.success
- status.warning
- status.danger
- focus.ring

Brand identity may define light/dark-compatible token values, but business/status meaning must remain consistent across themes.

### UI-THEME-4 Preference persistence

Before authentication:
- local browser preference MAY be retained locally for UX continuity.

After authentication:
- UI theme preference should be stored in a dedicated UserPreference/UI-preference authority;
- do not add theme state to Person identity or economic/member qualification models.

Recommended value:
`uiThemePreference = SYSTEM | LIGHT | DARK`.

Admin Staff and Member may share the same preference vocabulary even if stored through different authenticated principals.

### UI-THEME-5 Runtime switching

Changing theme must not require logout or page reload.

When SYSTEM is selected, the application should react to host/browser scheme changes during the active session where technically supported.

Admin should expose an accessible theme control conceptually equivalent to:
LIGHT / SYSTEM / DARK.

Membership should default to SYSTEM and may expose the same override in an appropriate settings surface.

### UI-THEME-6 Initial render / flash prevention

Theme must be resolved as early as practical before the primary application UI renders.

The implementation should apply a root-level theme marker (for example `data-theme` or equivalent) during bootstrap so a saved DARK preference does not first render a bright LIGHT frame.

Server/client hydration must not cause visible theme oscillation where avoidable.

### UI-THEME-7 LINE/LIFF behavior

Membership opened inside LINE/LIFF must remain usable when host theme metadata is present, absent, delayed, or unsupported.

Do not make core Member functionality depend on successful theme detection.

LINE-specific adaptation must feed the same UCell Theme Resolver/design-token system; do not maintain a separate LINE color system.

### UI-THEME-8 Accessibility

Theme implementation must preserve accessibility in both LIGHT and DARK modes.

At minimum validate:
- text/background contrast;
- form labels/inputs;
- focus indicators;
- disabled states;
- success/warning/error states;
- links/buttons;
- tables/cards/dialogs;
- charts/badges where present.

Do not communicate business status by color alone.

WCAG-compatible contrast targets should be used for normal UI text and interactive controls.

### UI-THEME-9 Business and security isolation

Theme preference is presentation metadata only.

Changing theme MUST NOT affect:
- Person/member identity;
- qualification;
- Active;
- Ball/Sponsor/Placement;
- PV/BV/Award;
- Order/Fulfillment;
- authorization/RBAC;
- privacy/security behavior.

Theme preference endpoints/read models, if introduced, must use authenticated principal authority and must not expose internal UUIDs unnecessarily.

### UI-THEME-10 Architecture

Preferred conceptual architecture:

`ThemePreference → ThemeResolver → Root Theme Marker → Shared Semantic Tokens → Admin/Member Components`

Avoid:
- page-specific dark-mode forks;
- duplicated Admin/Member palettes;
- hard-coded component colors that bypass tokens;
- CSS inversion/filter tricks;
- physical screen-brightness control.

### UI-THEME-11 Batch integration

When R1.0B-CR-BATCH-01 is released for implementation, establish the Adaptive Theme foundation before or alongside major new UI work such as:
- Paper Fast Enrollment Workbench;
- LINE qualification/product selection;
- subscription selection;
- Fulfillment Scanner;
- serialized-unit warehouse surfaces.

This reduces duplicate styling work and ensures new batch UI is theme-aware from inception.

### UI-THEME-12 Required verification

Before completion, verify at minimum:
- Admin LIGHT;
- Admin DARK;
- Admin SYSTEM;
- Membership LIGHT;
- Membership DARK;
- Membership SYSTEM;
- runtime theme switching;
- persistence across refresh;
- authenticated preference restore;
- browser/OS SYSTEM change response where supported;
- mobile viewport;
- LINE/LIFF fallback behavior;
- no initial light-flash for saved DARK preference where technically controllable;
- accessibility/contrast;
- no Business Core side effects;
- production builds for affected frontends.

Current status remains **APPROVED DESIGN / IMPLEMENTATION_PENDING** until the integrated change batch is explicitly released.


## 23. R1.0B CR-BATCH-01 UI Foundation — Chinese-First User Interface

**Status:** APPROVED DESIGN / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-26 (Asia/Taipei)
**Scope:** All user-visible Admin, Membership/Member, LINE/LIFF, enrollment, commerce, fulfillment, audit/operations and related Phase-1/CR-BATCH-01 UI surfaces.
**Implementation timing:** Part of R1.0B-CR-BATCH-01; do not implement until the integrated batch is explicitly released for development.

### UI-ZH-1 Primary language authority

UCell user-facing UI MUST use **Traditional Chinese (zh-TW) as the default and primary language**.

Normal users and operators must not be required to understand English technical/business terms to operate the system.

All ordinary visible:
- page titles;
- navigation;
- menus;
- buttons;
- field labels;
- placeholders;
- helper text;
- validation messages;
- warnings;
- confirmations;
- empty states;
- status labels;
- table headers;
- filters;
- dialogs;
- toast/notification messages;
- printed operational UI labels;
- Member/LINE prompts;
- Admin operational descriptions

must use clear Traditional Chinese.

### UI-ZH-2 No raw English enum/code exposure

Internal enum/code values MUST NOT be displayed directly as normal UI labels.

Examples:
- `PLACEMENT_PENDING` → `待安置`
- `EFFECTIVE` → `已生效`
- `ALWAYS_ACTIVE` → `永久活躍`
- `QUALIFICATION_PACKAGE` → `資格套組`
- `ADDITIONAL_PURCHASE` → `加購商品`
- `SUBSCRIPTION` → `重銷訂閱`
- `SYSTEM` → `跟隨系統`
- `LIGHT` → `淺色模式`
- `DARK` → `深色模式`
- `PASS` → `通過`
- `FAILED` → `失敗`

The internal canonical code remains unchanged for API/DB/program authority; UI maps code → approved Chinese display text.

### UI-ZH-3 Business terminology dictionary

Create one shared Chinese UI terminology dictionary/semantic-label authority used by Admin and Membership.

Do not let individual pages independently translate the same domain term.

The dictionary must cover, at minimum:
- 會員
- 推薦球
- 安置球／安置位置
- 球號
- 創始公司球
- 會員資格
- 啟航／菁英／領袖
- 永久活躍
- 水庫B
- 資格套組
- 加購商品
- 重銷訂閱
- 訂單
- 待付款／已付款
- 待安置／已生效
- 配送資料
- 出貨
- 批號
- 商品序號
- 稽核紀錄
- 權限
- 角色
- 錯誤／異常
- 追蹤編號
- 淺色模式／深色模式／跟隨系統

Wording must prioritize ordinary Taiwan user comprehension over direct literal translation of implementation terminology.

### UI-ZH-4 Technical identifiers

Business identifiers may remain in their canonical values when they are themselves identifiers, for example:
- memberNo;
- orderNo;
- ballNo;
- paperApplicationNo;
- fulfillmentNo;
- serialNo;
- tracking number.

However, their field labels must be Chinese, for example:
- `memberNo` displayed under `會員編號`;
- `orderNo` under `訂單編號`;
- `ballNo` under `球號`;
- `serialNo` under `商品序號`.

Internal UUIDs remain hidden from normal UI according to existing privacy rules.

### UI-ZH-5 Product and controlled proper names

Approved product/model identifiers such as TIP-363/TIP-999/TIP-580/TIP-696/TIP-777 may remain because they are controlled product codes, but the surrounding UI must be Chinese and should display the approved Chinese product name where available.

External product/company proper names such as LINE, EzTooL, Microsoft Dynamics 365 BC may remain when they are official names.

Do not expose internal English service/class/database terminology merely because it exists in code.

### UI-ZH-6 Error and validation presentation

User-visible errors must be Chinese and actionable.

Do not display raw exception messages, Prisma/database errors, stack traces, internal enum names, or English developer diagnostics to ordinary users.

Preferred presentation:
- clear Chinese summary;
- what the user should do next;
- safe trace/reference number where support needs correlation.

Technical details remain in protected logs/audit/diagnostic evidence.

### UI-ZH-7 Admin versus Member language

Admin may use more precise operational terminology than Member UI, but both remain Chinese-first.

Admin:
- may show approved technical business terms where operationally necessary;
- must provide Chinese labels/explanations.

Member/LINE:
- prioritize short, plain Traditional Chinese;
- avoid internal implementation vocabulary;
- use step-by-step wording suitable for mobile users.

### UI-ZH-8 Theme integration

The Chinese-first rule applies equally to:
- 跟隨系統;
- 淺色模式;
- 深色模式.

Adaptive Theme must not introduce English-only controls or labels.

Chinese typography, text wrapping, spacing, button width, table layout and mobile rendering must be verified in all three theme modes.

### UI-ZH-9 Printing and paper workflow

Admin-generated Membership Application, Order Form, Distributor Agreement and related operational print surfaces must use approved Traditional Chinese business terminology unless a separately approved bilingual/legal document version requires otherwise.

CR-002 signed-paper evidence rules remain unchanged.

### UI-ZH-10 Future localization architecture

Chinese-first does not require hard-coding Chinese strings throughout components.

Implementation should use a shared UI message/label layer so future localization remains possible.

However, Phase-1/CR-BATCH-01 does NOT require building a full multilingual product.

Default locale = `zh-TW`.

English translation completeness is not a release requirement unless separately authorized.

### UI-ZH-11 Required verification

Before completion, verify:
- Admin navigation/pages are Chinese-first;
- Member navigation/pages are Chinese-first;
- LINE/LIFF flows are Chinese-first;
- Paper enrollment workbench is Chinese-first;
- product/package/subscription selection is Chinese-first;
- fulfillment/serialized scanner UI is Chinese-first;
- validation/error/confirmation messages are Chinese-first;
- status enums are mapped to approved Chinese labels;
- no raw internal English enums appear in normal UI;
- Chinese text works in LIGHT/DARK/SYSTEM themes;
- mobile layout handles Chinese text without clipping;
- protected technical diagnostics remain outside normal user UI.

### UI-ZH-12 Scope control

This is an approved UI foundation requirement within R1.0B-CR-BATCH-01.

Current status remains **APPROVED DESIGN / IMPLEMENTATION_PENDING** until the integrated batch is explicitly released for implementation.


## 24. R1.0B CR-BATCH-01 UI Foundation — Internationalization (i18n) Architecture

**Status:** APPROVED DESIGN / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-26 (Asia/Taipei)
**Scope:** Admin, Membership/Member, LINE/LIFF, Paper Workbench, commerce, fulfillment/scanner, audit/operations and future localized content/document surfaces.
**Implementation timing:** Part of R1.0B-CR-BATCH-01; do not implement until the integrated batch is explicitly released for development.

### I18N-1 Strategy

UCell adopts **zh-TW First / i18n Ready** architecture.

Current required published/default locale:
- `zh-TW` — Traditional Chinese, complete and authoritative for normal Phase-1/CR-BATCH-01 UI.

Future planned locales:
- `id-ID` — Indonesian;
- `en-US` / approved English locale.

Future locale planning does not require complete Indonesian/English translation in the current batch unless separately authorized.

### I18N-2 Canonical codes versus presentation

DB, API, domain engines, Golden and integration contracts continue to use stable canonical codes.

Do NOT store translated display labels as domain authority.

Examples:
- `LEADER`
- `PLACEMENT_PENDING`
- `EFFECTIVE`
- `SHIPPED`
- `RETURNED`
- `QUALIFICATION_PACKAGE`

Presentation resolves canonical code/message key through locale resources.

Example:
`PLACEMENT_PENDING`
→ zh-TW: `待安置`
→ future id-ID/en-US localized label.

### I18N-3 No hard-coded UI prose

New/modified UI components should not scatter Traditional Chinese strings directly through component logic.

Use a shared message/label authority, conceptually:
`t("order.confirm")`
rather than embedding the visible text as component business logic.

Traditional Chinese remains the visible result for the current published locale.

Implementation may choose the repository-compatible i18n library/framework after technical assessment; this design does not authorize unnecessary framework replacement.

### I18N-4 Localization layers

UCell must distinguish three localization classes:

**A. Static UI Messages**
- navigation;
- buttons;
- labels;
- validation;
- status labels;
- dialogs;
- operational instructions.

Stored in frontend/shared locale resources.

**B. Dynamic Business Content**
Examples:
- product display name/description;
- announcements;
- managed content.

Future multilingual content should use versioned/localized content data rather than requiring frontend redeploy for every content change where appropriate.

**C. Legal / Controlled Documents**
Examples:
- Membership Application;
- Order Form;
- Distributor Agreement.

Legal/controlled localized documents are independently versioned templates by document type + locale + version/effective period.

A generic UI translation MUST NOT silently become a legally approved translated contract.

### I18N-5 Shared terminology dictionary

Maintain a shared UCell domain terminology/message authority.

The same canonical concept must not receive unrelated translations in Admin, Member, LINE, Paper and Fulfillment surfaces.

High-governance terms include:
- Member / 會員;
- Sponsor Ball / 推薦球;
- Placement / 安置;
- Ball Number / 球號;
- Founder Company Ball / 創始公司球;
- Qualification / 會員資格;
- Starter / 啟航;
- Elite / 菁英;
- Leader / 領袖;
- Reservoir B / 水庫B;
- Qualification Package / 資格套組;
- Additional Purchase / 加購商品;
- Subscription / 重銷訂閱;
- Fulfillment / 出貨履行/approved Chinese UI term;
- Lot/Batch / 批號;
- Serial Number / 商品序號;
- Audit / 稽核紀錄;
- Trace Reference / 追蹤編號.

Translation of governed business/economic/legal terminology into future locales requires business review before publication.

### I18N-6 Locale resolver

Preferred locale resolution priority:

1. authenticated user's explicit locale preference;
2. account/user stored preference;
3. supported LINE/LIFF locale hint where available;
4. browser locale;
5. `zh-TW` fallback.

A host/browser locale is an initial/fallback signal and MUST NOT repeatedly override an authenticated user's explicit preference.

If a requested locale is not published/available, fall back safely to `zh-TW`.

### I18N-7 User preference separation

Locale and Theme are independent presentation preferences.

Conceptually:

`locale = zh-TW | future id-ID | future en-US`

`theme = SYSTEM | LIGHT | DARK`

Do not place locale/theme into Person identity, Qualification, Ball, Order economic or other Business Core state.

### I18N-8 Locale availability

Having translation resources does not automatically make a locale publicly available.

Maintain an approved locale-availability policy by surface.

Initial:
- Admin: zh-TW ENABLED;
- Membership/LINE: zh-TW ENABLED;
- id-ID/en-US: FUTURE / disabled until reviewed and published.

This allows translations to be prepared/reviewed without accidentally exposing incomplete locales.

### I18N-9 Formatting

Use locale-aware formatting for presentation of:
- dates/times;
- numbers;
- percentages;
- currency display where applicable.

Locale and currency are separate concepts.

Do not infer transaction currency solely from UI language.

Use platform-standard locale formatting facilities where practical (for example Intl APIs) instead of hand-built date/number strings.

Canonical stored timestamps/numeric values remain independent of presentation locale.

### I18N-10 Errors and diagnostics

Backend/API should provide stable error/status codes and safe correlation/trace references.

Normal UI resolves user-facing messages through locale resources.

Do not expose raw English exception messages, database errors, stack traces or internal enum codes to ordinary users.

Technical diagnostics remain in protected logs/audit/diagnostic evidence.

### I18N-11 LINE/LIFF

LINE/LIFF locale hints may initialize/fallback locale resolution, but:
- Member explicit preference wins;
- missing/unsupported LINE locale must not break Member functionality;
- LINE does not get a separate translation architecture;
- LINE/Member uses the shared UCell message/terminology authority.

### I18N-12 Legal/document localization

For future multilingual legal documents, model templates conceptually by:
- documentType;
- locale;
- version;
- effectiveFrom/effectiveTo where applicable;
- approval/publication status.

Example:
`DISTRIBUTOR_AGREEMENT / zh-TW / vX`
and a future Indonesian/English version are separate controlled legal artifacts.

CR-002 paper snapshot/version rules remain authoritative.

### I18N-13 Translation lifecycle

Future governed translations, especially economic/product/legal content, should support a review lifecycle such as:
- DRAFT
- REVIEWED
- APPROVED
- PUBLISHED

AI/LLM may assist future translation drafting only when separately authorized; AI-generated translations MUST NOT automatically publish governed economic/legal content.

### I18N-14 Missing-key and fallback governance

Implementation must provide deterministic missing-key behavior.

Normal Production UI must not expose raw keys such as `fulfillment.packVerified`.

Prefer development/CI checks that detect:
- missing required zh-TW keys;
- orphaned/invalid message references;
- duplicate/conflicting governed terminology where feasible.

zh-TW completeness is a release requirement for enabled CR-BATCH-01 UI surfaces.

### I18N-15 Theme integration

i18n and Adaptive Theme are orthogonal.

Required combinations must remain functional, especially:
- zh-TW + LIGHT;
- zh-TW + DARK;
- zh-TW + SYSTEM.

Future locales must use the same Theme system.

Verify Chinese typography, wrapping, spacing, button width, tables, dialogs and mobile layouts under all supported theme modes.

### I18N-16 Accessibility and responsive layout

Localization must not compromise accessibility.

Components should tolerate text expansion without clipping or relying on fixed English-width assumptions.

Member/LINE mobile flows should prioritize concise plain-language Traditional Chinese while preserving accessible labels and semantics.

### I18N-17 Implementation sequencing

When R1.0B-CR-BATCH-01 is explicitly released:

1. establish shared i18n/message/terminology foundation;
2. migrate affected Admin/Member existing visible strings to the shared authority;
3. ensure zh-TW completeness;
4. integrate Adaptive Theme;
5. build new Paper/LINE/Fulfillment UI using the shared foundations from inception.

Do not postpone i18n extraction until after the new batch UI is complete.

### I18N-18 Required verification

Before completion:
- Admin enabled UI = zh-TW complete;
- Member enabled UI = zh-TW complete;
- LINE/LIFF enabled flow = zh-TW complete;
- Paper Workbench = zh-TW complete;
- product/package/subscription selection = zh-TW complete;
- Fulfillment/serialized scanner = zh-TW complete;
- no raw internal English enum/code appears as ordinary UI;
- message-key/fallback tests PASS;
- date/number/currency formatting tests PASS where applicable;
- explicit locale preference persistence PASS;
- locale fallback PASS;
- Theme × locale PASS;
- mobile Chinese layout PASS;
- affected production builds PASS;
- Business Core/API canonical-code behavior unchanged.

### I18N-19 Scope control

This establishes the Internationalization Foundation, not a requirement to publish a multilingual product immediately.

Current release requirement:
**Traditional Chinese complete; architecture ready for future Indonesian and English.**

Current status remains **APPROVED DESIGN / IMPLEMENTATION_PENDING** until R1.0B-CR-BATCH-01 is explicitly released for implementation.


## 25. R1.0B CR-BATCH-01 UI Foundation — Channel Localization Simplification

**Status:** APPROVED DESIGN / SUPERSEDING WHERE CONFLICTING / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-26 (Asia/Taipei)
**Scope:** Clarifies and simplifies Sections 23–24 for Admin versus customer/member-facing channels.

### CLS-1 Guiding principle

UCell does NOT require every current and future frontend channel to share one centralized UI/i18n runtime.

The shared authority across channels is:
- stable backend/API canonical codes and business data;
- stable business identifiers;
- approved domain terminology/meaning;
- security/privacy/business rules.

Presentation implementation may differ by channel and region.

### CLS-2 Admin

The Admin management frontend SHOULD be designed as a multilingual-capable management application.

Initial required/default locale remains:
- zh-TW.

Additional Admin locales may be added when operationally required.

Admin should use a maintainable message/label mechanism rather than exposing raw backend enums or scattering uncontrolled visible strings.

Admin Theme may support:
- 跟隨系統;
- 淺色模式;
- 深色模式.

### CLS-3 Customer/member-facing channels

Customer/member-facing presentation is explicitly allowed to use channel-appropriate and region-appropriate design.

This includes current/future:
- Member Web;
- WebApp/PWA;
- LINE OA/LIFF;
- native mobile APP;
- WeChat Mini Program;
- other approved regional digital channels.

These channels do NOT need to share the same frontend framework, CSS system, i18n runtime, navigation pattern, or visual design.

They MAY adapt:
- language;
- terminology presentation;
- information density;
- navigation;
- interaction pattern;
- theme behavior;
- platform conventions;
- regional UX;
- local legal/commerce presentation requirements,

provided that backend/domain authority and approved legal/business meaning are preserved.

### CLS-4 API/domain language neutrality

Backend/API/domain state remains presentation-language neutral.

Canonical values such as:
- LEADER;
- PLACEMENT_PENDING;
- SHIPPED;
- RETURNED;
- QUALIFICATION_PACKAGE

remain stable machine/domain codes.

Each frontend channel maps them to its approved user-facing presentation.

Backend MUST NOT force all channels to consume Traditional Chinese display text as domain authority.

### CLS-5 Chinese-first current release

For the current Taiwan-facing Admin and Member/LINE implementation:
- ordinary visible UI should be Traditional Chinese;
- raw English internal enum/error/class/database terminology must not be exposed to normal users.

This does not prohibit future localized/regional frontends from using other languages.

### CLS-6 Minimal shared localization contract

Do not build an enterprise-wide translation CMS merely for future possibility.

For the current batch, the minimum shared contract is:
1. canonical backend/domain codes remain stable;
2. Admin is multilingual-ready;
3. current Taiwan-facing UI is Chinese-first;
4. raw internal codes are mapped to user-friendly labels;
5. future channels may maintain their own locale resources;
6. governed legal/business meaning must remain consistent.

Centralized cross-channel message catalogs are optional, not mandatory.

### CLS-7 Theme portability

Adaptive Theme requirements apply where appropriate to the platform.

Admin Web and current Member Web may support SYSTEM/LIGHT/DARK.

Future native APP, LINE, WebApp or WeChat Mini Program may use their platform-native theme mechanisms.

Do not require all channels to share one runtime theme engine.

Shared brand/design guidance may exist without requiring identical technical implementation.

### CLS-8 Regional/legal content

Regional frontend freedom does not allow changing authoritative business rules.

Localized legal documents, regulated product claims, prices/currencies, tax/shipping rules, consent and contractual text must follow the applicable approved regional authority before publication.

A regional UI adaptation must not silently alter Qualification, Sponsor, Placement, Award, Order, Fulfillment or privacy semantics.

### CLS-9 Implementation consequence

When CR-BATCH-01 is released:
- keep Admin multilingual-ready;
- make current Admin/Member Taiwan UI Chinese-first;
- avoid raw internal English codes in ordinary UI;
- use a practical lightweight localization approach;
- do not build unused cross-platform localization infrastructure;
- allow future APP/WebApp/LINE/WeChat implementations to choose appropriate regional presentation architecture.

Sections 23–24 remain useful design guidance, but any requirement implying one mandatory centralized i18n/theme runtime across all future frontend channels is superseded by this simplification.


## 26. R1.0B CR-BATCH-01 UI Foundation — System Iconography & Achievement Emblems

**Status:** APPROVED / INCLUDED_IN_BATCH / IMPLEMENTATION_SLICE_PRESENT
**Approved date:** 2026-09-27 (Asia/Taipei)
**Batch:** R1.0B-CR-BATCH-01
**Scope:** Shared Design System, Admin, current Taiwan Member Web; future channels may reuse or redesign presentation while preserving canonical meanings.

### ICON-1 Batch inclusion

The System Iconography & Achievement Emblems work is formally included in **R1.0B-CR-BATCH-01** and must be carried through the batch impact review, tests, build/re-certification and Stage release plan together with the other approved changes.

Existing implementation already present in the integration branch is treated as the initial implementation slice, not a separate release.

### ICON-2 Source authority

Icon/badge mapping must follow actual repository/domain authority, not conceptual marketing artwork.

Current Qualification badge codes:
- STARTER → 啟航
- ELITE → 菁英
- LEADER → 領袖

Current Global Rank codes:
- NEW_STAR → 新星
- EXCELLENCE → 卓越
- GLORY → 榮耀
- DIAMOND → 鑽石
- CROWN → 皇冠

Any future change to qualification/global-rank codes must update domain rules/read models and Golden evidence before UI badges are changed to imply a new authoritative achievement.

### ICON-3 Presentation-only boundary

Icons and emblems are presentation metadata only.

They MUST NOT calculate, infer or mutate:
- Qualification;
- Active;
- Global Rank achievement;
- Global Pool eligibility;
- PV/BV;
- Award/Payable;
- Sponsor/Placement;
- Order/Fulfillment;
- authorization/privacy state.

Unknown/unavailable canonical values fail safe and must not be converted into an invented badge.

### ICON-4 Member Global Rank evidence boundary

The shared design system may contain all authoritative GlobalRankCode emblem artwork.

However, Member UI may display an emblem as **achieved** only after an authoritative member-safe Global Rank Achievement read model/API exists.

Frontend inference from weak-side volume, PV, Award history or current display data is prohibited.

Until that read authority exists, Global Rank emblems may be shown only as explanatory/reference artwork where the UI clearly does not assert member achievement.

### ICON-5 Current integration

The batch includes the current implementation slice in:
- shared design-system icon/emblem components and styles;
- Admin navigation icon mapping;
- Admin Qualification/Ball badge presentation;
- Admin Global Pool rank reference presentation;
- Member bottom navigation;
- Member quick-service actions;
- Member Qualification badge presentation.

### ICON-6 Visual direction

Use refined vector/SVG presentation suitable for:
- responsive web;
- high-DPI displays;
- future LIGHT/DARK adaptation;
- accessible scaling.

Current badges use distinct semantic visual identities for the three Qualification levels and five Global Rank achievements.

Do not use decorative artwork as a substitute for text labels.

### ICON-7 Localization/channel rule

Current Taiwan Admin/Member labels are Traditional Chinese.

Canonical codes remain language-neutral.

Admin may later localize badge labels through its multilingual presentation layer. Future APP/WebApp/LINE/WeChat/regional channels may use channel-appropriate artwork while preserving the same canonical meaning.

A single cross-channel icon runtime is not required.

### ICON-8 Accessibility

Where a visible text label already identifies the function, decorative icons should not create duplicate screen-reader announcements.

Interactive controls must remain understandable without color/icon alone.

Badge contrast and legibility must be verified with the batch Theme work.

### ICON-9 Batch verification

Before R1.0B-CR-BATCH-01 is released to Stage, this slice must be included in:
- Admin typecheck/tests/production build;
- Member typecheck/tests/production build;
- navigation permission regression;
- responsive/mobile verification;
- LIGHT/DARK/SYSTEM verification when Theme foundation lands;
- zh-TW label verification;
- accessibility smoke;
- canonical-code mapping tests for Qualification and Global Rank;
- confirmation that no Member Global Rank achievement is inferred client-side.

### ICON-10 Release control

This inclusion does not authorize an independent Stage or Production deployment.

The icon/badge implementation is now part of the integrated batch and follows the same batch release authorization, re-certification and Stage deployment decision as R1.0B-CR-BATCH-01.


## 27. R1.0B CR-BATCH-01 Amendment — Profile-Driven Binary Tree Bootstrap

**Status:** APPROVED DESIGN / SUPERSEDING FIXED-COUNT ASSUMPTIONS / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-27 (Asia/Taipei)
**Batch:** R1.0B-CR-BATCH-01
**Scope:** Binary Tree creation/bootstrap parameters, Company bootstrap qualification profile, placement eligibility, fixtures/Golden, Admin tree configuration and Stage/UAT reseed.

### BT-PROFILE-1 Authority

The Binary Tree engine MUST NOT hard-code seven Company bootstrap Balls as an immutable engine constant.

Each Binary Tree is created from a versioned **Binary Tree Bootstrap Profile** (or equivalent authoritative parameter snapshot).

The currently approved standard/default profile uses:

- `companyBallCount = 7`
- Founder/bootstrap Company Ball qualification = `LEADER_72000`
- Company ownership = COMPANY
- Company Active policy = ALWAYS_ACTIVE
- Company Award eligibility = enabled according to applicable approved Award rules
- Company economic destination = RESERVOIR_B

Therefore, for the current standard profile:

- positions 1..7 = bootstrap Company Balls;
- first normal member-eligible position = 8.

The prior CR-001 wording `BOOTSTRAP_COMPANY_BALL_COUNT = 7` is superseded where it implies an engine-wide immutable constant.

Correct authority:

`DEFAULT_BOOTSTRAP_COMPANY_BALL_COUNT = 7`

and, for a contiguous bootstrap profile:

`FIRST_MEMBER_ELIGIBLE_POSITION = companyBallCount + 1`.

### BT-PROFILE-2 Per-tree parameter snapshot

Each Binary Tree must retain the exact bootstrap profile/version and effective parameter snapshot used to create it.

At minimum the profile/snapshot must be capable of representing:

- profile code/version;
- companyBallCount;
- bootstrap Company qualification/plan profile;
- Company Active policy;
- Company Award eligibility policy/reference;
- economic destination policy/reference;
- effective/version/approval evidence required by current configuration governance.

Do not scatter literal `7`, `72000`, `LEADER`, `ALWAYS_ACTIVE` or `RESERVOIR_B` conditions independently across services.

### BT-PROFILE-3 Tree-specific configuration

Different Binary Trees may be created with different approved bootstrap profiles.

Conceptually, future approved configurations may include different Company bootstrap counts, for example A=7 and B=15, without changing the Binary Tree engine.

This amendment does NOT itself approve arbitrary profile values for Production. Only approved/published profile versions may be selected.

### BT-PROFILE-4 Immutability after activation/member placement

Bootstrap topology parameters are creation-time structural authority.

While a Tree is still in a safe pre-operational DRAFT state, an authorized configuration workflow may select/change the profile according to implementation rules.

Once bootstrap has been materialized and/or the Tree is activated or accepts normal member placement, structural bootstrap parameters such as `companyBallCount` MUST NOT be edited in place.

Changing a live Tree from 7 to 15 by rewriting historical positions is prohibited as an ordinary settings update.

A materially different topology requires an approved new Tree/profile or a separately governed migration/rebuild process.

### BT-PROFILE-5 Bootstrap materialization

New-tree bootstrap must deterministically materialize exactly `companyBallCount` real Company bootstrap Qualifications/Balls according to the selected profile.

For the standard profile, positions 1..7 are occupied by Company bootstrap Balls.

No placeholder/fake natural-person member is created.

The bootstrap Company qualification baseline is assigned by system/company profile authority and must not require fake member orders/payments/consumption.

### BT-PROFILE-6 Member placement eligibility

Normal member placement eligibility derives from the Tree's authoritative bootstrap snapshot, not a global literal position 8.

For a contiguous bootstrap:
- reserved Company bootstrap positions = `1..companyBallCount`;
- first normal member position = `companyBallCount + 1`.

Server-side placement must enforce the selected Tree's rule.

UI may display the resulting eligible positions but is not authority.

### BT-PROFILE-7 Company Ball economics

CR-001 Amendments A/B remain authoritative for the currently approved standard profile:

- bootstrap Company Balls are ALWAYS_ACTIVE;
- they participate in applicable approved Awards;
- Company economic Awards route to Reservoir B;
- the standard profile assigns LEADER_72000 qualification to all of its bootstrap Company Balls;
- bootstrap existence/qualification alone does not synthesize transaction-derived volume.

Other Company Balls outside the bootstrap range remain governed by the previously approved Company ownership/economic rules and do not automatically inherit the bootstrap qualification profile solely because they are Company-owned.

### BT-PROFILE-8 Sponsor model unchanged

This amendment does NOT change the existing Sponsor architecture.

The previously confirmed original rule remains:
- Binary Tree is a tree-specific topology scope;
- Sponsor relationships remain the existing Qualification-to-Qualification Sponsor model;
- do not introduce a mandatory paired SponsorTreeId;
- do not prohibit an otherwise valid Sponsor relationship solely because Binary Tree IDs differ.

### BT-PROFILE-9 Admin

When implementation is released, Admin multi-tree creation/configuration should display the selected bootstrap profile and its effective parameters in clear Chinese.

Do not expose unrestricted numeric mutation of a live Tree.

If profile selection is configurable in Admin, only approved/published profiles may be selectable.

Tree detail should make the effective bootstrap count/profile visible for operational explanation and audit.

### BT-PROFILE-10 Test/Stage data

Current Local/Stage data remains disposable test/UAT data under the batch authority.

During CR-BATCH-01 implementation, obsolete synthetic Trees may be deleted/rebuilt/reseeded to the approved profile rather than historically reparented.

Production remains untouched.

Stage-specific destructive cleanup must remain separate from Production-safe schema/runtime migration.

### BT-PROFILE-11 Required Golden

The batch Golden plan must be parameterized rather than proving only a literal seven-node engine.

At minimum prove:

- STANDARD_PROFILE_COMPANY_BALL_COUNT_7 = PASS
- STANDARD_PROFILE_POSITIONS_1_TO_7_COMPANY = PASS
- STANDARD_PROFILE_FIRST_MEMBER_POSITION_8 = PASS
- STANDARD_PROFILE_BOOTSTRAP_LEADER_72000 = PASS
- PROFILE_SNAPSHOT_PERSISTED = PASS
- PLACEMENT_USES_TREE_BOOTSTRAP_COUNT = PASS
- LIVE_TREE_BOOTSTRAP_COUNT_IMMUTABLE = PASS
- UNAPPROVED_PROFILE_REJECTED = PASS
- COMPANY_ALWAYS_ACTIVE = PASS
- COMPANY_AWARD_ROUTES_RESERVOIR_B = PASS
- BOOTSTRAP_DOES_NOT_SYNTHESIZE_VOLUME = PASS
- SPONSOR_MODEL_UNCHANGED = PASS

Also add a non-default test profile in isolated tests, if safe and implementation-supported, to prove the engine is genuinely profile-driven rather than a renamed hard-coded seven.

### BT-PROFILE-12 Implementation timing

This design is included in **R1.0B-CR-BATCH-01**.

Current status remains **IMPLEMENTATION_PENDING** until the integrated batch is explicitly released for development.

No independent Stage or Production change is authorized by this amendment.


## 28. R1.0B CR-BATCH-01 — End-to-End Economic Value Lineage (GPV/RPV/EPV/Referral)

**Status:** APPROVED DESIGN / INCLUDED_IN_BATCH / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-27 (Asia/Taipei)
**Batch:** R1.0B-CR-BATCH-01
**Objective:** Every transaction-derived numeric effect must remain explainable from commercial source through recognition, volume/economic propagation, Award destination, settlement/payment and later reversal/recovery/replay.

### EVL-1 Principle

UCell must preserve a complete **Economic Value Lineage / 數值影響鏈**.

Do not replace existing authoritative ledgers/evidence with a second accounting ledger.

The lineage layer indexes/joins existing immutable or historical authorities and adds missing correlation/evidence edges only where required.

A user with appropriate Admin authority should eventually be able to start from a safe business identifier such as orderNo, memberNo, ballNo, fulfillment/serial reference, Award reference or trace/correlation reference and explain the downstream numeric effects without recomputing history from current rules.

### EVL-2 Required source-to-effect chain

Where applicable, lineage must cover:

Commercial source
→ Order / OrderLine snapshots
→ Payment / recognition event
→ PV Ledger event(s)
→ Active/eligibility evidence
→ Sponsor/Binary historical relationship evidence
→ GPV/RPV/EPV/Referral calculation inputs
→ Carry/period/settlement evidence
→ theory/eligibility/K or rate application
→ Award
→ Award lifecycle
→ economic destination
→ Member Payable/Payout OR Company Reservoir B
→ Return/Reversal/Recovery/Replay append-only corrections.

Each stage should preserve or expose the stable source/evidence identifiers, rule/parameter version, business effective time and recorded time needed to traverse the chain.

### EVL-3 GPV

GPV lineage must include:
- source Order/OrderLine;
- SKU/product/rate/rule snapshot;
- GPV PV-ledger event;
- historical sponsor/binary evidence used by each applicable calculation;
- Referral/Equalization/Binary/Global or other downstream calculations that consume the GPV event;
- settlement batch and K/pool evidence where applicable;
- resulting Award/destination;
- reversal/replay/recovery effects.

Existing GPV historical replay snapshots remain authoritative; the lineage read model must not substitute current Sponsor/Active/Plan state for historical evidence.

### EVL-4 RPV

RPV lineage must explicitly cover the existing recognition chain:

Subscription / MonthlyRecognitionSchedule
→ RPV_CREATED PvLedger event
→ source Qualification
→ historical Binary ancestors/generation
→ effective direct-count snapshot
→ unlocked-depth snapshot
→ Active snapshot, including Company ALWAYS_ACTIVE policy
→ RpvUplineAwardEvent theory/payable
→ economic destination
→ Member payable/payout or Company Reservoir B
→ reversal/replay/recovery where applicable.

The lineage must preserve `recognitionId`, `pvLedgerEventId`, source/recipient Qualification, binary generation, direct-count/unlock/Active snapshots, rule version and parameter snapshot hash.

Do not compress or skip generations in the lineage representation when the authoritative RPV calculation does not do so.

### EVL-5 EPV

EPV lineage must explicitly cover:

Paid REPURCHASE Order
→ month-recognition context and cumulative/base/rate evidence
→ EPV_CREATED PvLedger event
→ EPV self Award (generation 0)
→ Sponsor-upline EPV Awards by fixed historical generation
→ Active/Plan/direct-count snapshots and rate used
→ Award lifecycle or Company Reservoir B routing
→ payable/payout
→ reversal/replay/recovery.

The existing EPV audit/evidence such as monthStart/monthEnd/timezone/base/rate/cumulative/increment and parameter snapshot must be linkable from the lineage.

A zero EPV recognition event remains meaningful evidence and must not disappear merely because the numeric increment is zero.

### EVL-6 Referral and Equalization

Referral lineage must distinguish at least:

**Sponsor relationship authority**
- SponsorRelationship / historical sponsor ancestry;
- actual fixed generation;
- no substitution with Binary parent.

**GPV-driven Referral/Equalization economics**
- source GPV event;
- effective historical source volume;
- G1 sponsor and G1 rate;
- G1 referral theory;
- recipient Active/Plan snapshots;
- Equalization generation;
- direct-count/unlock-depth evidence;
- configured rate;
- zero-entitlement/ineligible evidence;
- SettlementBatch pool/K;
- final BonusAward;
- Member payout or Company Reservoir B;
- reversal/replay/recovery.

Inactive/locked recipients with theoretical value but zero entitlement must remain explainable through BonusCalculationEvidence rather than disappearing from the chain.

### EVL-7 Retail Referral

Retail Referral is a distinct attribution/economic path and must also participate in the common lineage UX/read model.

Preserve:
- ReferralLink/attribution evidence where applicable;
- RetailReferrerAttribution and correction events;
- immutable referrer Ball snapshot;
- Order/OrderLine;
- SKU/product rule version;
- enabled/rate/base type;
- net paid item amount;
- Active-at-recognition snapshot;
- RETAIL_REFERRAL Award;
- Payable/Payout;
- Return/Recovery.

The existing Admin Retail Referral Explain remains authoritative and should be incorporated/reused rather than reimplemented with current-state recalculation.

### EVL-8 Referral attribution versus Sponsor relationship

Do not conflate:
- membership SponsorRelationship;
- web/anonymous ReferralAttribution;
- RetailReferrerAttribution;
- Binary parent/placement.

The lineage graph may connect these when an authoritative source edge exists, but must retain their distinct semantic types.

### EVL-9 Correlation and lineage identifiers

Where existing correlation/source identifiers are sufficient, reuse them.

If cross-module traversal has gaps, add minimal immutable lineage/evidence edges rather than duplicating monetary rows.

Preferred lineage node identity includes:
- node/evidence type;
- authoritative source table/entity;
- stable source ID/business reference;
- occurred/effective time;
- recorded time;
- rule version;
- parameter snapshot/hash;
- correlation/trace reference where available.

### EVL-10 Append-only correction semantics

Historical numeric facts must not be rewritten merely to show the latest effective total.

Return/reversal/recovery/replay should be represented as linked corrective effects.

The lineage must be able to show:
- original amount;
- correction/reversal;
- effective resulting amount;
- reason/source;
- replay revision/evidence where applicable.

### EVL-11 Admin Transaction Impact Trace

When implementation is released, provide an Admin read-only **交易影響追蹤** experience backed by server-side read models.

Search/entry points may include safe business identifiers:
- 訂單編號;
- 會員編號;
- 球號;
- 商品序號/出貨參考 where available;
- Award/settlement reference;
- trace/correlation reference.

The UI should present a chronological/causal graph or structured timeline in Traditional Chinese.

It must read stored evidence; it must not rerun economic rules to invent an explanation.

### EVL-12 Privacy/security

Lineage access is privileged operational/audit functionality.

Apply RBAC/BOLA and data minimization.

Normal Member UI must not gain visibility into another member's economic graph, internal UUIDs, protected company topology, payout details or sensitive personal information.

Use business identifiers in ordinary Admin display where practical; internal IDs may remain protected diagnostic evidence according to existing policy.

### EVL-13 Required verification

Before batch completion, add focused real-DB lineage Golden covering at minimum:

- ORDER_TO_GPV_LINEAGE = PASS
- GPV_TO_REFERRAL_AWARD_LINEAGE = PASS
- GPV_TO_EQUALIZATION_LINEAGE = PASS
- GPV_TO_BINARY_SETTLEMENT_LINEAGE = PASS
- GPV_TO_GLOBAL_POOL_LINEAGE = PASS
- RPV_RECOGNITION_TO_UPLINE_AWARD_LINEAGE = PASS
- RPV_COMPANY_DESTINATION_RESERVOIR_B_LINEAGE = PASS
- EPV_ORDER_TO_SELF_AWARD_LINEAGE = PASS
- EPV_TO_SPONSOR_UPLINE_AWARD_LINEAGE = PASS
- EPV_COMPANY_DESTINATION_RESERVOIR_B_LINEAGE = PASS
- REFERRAL_INELIGIBLE_ZERO_ENTITLEMENT_EVIDENCE = PASS
- RETAIL_REFERRAL_ORDER_TO_PAYOUT_LINEAGE = PASS
- RETURN_TO_REVERSAL_RECOVERY_LINEAGE = PASS
- REPLAY_CORRECTION_LINEAGE = PASS
- LINEAGE_USES_HISTORICAL_SNAPSHOTS_NOT_CURRENT_STATE = PASS
- LINEAGE_IDEMPOTENT_READ = PASS
- LINEAGE_RBAC_BOLA = PASS
- LINEAGE_NO_NORMAL_UI_UUID_LEAK = PASS.

### EVL-14 Implementation control

This is part of R1.0B-CR-BATCH-01 and follows the batch implementation/re-certification/Stage authorization.

Do not create an independent Stage release.

Production remains untouched until the full batch passes its normal release governance.


## 29. R1.0B CR-BATCH-01 Decision Closure — Repurchase Plans, Global Pool & Remaining Design Defaults

**Status:** OWNER-APPROVED / DECISION_CLOSURE / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-27 (Asia/Taipei)
**Batch:** R1.0B-CR-BATCH-01

This section closes the remaining business/design ambiguities discussed on 2026-09-27. Where this section conflicts with earlier CR-BATCH-01 text, this section supersedes it.

### DC-1 Repurchase plans are NOT subscriptions

The approved plans are prepaid **Repurchase Plans / 重銷方案**, not recurring subscriptions:

- 季重銷：2盒
- 半年重銷：4盒
- 年重銷：8盒

Each plan:
- is purchased with one payment;
- creates one confirmed commercial purchase;
- ships the full selected physical quantity once after normal payment/fulfillment authorization;
- does not automatically charge the customer again;
- does not create recurring monthly shipment orders;
- does not require skip/pause/cancel-renewal subscription semantics.

Any earlier CR-BATCH-01 language treating these three plans as recurring `SUBSCRIPTION` delivery products is superseded.

The existing technical Subscription/RPV runtime may be reused or migrated internally only if its semantics can represent this approved prepaid-plan authority without exposing false recurring-subscription behavior.

### DC-2 Monthly accounting recognition and Active

Although payment and physical shipment occur once, the purchased Repurchase Plan creates a fixed monthly recognition schedule across the plan term.

Approved default interpretation for implementation:
- 季重銷：3 monthly recognition periods;
- 半年重銷：6 monthly recognition periods;
- 年重銷：12 monthly recognition periods.

The plan's approved total recognition entitlement is allocated across those monthly periods using a deterministic schedule captured at purchase time.

Each monthly recognition:
- is an accounting/economic recognition event, not a new sale;
- does not create a new payment;
- does not create a new physical shipment;
- may create the approved RPV/economic effect for that recognition period;
- may establish/extend Active according to the authoritative Active rule for that period;
- must be idempotent and independently traceable.

Do not infer monthly recognition from current product configuration after purchase. Persist the plan/rule/parameter snapshot and monthly schedule at purchase confirmation.

### DC-3 Recognition allocation default

Unless a later approved product rule specifies otherwise, split the plan's total recognized RPV/recognition entitlement evenly across its monthly periods.

Because currency/volume rounding can produce a remainder, use deterministic remainder handling:
- periods 1..N-1 receive the normalized rounded monthly amount;
- the final period receives the exact remaining amount;
- sum of all monthly recognition events MUST equal the original plan entitlement exactly.

Do not split physical units fractionally. Product quantities are shipped once; only accounting/economic recognition is amortized.

### DC-4 Recognition timing

Recommended implementation default:
- first recognition occurs at the authoritative paid/plan-effective date;
- subsequent recognition occurs monthly on the same local calendar day in the approved business timezone;
- if that day does not exist in a target month, use the last valid day of that month;
- persist every due date when the plan is created so later timezone/calendar changes do not rewrite history.

The existing business-calendar/timezone authority remains controlling where already defined.

### DC-5 Returns/cancellation after one-time shipment

Because goods ship once while recognition is monthly, return handling must distinguish:
- recognition already posted;
- future unrecognized entitlement;
- Award/Payable already derived from recognized periods.

Recommended default:
- accepted full return cancels all future unrecognized monthly recognition and creates append-only reversal/recovery for already recognized economic effects according to existing return/recovery authority;
- accepted partial return reduces future unrecognized entitlement proportionally to the returned eligible value/quantity and records any required reversal/recovery for already recognized attributable value;
- never delete or rewrite prior recognition/Award history;
- returned serialized units remain traceable to the original Order/Fulfillment/OrderLine.

Exact return eligibility/window remains governed by the existing commerce/legal return policy; this section defines economic treatment after an accepted return.

### DC-6 Commercial line purpose terminology

For new CR-BATCH-01 UI/domain presentation, use:
- 資格套組 / QUALIFICATION_PACKAGE
- 加購商品 / ADDITIONAL_PURCHASE
- 重銷方案 / REPURCHASE_PLAN

Do not present the approved 季/半年/年 plans to users as 訂閱/Subscription.

If existing internal schema/enums still use `SUBSCRIPTION`, implementation must assess a backward-compatible migration/adapter strategy rather than blindly renaming historical records.

### DC-7 Global Pool authority reconciliation — APPROVED

The current Runtime Global Pool rank model is approved as the R1.0B authority for this batch:

- NEW_STAR → 新星
- EXCELLENCE → 卓越
- GLORY → 榮耀
- DIAMOND → 鑽石
- CROWN → 皇冠

Current Runtime parameterized weak-side thresholds and rank pool rates remain authoritative unless a separately approved parameter change is made through normal rule governance.

Global rank is historical achievement; once achieved it is not downgraded. Current-period distribution eligibility still follows the authoritative Active/current-period weak-side/rank-slice rules.

UI badges, Admin Explain, Member-safe future achievement read models, DB enum/parameters, Golden and formal documents must be reconciled to this single authority.

Conflicting older conceptual rank names must not be used as current Runtime authority.

### DC-8 Sponsor and Binary Placement closure

Approved:
- SponsorRelationship is established by the designated Sponsor Qualification/Ball and is independent of Binary parentage;
- Sponsor and Binary parent are not interchangeable concepts;
- Binary Placement must be tree-local;
- child and Binary parent must belong to the same Binary Tree for placement;
- cross-tree Binary Placement is rejected;
- placement must not rewrite SponsorRelationship.

No new SponsorTree aggregate or mandatory SponsorTreeId is introduced.

No additional cross-tree Sponsor restriction is introduced by this batch beyond existing Sponsor authority.

### DC-9 Binary bootstrap profile closure

Approved:
- Binary Tree bootstrap is profile-driven;
- current standard profile = 7 bootstrap Company Balls;
- standard bootstrap qualification = LEADER_72000;
- Company bootstrap Balls = ALWAYS_ACTIVE;
- applicable Company Awards route to Reservoir B;
- first normal member position derives from the selected contiguous profile, currently 8;
- live/operational Tree bootstrap structural parameters are immutable;
- Admin selects only approved/published profiles rather than entering arbitrary live topology numbers.

### DC-10 Fulfillment/ERP closure

Approved:
- UCell Order is Commercial Authority;
- UCell Fulfillment Projection is physical fulfillment authority;
- ERP is inventory/pick/pack/ship execution authority;
- Serialized Unit is physical traceability authority;
- qualification/additional/repurchase-plan semantics remain in UCell;
- ERP receives executable SKU/quantity/delivery requirements;
- EzTooL integration uses an adapter boundary;
- future Dynamics 365 BC may replace/add an adapter without rewriting UCell Business Core;
- durable idempotent handoff and reconciliation are required;
- one Order may produce multiple Fulfillments for operational exceptions, but an approved Repurchase Plan normally creates one immediate physical fulfillment because its goods ship once.

### DC-11 Serialized fulfillment closure

Approved:
- preserve approved PBBBSSSS v1 serial semantics and A-E product mapping;
- warehouse flow verifies Order/Fulfillment → SKU → Serial → exact quantity before shipment;
- actual serials bind to Fulfillment allocations and source OrderLines;
- wrong/duplicate/ineligible/already-shipped serials fail closed;
- returns preserve Serial → Shipment → Fulfillment → OrderLine → business-purpose provenance.

### DC-12 Economic Value Lineage closure

Approved:
- do not create a second accounting ledger;
- reuse existing Order snapshots, PvLedger, historical replay snapshots, Active evidence, Carry, Settlement, Award, destination, Payable/Payout, Reservoir B and Recovery/Replay authorities;
- add minimal missing immutable edges/correlation and a unified server-side read model;
- cover GPV, RPV, EPV, REFERRAL, RETAIL_REFERRAL, EQUALIZATION, BINARY, MATCHING and GLOBAL;
- zero-entitlement/zero-recognition evidence remains explainable;
- historical Explain uses historical snapshots, never current-state recomputation;
- Admin receives a read-only 交易影響追蹤 experience;
- first UI version should be a structured chronological/causal timeline with expandable calculation details, not an unnecessarily complex graph visualization.

### DC-13 Common Explain contract recommendation

Implement a lightweight common read-model envelope where applicable:

- effectType
- sourceType
- safe sourceBusinessRef
- subjectBallNo/memberNo where authorized
- inputAmount/baseAmount
- rate
- theoryAmount
- adjustmentFactor/K where applicable
- finalAmount
- eligibility/result
- reasonCode
- ruleVersion
- parameterSnapshotHash
- occurredAt/effectiveAt
- recordedAt
- safe upstream/downstream references

This is a presentation/read contract, not a new financial source of truth.

### DC-14 UI/localization closure

Approved:
- current Taiwan Admin/Member ordinary UI is Traditional-Chinese-first;
- Admin is multilingual-ready;
- future Member WebApp/native APP/LINE/WeChat/regional channels may use channel/region-appropriate presentation;
- Backend/API canonical business codes remain language-neutral;
- do not build an enterprise translation CMS now;
- current Admin/Member Web may support SYSTEM/LIGHT/DARK;
- future channels may use platform-native theme mechanisms;
- system icons and Qualification/Global Rank emblems remain presentation-only and follow canonical codes.

### DC-15 Paper enrollment closure

Approved:
- Admin Paper Fast Enrollment and LINE/Member selection use the same server-side package/product/order authority;
- STARTER=3, ELITE=9, LEADER=15 selectable units across the approved five-product pool;
- additional purchases remain distinct;
- Repurchase Plan selection remains distinct from Qualification Package and Additional Purchase;
- signed physical Membership Application, Order Form and Distributor Agreement are authoritative paper evidence;
- no signed-image scanning/OCR/e-signature requirement;
- system preserves historical structured print/document/version snapshots.

### DC-16 Remaining implementation details are technical, not business-decision blockers

The following should be resolved during implementation by the least-complex design consistent with current authority and do not require a new business decision unless repository constraints reveal a material conflict:

1. exact table naming for Bootstrap Profile/version snapshots;
2. whether existing Subscription tables can safely represent prepaid Repurchase Plan schedules or require a dedicated/migrated model;
3. exact API route/resource names for Repurchase Plan and Economic Lineage;
4. exact Admin component/layout implementation;
5. exact EzTooL transport/API mechanism after integration discovery;
6. exact indexes/materialized/read projections needed for Lineage performance;
7. exact internal event naming, provided canonical meaning and evidence remain stable;
8. test fixture/reseed mechanics for disposable Local/Stage data.

Implementation must prefer reuse over duplication, forward-safe migrations, server authority, append-only evidence and minimal complexity.

If any of these technical choices would change approved business meaning, economic outcomes, legal obligations, privacy boundaries or historical replay, stop and return it as DECISION_REQUIRED.

### DC-17 Pre-implementation closure gate

Before coding R1.0B-CR-BATCH-01, produce one consolidated impact package containing:

- final decision matrix;
- conflict/supersession map for earlier CR text;
- DB/schema/migration impact;
- API/OpenAPI impact;
- Admin/Member/LINE impact;
- economic-engine impact;
- Repurchase Plan recognition schedule design;
- ERP/Fulfillment/Serial impact;
- Golden/replay/reconstruction plan;
- Local/Stage reseed plan;
- rollback/recovery boundary.

Only after this package shows no unresolved material business decision should the batch status move from IMPLEMENTATION_PENDING to RELEASED_FOR_DEVELOPMENT.

Production remains untouched.


## 30. R1.0B CR-BATCH-01 — Commercial Offering & Product Classification Authority

**Status:** OWNER-APPROVED / INCLUDED_IN_BATCH / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-27 (Asia/Taipei)
**Batch:** R1.0B-CR-BATCH-01

### CO-1 Five approved commercial categories

The current approved commercial offering categories are:

1. **會員資格套組（可自選）** — `QUALIFICATION_PACKAGE`
2. **季／半年／年重銷套組（可自選）** — `REPURCHASE_PLAN`
3. **主商品** — `CORE_PRODUCT`
4. **普銷商品** — `RETAIL_PRODUCT`
5. **促銷商品組合** — `PROMOTIONAL_BUNDLE`

These are commercial-sale classifications and must not be confused with physical SKU identity.

### CO-2 Four-layer semantic separation

The implementation must distinguish:

1. **Product / SKU** — what the physical product is;
2. **Commercial Offering** — how the product(s) are being offered/sold;
3. **Order Line Purpose / Purchase Context** — why this quantity appears in this specific Order;
4. **Fulfillment** — what physical SKU/quantity must actually ship.

Do not collapse these four concepts into one product category field.

### CO-3 Product/SKU authority

A physical product such as TIP-363/TIP-999/TIP-580/TIP-696/TIP-777 remains one Product/SKU authority.

The same Product/SKU may be eligible for multiple Commercial Offerings without duplicating the physical product master.

Example: TIP-580 may be eligible for a Qualification Package, a Repurchase Plan and direct sale where approved by the effective offering/rule version.

### CO-4 Qualification Package

`QUALIFICATION_PACKAGE` is a selectable Commercial Offering.

Current approved selection rules:
- STARTER / 啟航 = exactly 3 units;
- ELITE / 菁英 = exactly 9 units;
- LEADER / 領袖 = exactly 15 units;
- selectable from the approved five-product pool unless a versioned PackageConfig rule changes eligibility.

Qualification selection must be preserved as a business snapshot and must not be replaced by a fake generic ERP bundle SKU that loses the selected physical composition.

### CO-5 Repurchase Plan

`REPURCHASE_PLAN` is a selectable prepaid Commercial Offering and is **not a recurring subscription**.

Current approved plans:
- 季重銷 = 2 units, one payment, one shipment, 3 monthly accounting/Active recognition periods;
- 半年重銷 = 4 units, one payment, one shipment, 6 monthly accounting/Active recognition periods;
- 年重銷 = 8 units, one payment, one shipment, 12 monthly accounting/Active recognition periods.

The selected physical composition is fixed in the confirmed Order snapshot. Monthly recognition operates on the captured economic entitlement/schedule and does not create new physical shipments.

### CO-6 Core Product

`CORE_PRODUCT` represents approved principal/core products sold as direct commercial items.

A Core Product remains a physical Product/SKU and may also be eligible inside other Offering types when explicitly allowed by the effective rules.

Core Product classification alone must not imply Qualification, Repurchase recognition, Promotion or Retail Referral economics.

### CO-7 Retail Product

`RETAIL_PRODUCT` represents products approved for ordinary retail/general-sale commerce.

Retail eligibility, Retail Referral eligibility, PV/BV/GPV treatment and pricing remain versioned rule attributes; the label RETAIL_PRODUCT alone must not silently manufacture economic effects.

### CO-8 Promotional Bundle

`PROMOTIONAL_BUNDLE` represents a versioned promotional Commercial Offering.

It may support:
- a fixed product composition; or
- a selectable composition only when an approved selection rule explicitly allows it.

At minimum a promotion Offering should be capable of governing:
- offering/version code;
- effective sales window;
- eligible channel;
- price rule;
- product composition/selection rule;
- quantity/purchase limits where applicable;
- PV/BV/GPV/economic rule reference;
- status/approval evidence.

A promotion must not rewrite the underlying Product/SKU master.

### CO-9 Additional Purchase is not a sixth product category

`ADDITIONAL_PURCHASE` is an **Order Line Purpose / Purchase Context**, not a Commercial Offering category.

Example:
- Product = TIP-580;
- Commercial Offering = CORE_PRODUCT;
- Order Line Purpose = ADDITIONAL_PURCHASE.

This distinction preserves why the item was purchased without inventing another product class.

### CO-10 Order snapshot/provenance

Each confirmed Order/OrderLine must preserve sufficient immutable/versioned evidence to identify, where applicable:
- Product/SKU;
- Commercial Offering type/code/version;
- source package/plan/promotion;
- line purpose/purchase context;
- selected quantity;
- price/rule/PV/BV/GPV snapshots;
- recognition profile/schedule reference for Repurchase Plan;
- selection-group evidence for selectable offerings.

Historical Orders must not be reinterpreted from today's current Offering configuration.

### CO-11 Fulfillment projection

Fulfillment consumes the confirmed physical SKU/quantity result of the Commercial Offering.

ERP does not need to understand Qualification, Repurchase recognition or Promotion economics.

Multiple OrderLines with the same SKU may be aggregated for physical execution, but UCell must preserve allocation/provenance back to each source OrderLine and Offering/Purpose.

### CO-12 Return and lineage

Return/Recovery must preserve:

Serialized Unit where applicable
→ Shipment
→ Fulfillment Allocation
→ OrderLine
→ Commercial Offering
→ Order Line Purpose
→ economic/qualification/recognition consequences.

This is required to distinguish a returned Qualification item, Repurchase Plan item, Core/Retail item or Promotion item even if the physical SKU is identical.

### CO-13 Admin/Member presentation

Current Taiwan UI uses Traditional Chinese labels:
- 會員資格套組
- 重銷方案
- 主商品
- 普銷商品
- 促銷商品組合

Do not expose internal English enum values as ordinary labels.

Admin should clearly distinguish physical Product/SKU from Commercial Offering configuration.

Member/LINE selection UI should show only Offerings valid for the current channel/effective period.

### CO-14 Recommended implementation model

Prefer extending/reusing the existing ProductReference, ProductRuleProfile and PackageConfig authorities with a lightweight versioned Commercial Offering layer/adapter rather than creating five unrelated sales engines.

The exact schema is a technical design decision subject to the pre-implementation impact review.

Do not introduce a new table merely because an enum can represent a concept; add persistence only where versioning, composition, effective period, channel or historical snapshot authority requires it.

### CO-15 Required verification

Add batch verification covering at minimum:
- PRODUCT_SKU_NOT_DUPLICATED_BY_OFFERING = PASS
- QUALIFICATION_PACKAGE_SELECTION_3_9_15 = PASS
- REPURCHASE_PLAN_SELECTION_2_4_8 = PASS
- REPURCHASE_PLAN_ONE_PAYMENT_ONE_SHIPMENT = PASS
- REPURCHASE_PLAN_MONTHLY_RECOGNITION_3_6_12 = PASS
- CORE_PRODUCT_DIRECT_SALE = PASS
- RETAIL_PRODUCT_DIRECT_SALE = PASS
- PROMOTIONAL_BUNDLE_VERSIONED_COMPOSITION = PASS
- ADDITIONAL_PURCHASE_IS_PURPOSE_NOT_CATEGORY = PASS
- ORDER_PRESERVES_OFFERING_VERSION_SNAPSHOT = PASS
- FULFILLMENT_PRESERVES_SOURCE_ALLOCATION = PASS
- RETURN_PRESERVES_OFFERING_PROVENANCE = PASS
- ECONOMIC_LINEAGE_PRESERVES_OFFERING_SOURCE = PASS.

### CO-16 Supersession

Any earlier CR-BATCH-01 text that describes `SUBSCRIPTION` as the approved 季／半年／年 customer-facing commercial category is superseded by `REPURCHASE_PLAN`.

Existing technical Subscription/RPV structures remain subject to implementation assessment and may be reused internally only where they preserve the approved Repurchase Plan business meaning.

Current status remains **IMPLEMENTATION_PENDING** until the consolidated pre-implementation closure gate is passed.


## 31. R1.0B CR-BATCH-01 — Manual Bank Transfer Payout Authority

**Status:** OWNER-APPROVED / INCLUDED_IN_BATCH / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-27 (Asia/Taipei)
**Batch:** R1.0B-CR-BATCH-01
**Scope:** Payable materialization, payout batching, finance review/approval, bank-format export, company payment execution evidence, reconciliation and Economic Value Lineage.

### MBP-1 Operating model

Phase-1/R1.0B payout uses **manual/company-controlled bank transfer**, not direct bank API disbursement.

UCell is responsible for:
- authoritative Award/Payable amounts;
- Recovery offsets;
- payout batch preparation;
- finance review/approval workflow;
- bank-format transfer-list generation/export;
- export evidence/version/hash;
- payment-result recording/reconciliation;
- audit and Economic Value Lineage.

The company's existing banking/signature/payment process remains responsible for actual movement of funds.

No automatic bank-transfer API is required by this batch.

### MBP-2 End-to-end payout flow

Approved operational flow:

Settlement
→ Award
→ Award maturity
→ Payable
→ Recovery offset
→ Payout Batch DRAFT
→ Finance review
→ Approval/lock
→ Bank transfer file/list export
→ Existing company bank/payment approval process
→ Payment result confirmation/reconciliation
→ PAID / PARTIALLY_PAID / FAILED evidence.

Generating/downloading a bank file MUST NOT itself mark a payout as paid.

### MBP-3 Human control boundary

Period/worker automation may:
- perform approved economic settlement jobs;
- mature due Awards;
- materialize eligible Payables;
- prepare payable/payout candidates.

A human Finance-authorized action is required before producing an approved final bank-payment export.

Actual external payment remains outside automatic worker execution.

High-risk corrections and payout-result confirmation remain governed Admin actions with audit evidence.

### MBP-4 Payout batch lifecycle

Implementation should provide an explicit governed lifecycle equivalent to:

- DRAFT
- REVIEWED
- APPROVED
- EXPORTED
- PROCESSING
- PAID
- PARTIALLY_PAID
- FAILED

Exact internal enum naming may differ if existing schema can represent the same authority without ambiguity.

At minimum:
- APPROVED/locked batches cannot silently change economic lines;
- EXPORTED means a bank-transfer artifact was generated, not that money moved;
- PAID requires confirmed payment-result evidence;
- failed lines remain reconcilable/retryable without recalculating their originating Awards.

### MBP-5 Batch and line snapshots

At approval/export time preserve immutable/versioned payout evidence sufficient to reproduce what Finance authorized.

At minimum where applicable:
- payoutBatch business reference;
- payment period;
- recipient memberNo/ballNo business references;
- recipient Qualification authority;
- gross payable amount;
- Recovery offset;
- net transfer amount;
- payee name snapshot;
- bank code/branch data required by the approved format;
- bank account snapshot required for payment;
- export adapter/format/version;
- generated/exported timestamp;
- generated/exported by;
- approval evidence;
- content/file hash;
- source PayableEntry/PayoutLine references;
- rule/economic lineage references.

Do not regenerate a historical approved bank file from today's changed bank-account or member master data.

### MBP-6 Sensitive banking data

Bank account and payment identity data are sensitive operational data.

Requirements:
- least-privilege Finance access;
- ordinary Admin/Member UI masks sensitive bank values;
- complete bank details appear only where required for authorized payment/export;
- no bank account data in ordinary logs, public traces or Member-facing URLs;
- export/download action is audited;
- exported artifacts follow approved retention/access handling.

Normal Member UI should expose only safe payout status/reference information, not internal payout IDs or other members' banking data.

### MBP-7 Bank export adapter

Do not hard-code one bank's layout into the economic/Payout engine.

Use a lightweight export adapter boundary:

Payout Batch
→ Bank Export Adapter
→ approved bank-specific format and/or controlled generic finance CSV/XLSX.

Initial implementation only needs the company's actually approved operational format(s).

Adding/changing a bank format must not require changing Award calculation logic.

### MBP-8 Finance review export

In addition to any bank-specific machine/import format, provide a human-readable finance review export where operationally useful.

It should reconcile at least:
- recipient business reference;
- gross payable;
- Recovery offset;
- net payable;
- bank destination (appropriately protected);
- exception/status.

The review artifact and bank-import artifact may be separate outputs from the same approved locked batch.

### MBP-9 Payment result and reconciliation

After the company's bank/payment process, UCell must support recording actual results.

Preferred:
- import/parse an approved bank result file when the bank provides a stable format; or
- controlled Finance confirmation with per-line failure handling when no reliable result format exists.

Support at least:
- successful line;
- failed line;
- partial batch success;
- failure reason/reference where available.

A failed transfer does not create a new Award and does not recalculate economics. The unpaid Payable/Payout obligation remains traceable for controlled retry/correction.

### MBP-10 Idempotency and export identity

Repeated export/download of the same locked batch must not create duplicate PayoutLines or new economic obligations.

Every bank export artifact should have a stable export identity/version and content hash.

If a corrected payment file is required, create a governed replacement/export revision rather than silently overwriting the historical approved artifact.

### MBP-11 Recovery interaction

Recovery offsets are applied before the net bank-transfer amount is finalized according to existing UnifiedPayable/Recovery authority.

Lineage must explain:

Gross Payable
− Recovery Offset
= Net Transfer Amount.

Recovery after an already completed payment remains an append-only future recovery/clawback obligation; do not rewrite the historical paid amount.

### MBP-12 Economic Value Lineage extension

Extend Economic Value Lineage through the final operational payment evidence:

Order/Recognition
→ GPV/RPV/EPV
→ Award
→ Award lifecycle
→ Payable
→ Recovery offset
→ PayoutLine
→ PayoutBatch
→ Bank Export Artifact
→ Company payment result
→ reconciliation/retry/recovery.

An authorized Admin should be able to explain whether an amount is:
- calculated;
- pending;
- effective;
- payable;
- included in a batch;
- exported;
- confirmed paid;
- failed/unpaid;
- subject to Recovery.

### MBP-13 Scheduling/orchestration consequence

Do not add a Cron that automatically sends money.

The planned Period Close Orchestrator may automate safe preparation through eligible Payable/candidate preparation, but Finance review/approval/export remains a human gate.

Existing Admin payout endpoints/UnifiedPayableService should be reused and extended rather than bypassed.

### MBP-14 Required verification

Add batch verification covering at minimum:
- PAYABLE_TO_PAYOUT_BATCH_LINEAGE = PASS
- RECOVERY_OFFSET_TO_NET_TRANSFER = PASS
- PAYOUT_BATCH_REVIEW_APPROVAL_GATE = PASS
- EXPORT_DOES_NOT_MARK_PAID = PASS
- BANK_EXPORT_IDEMPOTENT = PASS
- BANK_EXPORT_USES_LOCKED_SNAPSHOT = PASS
- BANK_EXPORT_HASH_EVIDENCE = PASS
- BANK_DATA_RBAC_MASKING = PASS
- PARTIAL_BANK_RESULT_RECONCILIATION = PASS
- FAILED_TRANSFER_REMAINS_UNPAID = PASS
- FAILED_TRANSFER_RETRY_NO_DUPLICATE_AWARD = PASS
- PAID_RESULT_LINEAGE = PASS
- POST_PAYMENT_RECOVERY_APPEND_ONLY = PASS
- NO_AUTOMATIC_BANK_DISBURSEMENT = PASS.

### MBP-15 Implementation assessment

Before implementation, inspect the existing PayoutBatch/PayoutLine/UnifiedPayable models and Admin payout UI to determine the minimum forward-safe extension needed for:
- review/approval/lock;
- bank export artifacts;
- bank format adapters;
- result reconciliation.

Reuse current payout/recovery authority wherever possible.

If an existing field/status cannot represent the approved lifecycle without ambiguity, use a forward-safe migration; do not reinterpret historical states silently.

Current status remains **IMPLEMENTATION_PENDING** and follows the consolidated CR-BATCH-01 closure/re-certification/Stage authorization. Production remains untouched.


## 32. R1.0B / Post-R1.0B Product Roadmap — Operations, Member 360, Tasks, Exceptions, Learning & Events

**Status:** OWNER-APPROVED PLANNING / SCOPE-SLICED / IMPLEMENTATION_PENDING
**Approved date:** 2026-09-27 (Asia/Taipei)

This section establishes the product/system plan for five related capabilities while preventing uncontrolled expansion of the current R1.0B delivery.

### OME-1 Product grouping

The following capabilities form a shared **Operations & Member Growth Layer** above existing UCell domain authorities:

1. 營運控制中心 — Admin
2. 會員360與成長分析 — Admin + Member-facing
3. 教育訓練與活動中心 — online/offline/hybrid
4. 待辦事項中心 — Admin
5. 異常中心 — Admin

These capabilities consume authoritative Membership, Organization, Commerce, Economic, Fulfillment, Audit and future Learning/Event facts. They MUST NOT create a second source of truth for those domains.

### OME-2 Delivery slicing

To keep R1.0B bounded, approved delivery slicing is:

**R1.0B Foundation / V1**
- 營運控制中心 V1;
- 待辦事項中心 V1;
- 異常中心 V1;
- Admin 會員360 V1;
- shared Activity Timeline Projection.

**Next enhancement slice**
- Member-facing「我的成長」;
- 教育訓練中心;
- 活動中心;
- course progress/completion;
- event registration/check-in;
- learning/event integration into Member 360;
- server-authoritative rank/growth progress presentation.

This roadmap classification may be revisited during the consolidated pre-implementation impact gate if the foundation dependency proves smaller/larger than expected.

### OME-3 Operations Control Center V1

Admin receives a role-aware operational cockpit focused on actionability, not decorative KPIs.

Recommended sections:
- 今日營運: new members, paid orders, fulfillment/shipment, returns, recognition;
- 組織營運: new/effective Qualifications/Balls, pending placements, Binary Tree status, newly achieved Global ranks;
- 獎金/財務: settlement readiness/status, matured Awards, Payables, payout batches, Recovery, bank-transfer failures;
- 系統健康: Outbox backlog/failures, recognition delays, worker/provider/LINE/ERP/integration health;
- 我的待辦;
- 開放異常.

Every aggregate should drill down to stored evidence/read models where authorized.

The dashboard must not recompute economic truth in the browser.

### OME-4 Admin Member 360 V1

Provide one read-oriented Member 360 workspace aggregating, subject to RBAC/privacy:
- basic member/business identity;
- LINE/link status where applicable;
- Qualifications/Balls;
- Sponsor and Binary organization views;
- Active and Repurchase Plan status;
- Orders/Fulfillment/Shipment/Returns;
- GPV/RPV/EPV summaries and links to Economic Value Lineage;
- Awards/Payables/Payout status;
- Global Rank achievement;
- Tasks/Exceptions related to the member;
- Activity Timeline.

Member 360 is a composed read model/workspace, not a new mutable Member master.

Sensitive bank/payment/internal UUID data remains protected.

### OME-5 Growth analysis model

Growth must be multi-dimensional and explainable, not a hidden AI score.

Planned dimensions:
- Qualification progression;
- organization growth;
- Active stability;
- Global Rank achievement/progress;
- learning progress;
- event participation.

Do not create a single opaque 0–100 member score in the initial design.

Any future "distance to next level" or achievement progress must be calculated server-side from authoritative rules/read models; frontend inference is prohibited.

### OME-6 Member-facing My Growth — next slice

Future Member UI may present:
- current Qualification;
- Active status;
- current/achieved Global Rank;
- server-calculated next-achievement progress;
- organization indicators appropriate for the member;
- learning completion;
- upcoming/attended events.

Presentation may differ by Member Web/LINE/APP/WeChat/regional channel under the existing channel-localization authority.

### OME-7 Activity Timeline Projection

Create a lightweight, rebuildable Activity Timeline projection from authoritative events/facts.

Candidate event types include:
- MEMBER_JOINED;
- LINE_LINKED;
- QUALIFICATION_EFFECTIVE;
- BALL_PLACED;
- ORDER_CONFIRMED/PAID;
- FULFILLMENT/SHIPMENT;
- RETURN_POSTED;
- GPV/RPV/EPV_RECOGNIZED;
- GLOBAL_RANK_ACHIEVED;
- AWARD/PAYOUT milestone;
- COURSE_STARTED/COMPLETED;
- EVENT_REGISTERED/ATTENDED;
- operational Task/Exception milestones where useful.

The timeline is a read projection. It MUST reference source evidence and MUST NOT become authority for the underlying business state.

Projection rebuild must be deterministic/idempotent where feasible.

### OME-8 Admin Task Center V1

Tasks support two origins:

**System-generated work items**
Examples:
- paper application review;
- LINE-link review;
- payout review;
- return review;
- ERP/integration follow-up;
- failed bank-transfer follow-up.

**Human-created work items**
Examples:
- follow up with a member;
- verify approved operational information.

Minimum task semantics:
- task type;
- Chinese title/summary;
- source/origin;
- related safe business entity/reference;
- assignee user/role/team as supported;
- priority;
- dueAt;
- status;
- completion/closure evidence;
- created/updated timestamps.

A Task is NOT business authority.

Marking a Task complete MUST NOT approve a Payout, alter a Qualification, resolve a Return, change an Award or mutate another governed workflow unless the user separately executes the authoritative domain action.

### OME-9 Exception Center V1

Exceptions represent detected abnormal conditions, not ordinary work.

Recommended lifecycle:
- OPEN
- ACKNOWLEDGED
- INVESTIGATING
- RESOLVED

Minimum semantics:
- exception type/code;
- severity;
- source system/domain;
- related safe business reference;
- detectedAt;
- evidence/diagnostic reference;
- assigned owner where applicable;
- status;
- resolution evidence;
- correlation/trace reference.

Candidate exception families:
- economic lineage/invariant gaps;
- overdue RPV recognition;
- settlement/job delay/failure;
- Company Award destination mismatch;
- Payable/Award/Payout reconciliation mismatch;
- ERP/Fulfillment/Serial mismatch;
- bank-transfer failure;
- Outbox/provider/LINE failure;
- projection/read-model staleness.

Exceptions may generate Tasks. Tasks do not automatically imply an Exception.

### OME-10 Invariant monitoring

Prefer explicit invariant checks over generic log dashboards for business-critical integrity.

Examples:
- Payable must trace to authoritative Award/economic source;
- Company Award routing must reconcile to Reservoir B where applicable;
- Payout line totals must reconcile to Payables and Recovery offsets;
- due monthly recognition must not remain unprocessed beyond an approved tolerance;
- Fulfillment shipped quantities/serials must reconcile;
- Economic Lineage must not contain broken required source edges.

Exact thresholds and alert routing remain technical/operational configuration unless they change business meaning.

### OME-11 Learning & Event Center — next slice

Plan one center with two subdomains:

**Learning**
- course;
- category;
- module/lesson;
- video/document/article/external-link content;
- optional quiz;
- audience/eligibility;
- enrollment/assignment where needed;
- started/progress/completed evidence;
- completion timestamp/result.

**Events**
- ONLINE / OFFLINE / HYBRID;
- event/session;
- location or online joining information;
- capacity where applicable;
- registration;
- cancellation/waitlist where later required;
- QR or equivalent check-in;
- attendance evidence.

Do not build a proprietary video streaming platform in the first slice; support governed hosted/external content references.

Learning completion does not affect Qualification/Active/Award unless a later explicit business rule authorizes that dependency.

### OME-12 Learning/Event integration

Learning and Event facts should feed:
- Member 360;
- Member My Growth;
- Activity Timeline;
- Operations Control Center aggregates where useful;
- future notification workflows.

They remain distinct domain facts and should not be encoded as arbitrary notes on Person.

### OME-13 Notification readiness

Design Learning/Event/Task/Exception milestones so they can emit canonical business notifications through the existing notification architecture.

Business event and delivery channel remain separate.

Future channels may include:
- Web;
- LINE;
- APP Push;
- email;
- WeChat or other regional channels.

This section does not require all channels in R1.0B.

### OME-14 RBAC/privacy

All five capabilities must respect existing RBAC/BOLA/privacy policy.

Operations/Admin views are role-aware.

Member-facing growth views expose only the authenticated member's authorized data.

Member 360 must not become a shortcut around domain authorization.

Task/Exception payloads must avoid copying unnecessary sensitive data; reference protected source evidence instead.

### OME-15 Read-model freshness

Operational dashboards must disclose meaningful freshness/data-through information for asynchronous projections where stale data could mislead operators.

Do not present stale analytics projection as live economic authority.

Critical operational actions must resolve against authoritative domain state at action time.

### OME-16 UI principles

Current Taiwan Admin:
- Traditional-Chinese-first;
- clear drill-down;
- severity/status not communicated by color alone;
- compatible with planned LIGHT/DARK/SYSTEM foundation;
- refined shared system icons where appropriate.

Member-facing future growth UI may use channel/region-appropriate design.

### OME-17 Initial technical boundary

Prefer:
- server-side read models/projections;
- existing Outbox/domain facts;
- lightweight Task/Exception authorities;
- deterministic Activity Timeline projection.

Avoid:
- duplicating domain tables into a CRM shadow database;
- browser-side economic/rank calculations;
- one giant generic "activity" table as the source of all business truth;
- premature AI scoring;
- premature full CRM/marketing automation;
- premature custom video infrastructure.

### OME-18 V1 verification expectations

For the R1.0B Foundation slice, plan tests for:
- OPERATIONS_CENTER_READS_AUTHORITATIVE_FACTS = PASS
- OPERATIONS_CENTER_ROLE_FILTERING = PASS
- MEMBER_360_NO_DUPLICATE_BUSINESS_AUTHORITY = PASS
- MEMBER_360_RBAC_BOLA = PASS
- ACTIVITY_TIMELINE_SOURCE_TRACEABLE = PASS
- ACTIVITY_TIMELINE_REBUILD_IDEMPOTENT = PASS
- TASK_COMPLETION_DOES_NOT_MUTATE_DOMAIN_AUTHORITY = PASS
- SYSTEM_TASK_SOURCE_TRACEABLE = PASS
- EXCEPTION_SOURCE_EVIDENCE_TRACEABLE = PASS
- EXCEPTION_TO_TASK_LINK_OPTIONAL = PASS
- INVARIANT_MONITOR_DETECTS_SEEDED_FAILURE = PASS
- READ_MODEL_FRESHNESS_VISIBLE = PASS
- NORMAL_UI_NO_INTERNAL_UUID_LEAK = PASS.

### OME-19 Next-slice verification expectations

For Learning/Event/My Growth later:
- COURSE_PROGRESS_TRACEABLE;
- COURSE_COMPLETION_IDEMPOTENT;
- EVENT_REGISTRATION_IDEMPOTENT;
- EVENT_CHECKIN_SINGLE_EFFECTIVE_ATTENDANCE;
- MEMBER_GROWTH_SERVER_AUTHORITY;
- LEARNING_EVENT_TIMELINE_INTEGRATION;
- MEMBER_SELF_ONLY_PRIVACY;
- CHANNEL_PRESENTATION_INDEPENDENCE.

### OME-20 Scope control

The five capabilities are approved as the product direction.

Only the Foundation/V1 items in OME-2 are candidates for inclusion in the current R1.0B implementation impact package.

Learning/Event Center and Member-facing My Growth are approved planned enhancements but should not delay the current R1.0B release unless the pre-implementation dependency review identifies a required foundational dependency.

Production remains untouched.


## 33. R1.0B / Operations & Member Growth Amendment — Member Messaging vs LINE OA Broadcast

**Status:** OWNER-APPROVED / SUPERSEDING CHANNEL-AMBIGUOUS NOTIFICATION GUIDANCE
**Approved date:** 2026-09-27 (Asia/Taipei)

### MSG-1 Primary member-message authority

UCell's **Member System Messaging / 會員系統訊息** is the primary channel for ordinary member-directed operational and personalized messages.

Examples include, where applicable:
- order/payment status;
- fulfillment/shipment status;
- Repurchase Plan monthly recognition/Active information;
- Award/Payable/Payout status;
- Qualification/achievement information;
- Task/service follow-up;
- learning/course reminders;
- event registration/attendance information;
- member-specific operational notices.

These messages are delivered and retained through UCell's member-facing message/notification experience and must respect authorization/privacy.

### MSG-2 LINE Official Account role

LINE Official Account is primarily for **large-scale/broadcast announcements** and approved mass communication.

Examples:
- company-wide announcements;
- major campaign/activity announcements;
- broad education/event promotion;
- important service-wide notices.

Do not use LINE OA as the default delivery mechanism for every member-specific transactional/operational notification.

### MSG-3 Channel separation

Business event/message intent and delivery channel remain separate concepts, but current channel policy is:

- personalized/operational member message → Member System Messaging by default;
- mass/broadcast announcement → LINE OA when approved/appropriate;
- other future channels (APP push, WeChat, email, etc.) require separate channel policy and do not automatically inherit LINE behavior.

A message may be intentionally published to more than one channel only when the communication policy explicitly requires it; avoid duplicate/noisy delivery by default.

### MSG-4 Message Center

Member-facing products should provide a clear **訊息中心** capable of showing at least:
- unread/read state;
- message category/type;
- title/summary/body or safe linked detail;
- created/published time;
- related safe business reference/deep link where applicable;
- expiry/archive behavior where applicable.

Sensitive business detail should be retrieved under authenticated authorization rather than copied unnecessarily into notification payloads.

### MSG-5 Broadcast governance

Large-scale announcements should support controlled audience and publication evidence where practical:
- announcement type;
- target audience/segment;
- content/version;
- scheduled/published time;
- publisher/approver where required;
- channel = LINE OA and/or Member System announcement;
- delivery/result evidence available from the channel.

Do not send member-private financial/account information through a mass-broadcast path.

### MSG-6 Operations integration

Operations Control Center may show:
- failed member-system message deliveries;
- unread/queued message health where operationally useful;
- LINE OA broadcast/provider failures separately.

Exception Center must distinguish Member Messaging failures from LINE OA/provider failures.

Task generation may be used for unresolved communication failures where human follow-up is required.

### MSG-7 Learning/Event integration

Learning and Event Center defaults:
- member-specific enrollment, registration, reminder, attendance or completion information → Member System Messaging;
- large public/member-wide event promotion or company announcement → LINE OA broadcast when approved.

This keeps LINE OA usage focused on mass communication while Member System remains the authoritative personalized communication experience.

### MSG-8 Existing LINE worker

Existing LINE/provider worker capabilities remain valid infrastructure and may continue to support approved LINE workloads.

This amendment changes the **product/channel policy**, not the reliability architecture.

Implementation must review existing event-to-LINE mappings and avoid automatically sending ordinary member-specific messages through LINE merely because a LINE handler exists.

### MSG-9 Privacy and audit

Member messages follow normal Member authentication/BOLA.

Broadcast targeting and publication actions require appropriate Admin authorization and audit.

Do not expose internal UUIDs, raw exception text, protected banking data or another member's information in either channel.

### MSG-10 Verification

Plan verification for:
- PERSONAL_OPERATIONAL_MESSAGE_DEFAULTS_TO_MEMBER_SYSTEM = PASS
- MASS_ANNOUNCEMENT_CAN_ROUTE_TO_LINE_OA = PASS
- PRIVATE_FINANCIAL_MESSAGE_NOT_BROADCAST = PASS
- MEMBER_MESSAGE_READ_UNREAD_STATE = PASS
- MEMBER_MESSAGE_AUTHORIZATION = PASS
- LINE_AND_MEMBER_FAILURES_DISTINGUISHABLE = PASS
- NO_UNINTENDED_DUPLICATE_CHANNEL_DELIVERY = PASS
- LEARNING_EVENT_CHANNEL_POLICY = PASS.

This amendment supersedes any earlier roadmap wording that could be read as requiring LINE delivery for ordinary member-specific notifications.
