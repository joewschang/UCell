# UCell Member MVP Development Status

Latest checkpoint: v0.5 (v0.3/v0.4 history retained below)
Branch: `feature/member-liff-mvp`
Baseline: `461de2b`; pre-edit checkpoint: `cb44543`.

## Implemented

The sections through v0.4 below preserve the prior checkpoint record.
- Mobile home, qualification selector, separate Sponsor/Binary views.
- Month query, performance values, award lifecycle and append-only ledger display.
- Product catalog, read-only order/payment/shipment expansion and Person profile.
- Explicit demo banner; no real/mock fallback on failed requests.
- Keyed/cancelled requests prevent stale ball/month responses rendering.
- Restored qualification validated against owned list; foreign selections rejected.
- Scoped response qualification/period checked before display.
- Auth failures/redirect remain outside member provider; no raw LINE token storage.
- Empty/error/retry/not-found states and accessible labels/focus/touch controls.
- Node 24 / pnpm 12.4.1 lockfile and isolated Member CI workflow.

## Verified locally
- Frozen dependency install: PASS (Node 24.19.0, pnpm 12.4.1).
- TypeScript check and Vite production build: PASS.
- Vitest: 16 executable tests PASS (13 member/resource/API + 3 auth).
- Diff whitespace validation: PASS.
- Browser/mobile smoke: NOT RUN. Chromium is absent; browser download timed out.
  Reproducible Playwright smoke script included for a connected QA environment.
- CI workflow authored; remote CI outcome not yet established.
- Backend DB, BOLA/IDOR, monetary/security/release gates: NOT RUN by this frontend task.

## Remaining integration blockers
- This branch lacks an approved Member session exchange/API implementation.
  Real mode deliberately stops after LINE authentication until integrated.
- `docs/API_VIEW_CONTRACT_v0.3.md` proposes adapter DTOs, requiring backend sign-off;
  this is not a new economic rule or a claim that live endpoints are available.
- Purchasing, checkout, shipping address, profile edits, notifications, logout and
  live repurchase actions remain pending; catalog purchase buttons are disabled.
- Product images referenced in the conversation were absent locally; no company
  identity, legal registration or visual branding was inferred from missing assets.
- Real-device LIFF UAT, full runtime DTO validation, pagination and server-level
  Person/Qualification authorization remain required before promotion.

Backend code, economic rules, ledger and existing TODO gates unchanged.
No main merge, force push, RC2 designation or production promotion.

## v0.4 increment — demo checkout

Implemented: cart per qualification, quantity/remove, shipping validation, review,
explicit qualification confirmation, in-memory demo order creation, scoped order
listing, duplicate-submit protection. Real purchase stays unavailable. No shipping
PII persistence and no payment/PV/award posting. Refresh discards demo state.

Validation: 29 executable tests PASS (16 retained + 13 new), TypeScript/Vite build
PASS. New tests cover isolated carts, duplicate confirmation, real-mode rejection,
invalid quantities/SKUs, shipping errors and completed review interaction.
Browser smoke updated for checkout and 320/390/768px checks but remains BLOCKED:
Chromium/headless-shell executable is absent; installation did not complete.
These browser scenarios and real-device LIFF UAT have NOT been marked PASS.
See docs/CHECKOUT_INTEGRATION_v0.4.md for the backend handoff boundary.

Current blockers: Member session exchange, approved quote/create contract, payment,
server-side authorization/idempotency, browser and device UAT. Production remains
BLOCKED. No main merge, RC2 promotion or production deployment.

## v0.5 increment — session expiry and runtime DTO checks

- A Member 401 clears the local bearer/raw LINE token and selected qualification,
  aborts concurrent requests, and unmounts the entire Member provider/App tree.
  New calls remain blocked until a fresh page bootstrap; reload is not proof of login.
- Late successful responses, including delayed JSON bodies, cannot restore data.
  Request abort cleanup is retained. 403 is a scoped denial, not automatic logout.
- Browser storage failure cannot prevent expiry locking. Member fetch uses no-store.
- All ten real read-model response types are parsed before render. Missing fields,
  invalid booleans/arrays, duplicate IDs, unknown award states, non-finite/unsafe
  numbers and numeric strings fail visibly without substituting demo data or zero.
  Null remains null; valid zero and signed ledger adjustments remain unchanged.
- No new dependencies. Source typecheck/build and 54 executable tests PASS
  (29 retained + 25 added). Whitespace check PASS.
- Browser/real-device LIFF UAT and server security/release tests remain NOT VERIFIED.
  Existing browser executable blocker remains; no production promotion.

See docs/SESSION_DATA_BOUNDARY_v0.5.md. This does not implement LINE token exchange,
server logout/revocation, checkout, or server BOLA/IDOR authorization.

## v0.5 QA follow-up — browser smoke CI

The original v0.5 Member CI passed on GitHub (run 34998893187); it did not yet
include browser execution. Added locked Playwright 1.62.1, a browser test command,
isolated loopback-only mock browser smoke and automatic CI evidence retention.
CI includes browser/system dependency installation, server readiness/cleanup,
timeouts, and success/failure screenshots. No deployment or secrets are used.
Local frozen install, all 54 existing tests, typecheck/build, smoke syntax and
diff checks pass. Browser execution result must be read from the new CI run;
authoring the workflow alone does not mark the smoke suite as PASS.

Interactive Cloud Browser was available but rejected the loopback URL with
ERR_BLOCKED_BY_CLIENT. No alternate route or protection bypass was attempted.
Real LINE login/device UAT, backend integration and production promotion remain
pending. This QA increment does not claim a new member-facing functional release.

### Observed CI result

Commit b5cee113f98c81e41456cda5661497d7d6af435b passed GitHub Actions run
34999776718, including 54 tests, typecheck/build and isolated Chromium smoke.
Job 104485007674 logged PASS for routes, ball isolation, checkout, 320/390/768px
overflow and no page errors. Evidence artifact 10408094880 contains the screenshot
and server log (seven-day retention). Manual visual review was not performed.
This supersedes the pending browser-CI status for that commit only, not real LINE
UAT or server authorization/payment tests. No production promotion is authorized.
