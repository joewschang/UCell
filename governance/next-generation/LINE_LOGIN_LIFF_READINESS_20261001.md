# LINE Login / LIFF Stage readiness — 2026-10-01

Scope: append to the existing Stage / LINE Master Task in `C:/UCell/next-generation-recovered`, branch `integration/member-backend-mvp`. No new project, reset, clean, checkout replacement, deployment or secret creation. Concurrent recognition/member-message work is preserved. The other Master chat was informed of this scope and file ownership.

## Audit outcome

| Area | Existing behavior / bounded change |
|---|---|
| LINE Login / LIFF | Existing `@line/liff` SDK (resolved 2.31.0), `liff.init/login/getIDToken`, API exchange and Member session are retained. New Login channel must be created in the company Provider. |
| Callback / OAuth / OIDC | No custom authorization-code callback. SDK external login generates state and S256 PKCE; temporary code verifier is used for exchange. UCell does not invent or bypass this handshake. Changed application order so SDK initialization completes before referral processing/history mutation; external return is fixed to Member origin `/`, internal destination retained. SDK rejection prevents application API calls/session creation. |
| Nonce | Current SDK integration does not issue an application-owned nonce; no claim of server nonce checking for this flow. Generic backend verifier supports a server-owned expected nonce and its positive/negative tests remain passing. A future custom OAuth callback must persist/consume and verify state, browser binding and nonce; accepting frontend expectedNonce is forbidden. |
| Token / identity | Official server verify endpoint, configured Login audience, issuer, subject and time validation; only verified subject resolves ACTIVE IdentityLink. Person EFFECTIVE/NORMAL and session replay/expiry/revocation checks retained. Display name and client member_id are not proof. |
| Existing-member binding | Existing company-reviewed request + authorized approval + 30-minute one-use hashed completion proof + same verified LINE subject retained. Added frontend request/completion forms only for server-confirmed LINE_ACCOUNT_UNBOUND. Request retries keep the idempotency key. No raw ID token or completion proof is persisted by new frontend code; only returned opaque Member session is stored. |
| Actual backend security gap | Completion previously checked securityStatus but not current Person status. It now rejects a Person no longer EFFECTIVE even if approval was issued earlier. No schema/API contract change. |
| Rebind / unbind | Existing controlled Admin routes and account recovery retained: security lock, separate approval, short-lived one-use token, occupied-subject rejection, cooldown, audit, old-session revocation. Rebind approve/complete are internal services only (no HTTP controller); do not claim an end-to-end self-service rebind journey. Requests to rebind remain denied/referred to support. No public arbitrary reassignment endpoint added. |
| Stage configuration | Existing API LINE_LOGIN_CHANNEL_ID + Member build-time VITE_LIFF_ID retained. No new Login secret dependency or Worker config. Stage/Production remain separate deployment configuration. |
| Messaging webhook | User-confirmed DONE: https://api-stage.ucell.life/api/v1/integrations/line/webhook; Verify SUCCESS, Use webhook ON. No webhook source/config changed. Historical status text remains an audit record; NEXT ACTIONS explicitly supersedes its old manual gate. |

## Changed files

- `member/src/liff.ts`: initialization ordering, fixed SDK redirect, typed unbound-identity state.
- `member/src/main.tsx`: opens the binding flow only for that state.
- `member/src/lineBinding.ts`, `LineBindingPage.tsx`, `line-binding.css`: existing binding API integration, approval completion, responsive form.
- `backend/apps/api/src/modules/auth/existing-member-line-link.service.ts`: recheck EFFECTIVE at completion.
- Focused frontend auth/binding tests and existing backend binding tests.
- `deployment/LINE_STAGE_MANUAL_GATE.md`: replaces obsolete webhook setup with precise Login/LIFF human gate, scopes, Callback vs Endpoint distinction, API/Member/Worker mapping, secret non-requirement, Production separation and UAT.
- `STAGE_RECOVERY_LINE_UAT_20261001.md`: NEXT ACTIONS ONLY updated; previous evidence preserved.

## Validation

