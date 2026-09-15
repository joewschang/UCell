# UCell Member MVP Development Status

Checkpoint: v0.3 / 2026-09-15
Branch: `feature/member-liff-mvp`
Baseline: `461de2b`; pre-edit checkpoint: `cb44543`.

## Implemented
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
