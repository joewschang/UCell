# A Decision safeguard validation

| Gate | Result |
| --- | --- |
| prisma-validate | PASS |
| prisma-migrate-deploy | PASS |
| backend-build | PASS |
| admin-build | PASS |
| api-tests | PASS |
| shared-golden-tests | PASS |
| admin-tests | PASS |
| backend-test-gate | FAIL |
| ci-gate | PASS |
| db-golden | FAIL |
| sa-db-regression | PASS |
| openapi-export | PASS |
| openapi-preflight | PASS |
| security-policy-preflight | PASS |
| security-http-e2e | FAIL |
| rc-gate | FAIL |
| release-prep | FAIL |
| release-gate | FAIL |
| full-admin-dev-build | PASS |
| uat-gate | FAIL |
| prisma-generate | PASS |
| a-decision-db-regression | PASS |

API: 16 suites, 27 actual tests PASS, original 148 TODO retained. A Decision isolated DB: 19 assertions PASS, fixtures rolled back.

FAIL reasons: DB Golden missing five required qualification fixtures; formal Security HTTP API3000 refused; test/RC/release gates blocked by original TODO and UAT evidence; UAT remains unexecuted. Complete entitlement replay assertions are not yet implemented.
