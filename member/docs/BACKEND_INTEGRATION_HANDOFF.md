# Member integration handoff — verified implementation gap

Backend inspected: `rc1-recovered` at `df13581ca2b14687a5e36e3a0abb7d8bb1989b7f`.
Frontend implementation checkpoint: `3cb85a6d366add26255c401375ba6d2bfe03caea`.
This is an engineering handoff, not authorization to publish, a finalized auth
contract, or a change to R1.0B. Do not mark demo/frontend checks as live integration.

Member-branch additions since that inspection: isolated LINE token verification
and [Member session/binding authentication](MEMBER_AUTHENTICATION_CORE.md).
The latter exports a Nest guard but does not add/protect a Member controller yet.
Its eight core tests do not substitute for Nest/DB or BOLA integration gates.

## Verified reusable components and limits

Paths below are relative to `backend/apps/api/src/` at the inspected commit.

| Component | Observed behavior | Integration consequence |
|---|---|---|
| modules/auth/line-identity.service.ts | Looks up identityLink by LINE subject; only checks subject is nonempty | This is a binding lookup, not a LINE token verifier. A client-supplied subject must never be treated as verified identity. |
| modules/auth/identity-token.service.ts | Issues random opaque bearer tokens, stores their SHA-256 hash; checks ACTIVE status and expiry; returns personId/provider/role | Reuse is possible after verified identity mapping; a Member guard must require an appropriate member identity and personId, not merely a valid arbitrary session. |
| modules/auth/qualification-access.service.ts | Checks holder history with effectiveFrom <= at and effectiveTo > at or null; denies absent holder | Use server-derived Person identity for each scoped request. Never trust bundle/client ownership. Historical display authorization needs an explicit policy, separate from historical reward recipients. |
| modules/auth/auth.module.ts | Registers only AdminAuthController | No member session-exchange controller is wired here. |
| modules/auth/admin-auth.controller.ts | Entra exchange, admin me and logout under auth/admin | These routes are not Member/LINE APIs and must not be used as a shortcut. |
| app.module.ts + modules/auth/admin-authentication.guard.ts + modules/auth/admin-role.guard.ts | Global admin guards return true for paths outside /admin | A new /member controller must explicitly install member authentication and ownership protection; global guard registration alone provides no member protection. |

## Implementation sequence and acceptance evidence

1. **Member authentication:** finalize the exchange URL, request/response DTO,
   session transport, expiry/revocation and unbound-identity behavior with the
   backend owner. Implement server LINE token verification for the configured
   channel before resolving the identity link. Never accept personId, LINE subject
   or role from the browser as proof of identity. Do not auto-bind an account using
   a display name or email. Explicit member guards must cover every member route.
   Tests: invalid/expired/wrong-channel credentials, missing binding, revoked or
   expired session, admin session supplied to member routes, and missing personId.
   Exact verifier mechanics and production LINE configuration remain pending.

2. **First real vertical slice:** implement authenticated `GET /member/me` and
   `/member/qualifications`, returning the existing `{data, meta}` envelope and
   agreed DTOs. Derive Person from the verified server session. Return only owned
   qualifications. Tests must use two synthetic Persons with multiple balls and
   prove that user B cannot access user A's profile/qualification through input
   tampering. Do not expose an unrestricted Person lookup through member routes.

3. **Scoped reads:** implement the remaining eight reads in `CONTRACT_RUNNER.md`.
   Check ownership before reading or returning data on every request. Echo the
   selected ball and query month. Preserve separate Sponsor/Binary relationships,
   pending/null values, and immutable ledger history. Do not recreate economic
   calculations in adapters. Finalize paging/limits and display-money serialization
   before real data volumes are accepted. Tests: foreign/nonexistent ball, wrong
   month, revoked session, owned empty result, unknown amount and negative adjustment.

4. **Frontend connection:** replace the deliberate pending stop in `src/liff.ts`
   only after the exchange contract and server tests exist. Keep tokens out of
   URLs/logs and preserve the existing 401/403/timeout/cancellation boundaries.
   Exercise real HTTP responses through the existing view validators. Then run
   actual-device LIFF login, ball switch, refresh, session expiry and logout UAT.
   Session persistence and server logout behavior must be agreed, not inferred from
   the current prototype's cached bearer support or local-page end action.

5. **Writes separately:** order quote/create/detail and idempotency/reconciliation,
   profile changes, notifications/acknowledgment and LINE push remain separate
   integration work. Keep demo actions clearly labeled until corresponding server
   contracts exist. A successful request abort is not proof that a write failed.

## Evidence to return from the backend implementation

- Backend commit SHA and OpenAPI route/DTO definitions, with explicit member guards.
- Server verification/ownership regression and database assertion results, with
  synthetic identities; never attach live tokens or member data.
- A ten-response synthetic bundle produced by backend adapters, validated using
  `MEMBER_CONTRACT_FILE=/path/to/bundle.json corepack pnpm run test:contract`.
- Staging base URL and configuration variable names. Provision secrets separately;
  do not put them in source control or this document.
- Live integration and real-device results, kept distinct from frontend CI.

## Current release assessment

Frontend CI for `3cb85a6d` passed 87 tests, build and normal browser smoke
(run `35005058000`). That run used the synthetic contract baseline. No backend
generated bundle, real LINE session, member authorization proof or real-device
UAT was obtained in this review. Production remains blocked.

This review changes documentation only. It does not change admin guards, add
unguarded member routes, migrate the database, merge main, or promote a release.
