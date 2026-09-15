# Recommended implementation order

## Sprint 0 - foundation
- pnpm monorepo
- NestJS / Fastify
- PostgreSQL
- Prisma read/write adapter
- Swagger/OpenAPI
- Request/Correlation ID
- Exception filter
- Auth/RBAC skeleton
- Qualification Guard
- Docker Compose
- CI build/test/openapi

## Sprint 1 - Admin MVP
- Person
- Qualification
- Sponsor
- Binary placement
- Membership application
- Admin search/detail

## Sprint 2 - Commerce bridge
- Product reference
- Order
- Payment confirmation
- Fulfillment
- Return
- Outbox/Inbox

## Sprint 3 - Ledger foundation
- GPV/PV/RPV/EPV events
- reversal
- snapshots
- audit

## Sprint 4 - Subscription + R1.0B
- 3/6/12 monthly schedules
- monthly 1,200 RPV
- 0/1/2+ effective direct => 5/8/12 depth

## Sprint 5 - LINE/member APIs
- LINE identity binding
- qualification selector
- dashboard
- referral link
- member order
- award views

## Sprint 6 - bonus engine
- referral
- equalization
- binary
- matching
- global
- settlement/K factors
- pending45d

## Sprint 7 - D365 BC adapter
- only after Core and canonical events are stable
