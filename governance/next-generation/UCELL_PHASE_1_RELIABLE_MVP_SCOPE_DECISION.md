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
