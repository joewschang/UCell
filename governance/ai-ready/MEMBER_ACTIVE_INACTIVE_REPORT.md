# Member Active below-threshold explanation

Status: IMPLEMENTED, not deployed. Starting baseline: 84032c6.

## Power-loss recovery

The isolated checkout C:/UCell/ux-v2-phase1 was clean at 330162b after restart. The prior Member Explain implementation was committed and intact. Upstream 84032c6 (worker graceful shutdown) was reviewed and fast-forwarded before development. The original C:/UCell/UCell checkout was not modified.

## Behavior

GET /api/v1/member/explain/active now also returns active=false, ownerType=MEMBER, reasonCode=BELOW_THRESHOLD when supported by original current-month evidence. Existing positive Active and sealed Carry behavior is preserved.

The negative branch requires no ActiveIntervalEvidence in the Taipei calendar month, no replayed monthly accumulator, and no current ActivePeriod. It selects the latest persisted accumulator by sequenceNo, not creation time. That accumulator must use R1.0B and the existing 2,000 threshold, have thresholdCrossed=false, and contain a nonnegative cumulativeAfter strictly below its stored threshold. A false crossing flag alone never establishes inactivity.

The linked original consumption recognition must agree on Ball, month, rule and eligible delta, have a parameter hash, and be recognized no later than the request time. Future recorded evidence, reversal/correction records in the month, replay, mismatched scope and conflicting current ActivePeriod are unavailable. Original accumulator and recognition hashes are verified. A genuine zero accumulator from excluded consumption is supported; missing accumulation is never converted into zero.

This adapter compares stored Decimal values; it does not sum transactions, recalculate threshold crossing, change Core economics, or assert that it replayed the full accumulation chain. The response references its accumulator and recognition evidence and uses accumulator.recordedAt as updatedAt. Hash checks establish stored evidence consistency, not an independently reproduced economic calculation.

Existing Member authentication, selected Ball ownership rechecks, transaction boundaries, metadata-only audit, no-store and failure suppression remain in effect. OpenAPI and the shared catalog describe both supported outcomes. Missing/unsupported evidence returns 422 HISTORICAL_UNAVAILABLE; hash mismatches return 503 INVALID_EVIDENCE.

## Verification

- Member Explain HTTP integration: 37/37 PASS (15 new cases).
- Adjacent Member Binary read model: 9/9 PASS; combined targeted run 46/46.
- Shared regression: 68/68 PASS.
- Full backend build: PASS.
- OpenAPI export, OpenAPI preflight, security policy preflight and TODO gate: PASS.
- HTTP tests execute real Nest routes/DTO validation/guards/gateway/service/source with mocked Prisma and identity dependencies. No live database fixture or deployed endpoint test is claimed.

## Remaining boundaries

This report supersedes the positive-only Active limitation in MEMBER_EXPLAIN_ADAPTER_REPORT.md. Replay-aware Active, Company ownership/Always Active integration, tree-scoped Carry and Reservoir B adapters remain future work. No schema, migration, provider connection, frontend or Stage/Production deployment was changed. Company bootstrap D1 and remaining D2 decisions stay pending; the approved Company Ball operating-unit and referral-order decision is unchanged. Production remains BLOCKED.
