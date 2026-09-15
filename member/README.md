# UCell Member MVP v0.1

Current implementation and integration status: see [DEV_STATUS.md](DEV_STATUS.md),
[backend handoff](docs/BACKEND_INTEGRATION_HANDOFF.md), and
[offline contract runner](docs/CONTRACT_RUNNER.md). Historical version sections
below do not imply real LINE login or production readiness.

LINE OA + LIFF member frontend. This app is a presentation/channel layer only: it MUST NOT calculate official monetary awards, write ledgers, or read PostgreSQL directly.

## Core invariants
- Login identity is Person; organization/performance/bonus context is Qualification/Ball.
- Person -> 1:N Qualification. Never aggregate independent balls unless an API explicitly returns a person-level aggregate.
- Sponsor Tree and Binary Tree are separate concepts.
- Official PV/RPV/EPV and awards come from UCell Core API.
- `PENDING`/unknown monetary values render as pending, never fake `0`.
- Member frontend does not own ERP inventory/accounting.

## Planned Member API
`GET /api/v1/member/me`
`GET /api/v1/member/qualifications`
`POST /api/v1/member/context/qualification`
`GET /api/v1/member/dashboard`
`GET /api/v1/member/organization/sponsor`
`GET /api/v1/member/organization/binary`
`GET /api/v1/member/referrals`
`GET /api/v1/member/performance`
`GET /api/v1/member/bonuses`
`GET /api/v1/member/bonuses/ledger`
`GET /api/v1/member/products`
`POST /api/v1/member/orders`
`GET /api/v1/member/orders`
`GET /api/v1/member/orders/:id`
`GET /api/v1/member/repurchase/status`
`GET /api/v1/member/notifications`
`PATCH /api/v1/member/profile`

## Local DEV
Copy `.env.example` to `.env.local`. Use `VITE_ENABLE_MOCK=true` until Member API and LINE LIFF credentials are connected.

`pnpm install`
`pnpm dev`

Toolchain baseline: Node 24 / pnpm 12.4.1.

## v0.3 read-only interactive checkpoint
The seven routes now have data views, with explicit mock labels and qualification
isolation. See `DEV_STATUS.md` for tested scope and live-integration blockers.
Mock startup requires `VITE_ENABLE_MOCK=true`; a missing LIFF ID is no longer an
implicit mock fallback. Real login remains fail-closed until backend exchange is
approved. Product catalog does not submit orders.

Run `corepack pnpm install --frozen-lockfile`, `corepack pnpm test`,
`corepack pnpm run typecheck`, `corepack pnpm run build` inside `member/`.
`pnpm-workspace.yaml` permits only the required esbuild installation script.
The Member-only CI does not replace Backend security/release gates.

For browser smoke checks in a permitted QA environment: install locked dependencies,
run `corepack pnpm exec playwright install chromium`, start the mock Vite dev server
with `VITE_ENABLE_MOCK=true corepack pnpm dev --host 127.0.0.1 --port 5174 --strictPort`,
then run `corepack pnpm run test:browser`. The Member CI installs Chromium and runs
this suite automatically. It checks routes, ball isolation, checkout and 320/390/768px
overflow. Network writes and non-local requests are blocked by the test harness.
CI evidence is retained for seven days; this is not real-device LINE UAT.
Hosting must rewrite SPA routes to index.html; no hosting was published here.

## v0.4 demo checkout
With explicit `VITE_ENABLE_MOCK=true`, the catalog supports carts per ball,
shipping review and demo orders. Use fictitious contact details. No network writes,
real payment or PV recognition occurs. Cart/order state is in-memory and disappears
on refresh; shipping fields reset on qualification change. Real mode stays read-only.
See `docs/CHECKOUT_INTEGRATION_v0.4.md` for integration requirements and limitations.
