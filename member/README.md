# UCell Member MVP v0.1

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