- Member **36 files / 192 tests PASS**: `C:/UCell/logs/stage-login-member-20261001.log`. Includes SDK failure before URL mutations, fixed return URL, unbound-only branch, no token/no request, rejected completions, server-session-only persistence, retry idempotency, approval gating and successful completion transition.
- Member TypeScript + production build **PASS**: `C:/UCell/logs/stage-login-member-build-20261001.log`.
- API build **PASS**: `C:/UCell/logs/stage-login-api-build-20261001.log`.
- Focused isolated API **3 suites / 17 tests PASS** plus runner baseline **162 DB assertions**, disposable database cleanup PASS: `C:/UCell/logs/stage-login-focused-20261001.log`. Includes foreign LINE subject, used/expired proof, disabled Person, approval separation and account security.
- Existing real PostgreSQL paper-member request → approved binding → session → replay rejection **1 suite / 1 test PASS**, baseline 162 DB assertions and cleanup PASS: `C:/UCell/logs/stage-login-paper-db-20261001.log`.
- Server ID-token verifier **7 tests PASS**, including audience/issuer/time failures and server-owned nonce checks (`node backend/scripts/line-token-verifier.test.mjs`). No actual LINE credentials used by these tests.
- Initial Member build exposed a Windows case-insensitive module-name collision; the new component was renamed `LineBindingPage.tsx`, then build passed. No standards disabled.

Automated tests use controlled SDK/provider substitutes; this is **not** real LINE authorization, live callback or phone UAT evidence. No new full-API recertification is claimed. Existing overall Master readiness is unchanged.

## NEXT ACTIONS ONLY

1. Operator completes [the exact manual Login/LIFF checklist](../../deployment/LINE_STAGE_MANUAL_GATE.md) and supplies real public Channel ID / LIFF ID / LIFF URL. Channel Secret is not consumed in this retained SDK flow; do not send it in chat.
2. Configure/release through the existing Stage process after IDs are available. Member needs rebuild; API needs runtime config. No Worker Login changes.
3. Execute real OA → LINE Login → Binding → Member Center → Products → Orders → PV/BV → Sponsor/Placement → Qualification → Bonus → Wallet → Admin → Return/Reversal UAT, including identity abuse/recovery cases. ERP and real bank payment excluded.

**Status: local code preparation complete; manual channel/configuration and credential-backed Stage UAT pending.**

## Master reconciliation and recovery acceptance

The Master chat reviewed the retained implementation and added a safe recheck control for a committed binding whose response is lost. Recheck reruns the existing bootstrap/server identity validation; it does not resend a consumed completion proof or directly enter an authenticated state. Actual SDK uninitialized access threw provider details during the first browser attempt; it is now converted to the fixed Traditional Chinese expired-login message before any request. A themed outer shell fixes the light background surrounding the dark binding card. Initial browser failure is retained in master-line-binding-browser-20261001.log.

Final Member **36 files / 194 tests** and TypeScript/production build PASS. Actual Edge component rendering at 390/1280 px in light/dark PASS, no horizontal overflow/page errors, missing SDK/token denial and recheck callback PASS, disposable fixture cleanup PASS. Screenshots in C:/UCell/logs/line-binding-browser-20261001 were visually inspected. This standalone actual-component browser fixture is not the production bootstrap or real LINE login; prior controlled SDK tests and real PostgreSQL binding tests provide separate bounded proofs. Focused final API acceptance is recorded in evidence/line-binding-master-reconciliation-20261001.json after terminal completion. No live provider request, deployment or message was made.

The preceding Master full runner (185 suites / 1,339 tests) included concurrent auth edits; its concurrency limitation remains. No whole-batch frozen recertification or real LINE UAT readiness is inferred. The Stage manual channel/LIFF Gate remains pending.

Master final isolated API acceptance: **4 suites / 18 tests PASS**, fresh 126 migrations, 162 baseline assertions and cleanup PASS. Includes current-status rejection, security/session rules and real PostgreSQL paper-member approved binding with replay rejection. Source hashes were verified unchanged after completion.
