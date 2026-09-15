# RC1 Source Reconstruction Status

Branch: `rebuild/rc1-source-v1`

## Completed baseline
- pnpm workspace
- PostgreSQL 16 Docker Compose service
- environment template with non-production credentials
- NestJS + Fastify backend bootstrap
- Swagger/OpenAPI UI gated off in production
- strict DTO validation baseline
- `/api/v1/health`
- Prisma baseline implementing `Person -> 1:N Qualification`
- explicit comments that Qualification is the independent economic/organization unit

## Non-negotiable invariants
1. Filed/legal SSOT and R1.0B FROZEN govern economic rules.
2. Sponsor Tree and Binary Tree are independent structures.
3. Every organization/PV/Active/bonus/repurchase operation requires `Qualification_ID`.
4. Missing qualification context must fail closed; never auto-select the first ball.
5. Historical economic records are append-only and corrected by reversal/adjustment.
6. Rule Version + Parameter Snapshot must be persisted for historical calculation facts.
7. AI may explain authorized read models but may not calculate or write official monetary results.
8. UCell owns membership/organization/rules/PV/bonus; ERP owns inventory/accounting/physical fulfillment long-term.

## Next implementation slice
- PrismaService and DB connectivity
- Person API
- Qualification API and ownership guard
- Sponsor/Binary models and constraints
- canonical API error envelope
- request/correlation ID
- idempotency store
- transactional outbox
- initial migration and seed
- contract/golden tests

Production promotion remains prohibited until all database, security, UAT, backup/restore and release gates pass.
