# Member view adapter contract v0.3 — DRAFT, backend approval required

This is a frontend integration proposal, not a change to R1.0B or a claim
that backend endpoints exist. The baseline checked was 461de2b. The backend
team must confirm DTOs, auth/session exchange, pagination and scoping before
real mode is enabled. Do not adapt admin endpoints by bypassing authorization.

Canonical TypeScript DTOs: `src/api.ts`; request mapping: `src/memberData.ts`.

| GET /api/v1/member/ | Scope | Response |
| --- | --- | --- |
| qualifications | authenticated Person | Qualification[] |
| me | authenticated Person | Person |
| dashboard | qualificationId | Dashboard (qualification.id must match) |
| organization/sponsor | qualificationId | Organization; sponsor + masked direct referrals |
| organization/binary | qualificationId | Binary; distinct left/right counts and volume |
| performance | qualificationId, period | Performance |
| bonuses | qualificationId, period | Bonus |
| bonuses/ledger | qualificationId, period | Ledger |
| products | Person session | Product[] |
| orders | qualificationId | Orders |

Other scoped response objects must echo `qualificationId`. Month-filtered responses
must echo `period` (YYYY-MM). A month is only a UI query filter, NOT an operational
settlement calendar or EPV timezone decision. Server owns recognition/cut-off and
all economic calculations. `asOf` is a server timestamp, null when unavailable.
No sums, PV derivations, pool allocations or monetary posting occur in the client.
Null means unavailable/pending. Legitimate server zero remains zero.

The combined sponsor/referrals DTO is provisional; split into the original
`/referrals` endpoint when the backend finalizes that contract. Order scoping must
also be confirmed; it must not silently mix orders from different balls.
Currency is NTD in these display DTOs. Backend decimal/money serialization and
precision are pending alignment; no payment write should use these display values.

## Authentication gate
Real mode requires explicit VITE_LIFF_ID. Missing configuration, SDK failure or
login redirect never opens the member provider. A successful LINE SDK login is
not a UCell session. Until an approved backend session-exchange contract exists,
real mode stops with a visible integration-pending message. No raw LINE ID token
is persisted; the old prototype's raw-token storage key is removed on startup.
The API client's inherited bearer-session support is not proof of a login contract.
Backend must verify issuer/audience/expiry and map LINE identity to Person.
Server must independently authorize each qualification and order on every request.
Client ownership/response checks are defense in depth, NOT BOLA/IDOR security proof.

## Remaining integration work
- Session exchange, expiry, logout and member binding.
- Server-side BOLA/IDOR tests using two real Persons and multiple qualifications.
- Order quote/create/detail, inventory acceptance, shipping address and idempotency.
- Profile edits, notifications and repurchase actions.
- Pagination/limits, runtime response schema validation and production money types.
- LIFF endpoint URL/HTTPS hosting, browser refresh rewrites and real-device UAT.
- Full product assets: three referenced images were absent from this workspace.

Existing backend 148 TODO/release gates are untouched. Production remains blocked.
