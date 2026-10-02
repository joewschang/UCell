# UCell Cross-Layer Change Governance Rule v1.0

**Status:** APPROVED / MANDATORY
**Date:** 2026-09-25 (Asia/Taipei)
**Applies to:** every new feature, rule change, bug fix with business meaning, security/privacy change, data-model change, integration change, report/metric change, AI capability change, and deprecation in UCell.

## 1. Core principle

No material UCell change is considered complete merely because code works.

Every change MUST perform an explicit impact analysis across these governed layers:

1. Business /制度 / Product Definition
2. Semantic & Governance Core
3. AI Brain Core / AI knowledge, tools, policies and safe capabilities
4. API / OpenAPI / integration contracts
5. Database / migrations / data dictionary / projections
6. Runtime code: Backend / Worker / Admin / Member / Shared
7. Tests / Golden / security / privacy / replay / regression
8. GitHub technical SSOT / governance evidence
9. Google Drive formal business / operating / specification documents

For each layer the change record MUST state exactly one:
- UPDATED
- VERIFIED_NO_CHANGE
- NOT_APPLICABLE
- DEFERRED_WITH_OWNER_AND_REASON
- DECISION_REQUIRED

Silence is not an acceptable status.

## 2. Change Impact Analysis — required before implementation

Before coding, create or update a Change Impact Matrix containing:
changeId, title, requestedBy, baselineHead, businessDecisionRef, affectedDomains, riskClass, effectiveDate if applicable, rollback/forward-fix policy, and the nine layer statuses.

The analysis MUST ask:
- Does terminology/definition change?
- Does a Business Term, Entity, Fact, Relationship, Dimension, Metric, Dataset, Rule, Scope, Privacy class, Truth Source, Lineage, Certification or Golden change?
- Does AI Brain need new/changed knowledge, tool contract, prompt/policy, RBAC, firewall or explanation behavior?
- Does any API request/response/status/error/idempotency/security contract change?
- Does schema, enum, index, constraint, migration, projection, seed, retention or data dictionary change?
- Which Backend/Worker/Admin/Member/Shared components change?
- Which focused/full/Golden/security tests change?
- Which GitHub SSOT/status/catalog/report must change?
- Which Google Drive formal documents are affected?

## 3. Semantic Core rule

A business change that affects meaning MUST update Semantic Core before or with runtime closure.

Never silently change an existing certified metric/fact/rule meaning.
Breaking semantic meaning requires version/effective dating and impact analysis.
Historical truth remains bound to historical versions/evidence.
If a semantic source conflicts with runtime/SSOT, create an Authority Conflict and block certification.

## 4. AI Brain Core rule

AI Brain is a governed consumer/orchestrator, never an independent business truth.

Every change MUST assess:
- business glossary / terminology;
- approved knowledge/source references;
- tool/API contracts;
- available Metrics/Datasets;
- privacy/RBAC/scope;
- prompt-injection/data-firewall policy;
- explanation/evidence behavior;
- historical/as-of semantics;
- write capability impact.

AI Brain MUST NOT learn a new business rule merely from conversational text or an unapproved document. New authoritative behavior requires approved source/version.

No new runtime write tool is authorized merely because a backend mutation API exists.

## 5. API rule

If behavior/data changes, verify OpenAPI impact even when endpoint paths do not change.
Regenerate/validate/diff when applicable.
Document compatibility, versioning, error/status/idempotency and security effects.
No hidden breaking change.

## 6. DB rule

Forward-only migrations.
Do not rewrite historical migrations.
Update schema constraints/indexes/enums/seeds/projections/data dictionary as applicable.
Historical economic evidence must remain reproducible.
No float for money.
No current-state rewrite of historical facts.
Run fresh 0→current and DB Golden where applicable.

## 7. Runtime code rule

Audit all affected surfaces:
Backend, Worker, Admin, Member, Shared, scheduled/background jobs, integrations.
Server-side policy is authoritative; UI hiding is never a security control.
Human-readable memberNo/ballNo remain operational identifiers; UUID remains internal unless explicitly required.

## 8. Test / Golden rule

