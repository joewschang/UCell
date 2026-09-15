# LINE server verifier core — isolated implementation

Implemented in `backend/apps/api/src/modules/auth/line-token-verifier.ts`.
This is server-only code, not imported into the frontend bundle. It is not yet
registered as a Nest service/controller and does not enable real login.

Reference: [LINE Verify ID token](https://developers.line.biz/en/reference/line-login/#verify-id-token)
and [LIFF user data on servers](https://developers.line.biz/en/docs/liff/using-user-profile/).
The verifier posts a form containing id_token and the server's channel ID to the
fixed LINE verification endpoint, rejects redirects and checks successful claims.
It returns only subject and expiry. No JWT is decoded and trusted locally.

Engineering policy in this implementation: numeric configured channel ID, maximum
16 KiB input token, 8-second request deadline, exact issuer/audience, unexpired
integer expiry, nonfuture integer issued-at and nonempty subject. No clock tolerance
is currently applied; server time must be synchronized. If authorization used a
nonce, pass its expected value from server-owned state, never from the token or an
untrusted client echo. Missing nonce challenge management is not solved here.

No automatic retry, fallback profile, raw-token persistence or error payload
logging. Token rejection and unavailable provider errors are sanitized. The future
controller must map internal failures to reviewed HTTP statuses, rate-limit the
exchange and keep credentials out of logging/URLs. This core does not issue a
session, create an identity link, authorize a Person or grant access to a ball.

Validation: seven Node 24 tests use injected synthetic HTTP responses, including
provider errors, invalid claims, nonce mismatch and timeout. No requests were sent
to LINE. Standalone verifier typecheck and these tests are included in Member CI;
they do not replace the complete Nest build, server HTTP or database gates.

Next integration requirements:

- Nest wrapper/controller plus Member guard and reviewed exchange transport.
- Verified subject -> existing identity link -> eligible Person -> member session.
- Finalize profile memberNo: current Person schema has personId but no memberNo.
- Finalize displayed qualification rank/ball label: planLevelCode is not assumed
  to be the official displayed rank, and enumeration is not an approved ball label.
- Confirm Person status eligibility, session lifetime, binding/rebinding/revocation
  policy and live LINE channel configuration without inventing business rules.
- Implement authenticated me/qualifications adapters and real-device UAT.

Full backend dependencies are absent in this frontend checkout; no complete
backend build/DB validation is claimed. Existing routes, schemas, backend package
versions and R1.0B monetary rules remain unchanged. No production promotion.
