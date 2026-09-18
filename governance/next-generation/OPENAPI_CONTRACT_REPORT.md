# OpenAPI contract report — working checkpoint

Status: schema and structural compatibility PASS; full API contract closure IN_PROGRESS.

Baseline: 26fa675da0132646484b4a8806a8d5ab55e0e6f6. Generated artifact: backend/openapi.generated.json.

- Baseline operations: 167; current generated operations: 174.
- Original operations retained; 7 additions: Reservoir Center read and 6 period projection/export operations.
- Swagger-generated document validated with @apidevtools/swagger-parser 13.0.0.
- Existing OpenAPI preflight PASS.
- Structural operation/security/parameter/schema compatibility comparison: no detected breaking changes.
- Exact machine evidence: evidence/openapi-contract-diff.json.
- Reproduce from backend: node scripts/openapi-closure-contract.mjs 26fa675da0132646484b4a8806a8d5ab55e0e6f6.

The detector cannot prove business-semantic compatibility. Subsequent tree pages require the first-page snapshotToken; clients must retain that identity. This intentional pagination contract must be documented and covered by HTTP tests. Complete success/error response schemas, API RBAC/BOLA/error contract tests and final regeneration remain required before closure.

SwaggerHub: EXTERNAL_TOOL_PENDING, target unconfirmed; no project created/uploaded. Stage STOP; Production BLOCKED.

## Stage-source compatibility review

The deployed source tag resolves to 22595798d30dee1af80aeb832c0d36cede8f5175, 134 operations; current working artifact has 174. A separate diff reports one operationId change: GET /api/v1/member/organization/binary, MemberController_binary → memberBinaryOrganization. This already exists at START_HEAD and is unchanged in this round. URL and HTTP method remain; generated SDK operation names must be regenerated/migrated at Stage upgrade. Evidence: evidence/openapi-stage-source-diff.json. The raw detector result is retained as FAIL for this old-source comparison rather than silently suppressed.

Against START_HEAD, all 167 operations remain structurally compatible and 7 operations are added. New Reservoir schema detail and Analytics supported-metric/UUID documentation are prepared; final regeneration and validation remain pending.
