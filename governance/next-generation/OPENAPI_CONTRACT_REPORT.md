# OpenAPI contract report

PASS against START_HEAD 26fa675da0132646484b4a8806a8d5ab55e0e6f6. Generated SSOT: backend/openapi.generated.json.

174 operations; all original 167 retained, 7 additions (Reservoir Center and six period projection/export routes). Swagger generation, @apidevtools/swagger-parser validation, repository OpenAPI preflight and structural operation/security/parameter/schema comparison pass. See evidence/openapi-contract-diff.json and final-validation.json.

Controllers/DTOs document metrics, time/asOf, dimensions/filters, snapshot/cursor, stale status, definition versions, classification, evidence and standard success/error envelopes. Fixed AnalyticsQuery adapters reject unsupported scopes/SQL and malformed settlement scope with 422. RBAC/BOLA, revocation, idempotency/conflict, snapshot mismatch and native CSV streaming are covered by real DB/HTTP tests. DTO/UUID syntax validation may return 400 as documented; domain validation returns 422.

Structural comparison does not prove business semantics. Tree/report clients must retain the first-page snapshot token for subsequent pages; actual concurrent late-commit tests verify fixed visibility. No browser recursive calculation or all-page export is introduced.

Against older Stage-tagged source 22595798d30dee1af80aeb832c0d36cede8f5175 (134 operations), the raw detector retains one FAIL: GET /api/v1/member/organization/binary operationId MemberController_binary → memberBinaryOrganization. It already exists at START_HEAD; this round retains it. URL/method unchanged; old generated SDK callers need the renamed method. See evidence/openapi-stage-source-diff.json. This does not represent a regression from the required 167-operation baseline.

Swagger: DEV enabled, Stage script prepared enabled for approved UAT, Production default disabled. SwaggerHub is documentation publishing and remains EXTERNAL_TOOL_PENDING until API target is confirmed; it is not API SSOT or a Core development blocker. No publishing project was invented. Stage STOP; Production BLOCKED.
