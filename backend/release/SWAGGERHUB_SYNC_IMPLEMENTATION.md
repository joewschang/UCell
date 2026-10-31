# SwaggerHub documentation and application release

User-authorized change, 2026-10-31: SwaggerHub cloud documentation publication is independent of production promotion.

Required: OPENAPI_CONTRACT_GATES_PASS. RC retrieves the same-commit/default-branch verify job's gated specification and gates.json, validates all existing contract/security gates and commit/baseline/artifact hashes. Failed or pending publish jobs do not invalidate a successful verify job. Missing/failed verification still blocks promotion.

Advisory for application release: SWAGGERHUB_SYNC_PASS. The publish job still fails on missing credentials or cloud verification errors; its receipt, failure artifacts and job warning are retained. Re-run the failed publish job to repair documentation. Do not make the publish job a required branch protection check.

No UAT, security, database, backup or human-approval requirements were removed. The release-check command remains a strict SwaggerHub documentation receipt check; contract-check is the independent application gate.
