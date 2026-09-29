# OpenAPI cancellation compatibility decision

Status: COMPATIBILITY_REMEDIATION_PENDING; does not block other local implementation. Baseline promotion, if ultimately needed, requires Code Owner approval.

The pinned oasdiff 1.32.1 comparison against the approved SwaggerHub baseline reports exactly one breaking finding:

- Operation: `adminCancelSubscription`
- Route: `POST /api/v1/admin/subscriptions/{id}/cancel`
- Change: newly required `Idempotency-Key` header
- Finding: `new-required-request-parameter`, fingerprint `5eb4ba911153`

This predates the warehouse API increment. The cancellation requirement protects previously completed refund/cancellation idempotency. It is represented accurately in both runtime and OpenAPI; removing the header from documentation while keeping the guard would be false compatibility evidence.

`governance/swaggerhub/policy.json` requires explicit recorded Code Owner authority for pre-GA breaking-change promotion and prohibits automatic waivers. No baseline, hash, diff severity or guard was weakened. New warehouse routes pass OpenAPI preflight and the pinned validator; full governance remains FAIL at this compatibility finding until an approved disposition exists.

Next executable work: test whether deterministic server-derived identity for legacy requests plus existing ReturnCase natural keys can retain safe repeat/partial-return semantics without making a new header mandatory. A proven compatible protocol needs no baseline waiver. If that cannot be made safe, request explicit Code Owner promotion with client migration evidence. The existing guard stays in place meanwhile. Stage RC cannot be marked ready on this failed gate.
