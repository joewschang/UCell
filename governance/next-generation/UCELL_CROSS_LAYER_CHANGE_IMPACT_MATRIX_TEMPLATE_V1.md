# UCell Cross-Layer Change Impact Matrix Template v1.0

Status: MANDATORY TEMPLATE
Authority: UCELL_CROSS_LAYER_CHANGE_GOVERNANCE_RULE_V1

## Change header
- Change ID:
- Title:
- Request / decision:
- Requested by:
- Date:
- Baseline branch:
- START_HEAD:
- Business decision / SSOT refs:
- Affected domains:
- Risk class: LOW / MEDIUM / HIGH / CRITICAL
- Effective date / as-of:
- Deployment scope: LOCAL / STAGE / PRODUCTION / NONE
- Rollback or forward-fix policy:

## Nine-layer impact matrix

| Layer | Status | Affected artifacts | Required action | Evidence / commit | Owner / reason if deferred |
|---|---|---|---|---|---|
| 1. Business /制度 Definition |  |  |  |  |  |
| 2. Semantic & Governance Core |  |  |  |  |  |
| 3. AI Brain Core |  |  |  |  |  |
| 4. API / OpenAPI |  |  |  |  |  |
| 5. DB / Migration / Data Dictionary |  |  |  |  |  |
| 6. Runtime Code |  |  |  |  |  |
| 7. Tests / Golden / Security |  |  |  |  |  |
| 8. GitHub Technical SSOT |  |  |  |  |  |
| 9. Google Drive Formal Documents |  |  |  |  |  |

Allowed status only:
UPDATED
VERIFIED_NO_CHANGE
NOT_APPLICABLE
DEFERRED_WITH_OWNER_AND_REASON
DECISION_REQUIRED

No blank layer at closure.

## Semantic impact checklist
- Business Terms:
- Entities:
- Facts:
- Relationships:
- Dimensions:
- Metrics:
- Datasets:
- Rules:
- Scopes:
- Privacy:
- Truth Source:
- Lineage:
- Certification:
- Golden:
- Historical/as-of impact:
- Authority conflict:

## AI Brain impact checklist
- Glossary / terminology:
- Approved knowledge sources:
- Tool/API contract:
- Metric/Dataset availability:
- RBAC / scope:
- Privacy / PII:
- Data firewall:
- Prompt-injection handling:
- Explain/evidence:
- Historical/as-of:
- Write capability:
- Model/runtime configuration:
- AI tests:

## API checklist
- Endpoint/path:
- Request:
- Response:
- DTO:
- enum/status:
- error contract:
- idempotency:
- authentication:
- authorization/BOLA:
- privacy:
- OpenAPI regenerated:
- compatibility:

## DB checklist
- Schema:
- enum:
- constraints:
- indexes:
- migration:
- seeds:
- projection/view:
- historical evidence:
- retention:
- data dictionary:
- fresh 0→current:
- DB Golden:

## Runtime checklist
- Backend:
- Worker:
- Admin:
- Member:
- Shared:
- Background/scheduled jobs:
- Integration adapters:
- Feature flags/config:
- Observability/audit:

## Security / Golden checklist
- Focused tests:
- E2E:
- R1.0B Economic Golden:
- Semantic Golden:
- Return/Replay:
- Settlement/Payout:
- P0 Privacy:
- LINE Security:
- BOLA/IDOR:
- Bootstrap #1–#3:
- Reservoir:
- C3/PII:
- OpenAPI:
- Full regression:

## GitHub checklist
- Governance SSOT:
- Implementation status:
- Data dictionary:
- OpenAPI artifact:
- Catalog/lineage:
- Closure report:
- Pass/fail matrix:
- Commits:
- FINAL_HEAD:

## Google Drive impact checklist
For each formal Drive file, state UPDATED or VERIFIED_NO_CHANGE or DEFERRED_WITH_OWNER_AND_REASON.

- UCell_V4_0_制度與獎金海報文案_正式版.docx
- UCell_V4_0_制度與獎金計算說明手冊_正式版.docx
- UCell_V4_0_創始合夥人招募計畫_正式版.docx
- UCell_V4_0_獎金引擎與資料庫規格書_正式版.docx
- Other affected SOP/training/specification:
- Drive version/date/change summary:
- Drive verification evidence:

## Closure
- START_HEAD:
- FINAL_HEAD:
- Migration count:
- OpenAPI paths / operations / schemas / hash:
- Focused tests:
- Full tests:
- Known limitations:
- DECISION_REQUIRED:
- Deferred work:
- Drive sync:
- Deployment performed:
- Overall closure status:
  - FULLY_SYNCHRONIZED
  - CODE_CLOSED_DRIVE_SYNC_PENDING
  - PARTIAL
  - BLOCKED

## Final self-review
Any YES blocks FULLY_SYNCHRONIZED:
- Meaning changed without semantic versioning?
- Core changed without AI Brain assessment?
- API behavior changed without OpenAPI assessment?
- DB changed without dictionary/migration/Golden?
- UI security relies only on hiding?
- Historical truth reconstructed from current state?
- Old/non-R1.0B rule introduced?
- Member bootstrap #1–#3 leakage?
- Reservoir leakage?
- Unauthorized PII/C3 exposure?
- GitHub/Drive divergence unresolved?
- Any of nine layers blank?