A change is incomplete without tests proportional to impact.
Consider:
focused unit/integration/E2E, DB Golden, R1.0B Economic Golden, Semantic Golden, Return/Replay, Settlement/Payout, P0 Privacy, LINE Security, BOLA/IDOR, OpenAPI, full regression.
Existing Golden results must remain unchanged unless an approved decision explicitly changes them; changed fixtures/results require documented disposition.

## 9. GitHub rule

GitHub is the technical/versioned SSOT.
Update affected:
governance specs, catalogs, data dictionaries, OpenAPI artifacts, implementation status, closure report, pass/fail matrix, source authority/lineage evidence.
Commits must make the governance/code relationship traceable.

## 10. Google Drive rule

Google Drive is the formal business/document distribution surface and MUST be assessed at closure.

Affected formal documents may include:
- 制度與獎金計算說明
- 制度/獎金海報文案
- 創始合夥人/招募資料
- 獎金引擎與資料庫規格
- operational manuals, SOPs, training, reporting/data definitions and future AI/ERP specifications.

Do not overwrite a Drive document blindly.
Before sync:
1. identify the authoritative affected Drive file/version;
2. compare the approved GitHub/runtime change;
3. update only affected sections while preserving unrelated approved content;
4. record document version/date/change summary;
5. verify terminology and numeric consistency;
6. confirm Drive update success.

If Drive access/update is unavailable at closure, status MUST be DEFERRED_WITH_OWNER_AND_REASON, never silently considered synchronized.

## 11. Security / privacy invariants

Every change rechecks:
- Member zero-disclosure for Reservoir;
- bootstrap positions 1–3 hidden from Member;
- non-authorized holder PII not exposed;
- C3 restricted data;
- secrets/tokens/bank/identity data not leaked;
- RBAC/BOLA;
- historical evidence;
- audit;
- exports do not exceed interactive permission;
- AI does not gain data/write access implicitly.

## 12. Closure gate

Before declaring COMPLETE, produce Cross-Layer Closure Matrix:

Definition
Semantic Core
AI Brain Core
API/OpenAPI
DB/Data Dictionary
Runtime Code
Tests/Golden/Security
GitHub
Google Drive

Each must have an explicit disposition.

Closure report also records:
START_HEAD
FINAL_HEAD
migrations
OpenAPI counts/hash when applicable
test results
known limitations
DECISION_REQUIRED
deferred work with owner/reason
Drive files updated/versioned
deployment status.

A change cannot be called fully synchronized if Google Drive is still pending; it may be called CODE_CLOSED / DRIVE_SYNC_PENDING with explicit status.

## 13. Deployment sequencing

Default:
Decision → Impact Analysis → Definition/Semantic design → Runtime implementation → Tests/Golden → GitHub closure → Stage → UAT → Production approval → Google Drive final publication/sync as appropriate.

For documents that must govern implementation, publish/update the approved governing source before coding.
For documents that describe delivered behavior, synchronize after implementation evidence is final.
Never let a draft Drive document override approved GitHub/runtime authority.

## 14. Codex mandatory instruction header

Every future Codex work package MUST include:

"Apply UCELL_CROSS_LAYER_CHANGE_GOVERNANCE_RULE_V1. Before implementation create/update the Cross-Layer Impact Matrix. Before closure explicitly disposition Definition, Semantic Core, AI Brain Core, API/OpenAPI, DB/Data Dictionary, Runtime Code, Tests/Golden/Security, GitHub and Google Drive. Do not declare COMPLETE with an unreported layer. Do not modify Google Drive unless the task/tooling explicitly authorizes it; otherwise mark DRIVE_SYNC_PENDING and identify exact affected documents."

## 15. Self-review

Before closure ask:
- Did we change meaning without semantic versioning?
- Did we change Core but forget AI Brain?
- Did we change API behavior without OpenAPI review?
- Did we change DB without dictionary/migration/Golden?
- Did UI change without server security?
- Did GitHub and formal Drive docs diverge?
- Did any old R1.0B rule return?
- Did any historical result get rewritten using current state?
- Did any Member surface expose bootstrap/Reservoir/PII?
- Did we call something COMPLETE while any affected layer is silent?

Any YES blocks full closure.
