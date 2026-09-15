# Member API Integration Contract v0.1

## Security boundary
LIFF authenticates the Person. Backend maps LINE identity to Person and issues/validates the UCell member session. Every qualification-scoped request MUST authorize that the selected `qualificationId` belongs to the authenticated Person. Client-provided qualification ownership is never trusted.

## Context
`GET /api/v1/member/qualifications` returns only qualifications owned by the authenticated Person.

`GET /api/v1/member/dashboard?qualificationId=...` returns one qualification snapshot. No cross-qualification aggregation unless an endpoint explicitly declares Person scope.

## Required semantics
- Sponsor Tree and Binary Tree are separate endpoints and DTOs.
- PV, RPV, EPV are official Core values; frontend never derives them.
- Bonus amounts are official Award/Ledger values; frontend never derives them.
- Unknown/pending amount = `null`, not `0`.
- Award status follows `CALCULATED -> PENDING45D -> EFFECTIVE -> PAYABLE -> PAID` and reversal/clawback is append-only.
- API authorization is fail-closed on missing/invalid Person-Qualification relationship.

## MVP acceptance
1. LINE login can establish Person session.
2. Multi-qualification member can switch Ball context.
3. Dashboard changes without leaking another Ball's data.
4. Direct URL/API access to another Person's qualification returns 403/404 according to backend policy.
5. Pending awards never render as paid or zero.
