# OpenAPI cancellation compatibility decision

Status: RESOLVED_WITH_BACKWARD_COMPATIBLE_RUNTIME; no baseline promotion or owner waiver required.

## Verified disposition

Legacy cancellation requests now receive a deterministic server-derived key from canonical subscription/date/reason/refund/ReturnCase inputs. Existing exact full-cancellation facts can replay without being rewritten. Explicit keys remain accepted and must match the immutable original command; cross-subscription or changed-command reuse fails closed. ReturnCase identity still deduplicates partial returns. A cancelled plan cannot receive a new cancellation fact through a fresh key.

Two real PostgreSQL regression tests first failed on the old code (duplicate legacy facts and cross-subscription key reuse), then passed after remediation. API build, legacy/explicit-header HTTP tests, pinned OpenAPI 1.32.1 governance with zero breaking findings, publisher tests, security preflight and full isolated API **138 suites / 942 tests** PASS; 162 baseline assertions, fresh 0→102 and cleanup PASS. A pre-existing security-preflight naming expectation was repaired by naming the unchanged Admin-path predicate; the regex and authorization behavior were not weakened.

The previous finding below is retained as diagnostic history, not an outstanding blocker.

The pinned oasdiff 1.32.1 comparison against the approved SwaggerHub baseline reports exactly one breaking finding:

- Operation: `adminCancelSubscription`
- Route: `POST /api/v1/admin/subscriptions/{id}/cancel`
- Change: newly required `Idempotency-Key` header
- Finding: `new-required-request-parameter`, fingerprint `5eb4ba911153`

This predates the warehouse API increment. The cancellation requirement protects previously completed refund/cancellation idempotency. It is represented accurately in both runtime and OpenAPI; removing the header from documentation while keeping the guard would be false compatibility evidence.

`governance/swaggerhub/policy.json` requires explicit recorded Code Owner authority for pre-GA breaking-change promotion and prohibits automatic waivers. No baseline, hash, diff severity or guard was weakened. New warehouse routes pass OpenAPI preflight and the pinned validator; full governance remains FAIL at this compatibility finding until an approved disposition exists.

That remediation is now implemented and verified as described above. The approved baseline and its hash remain unchanged. Full-batch Stage RC remains pending unrelated executable work.
