# Member session authentication checkpoint

`backend/apps/api/src/modules/auth/member-authentication.ts` verifies a server
session and its current LINE binding. The Nest adapter
`member-authentication.guard.ts` is registered/exported by `AuthModule`, but no
public Member controller or login exchange is introduced in this checkpoint.

## Request boundary

1. Remove any pre-existing `request.user` before asynchronous work starts.
2. Accept one bounded Bearer credential; do not read identity from body/query.
3. Delegate session validity, expiry and revocation to `IdentityTokenService`.
4. Require provider LINE, nonempty sessionId/subject/personId, and no admin role.
5. Resolve the current LINE identity link and require matching provider, subject
   and Person. A missing or changed binding fails closed; lookup failure never
   falls back to the session's Person.
6. Assign only sessionId, personId, provider and subject to the request principal.

The adapter maps binding-service failure to 503 and authentication rejection to
401. Session-service exceptions are currently sanitized to 401, consistent with
the existing service interface; it does not yet distinguish database outages
from invalid tokens. No provider/database details are exposed.

## Verification

Run from repository root using Node 24:

```sh
node --experimental-strip-types --test backend/scripts/member-authentication.test.mjs
```

Eight executable tests cover minimal principal output, malformed/duplicate
headers, service rejection, Admin providers/roles and missing Person, changed
bindings, lookup failure, asynchronous principal clearing, and revalidation on
the next request. These are dependency-injected unit tests. The expiry/revocation
case simulates rejection by the existing session service; it does not prove
database expiry or revocation behavior. Member CI runs these alongside the seven
LINE-verifier tests and 87 frontend tests.

## Integration still required

- Real Nest DI/bootstrap and database integration have not been exercised in this
  frontend checkout; its full backend dependencies are not installed. The CI
  core typecheck covers the dependency-free functions, not the Nest adapter.
- Future protected Member controllers must use this guard explicitly and perform
  QualificationAccessService ownership checks with the verified Person. Exporting
  a guard does not protect routes. This checkpoint makes no BOLA/IDOR claim.
- Session and identity reads are separate. Concurrent revocation/rebinding can
  happen after authentication; sensitive writes must enforce authorization and
  relevant binding/version checks within their transaction. No locking or
  revocation policy is defined here.
- Person eligibility, session issuance/TTL, exchange transport, memberNo and
  rank/ball mappings remain unresolved. No live login, binding, logout, order or
  payout route is enabled, and no R1.0B business rule is changed.
