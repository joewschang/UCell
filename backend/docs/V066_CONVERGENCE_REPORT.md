# UCell R1.0B Backend v0.6.6 — Convergence Report

## Purpose
This build stops adding compensation-plan behavior and concentrates on schema/service/test convergence before DEV deployment.

## Corrected drift
1. Removed an invalid `Person -> PayoutLine[]` relation. Payout is Qualification-first.
2. Added explicit `PayableEntry -> Qualification` and optional `PayableEntry -> PayoutLine` relations.
3. Added reverse `PayoutLine -> PayableEntry[]` relation.
4. Added `RecoveryApplication -> PayoutLine` and `RecoveryApplication -> BonusRecoveryEvent` relations.
5. Added reverse `BonusRecoveryEvent -> RecoveryApplication[]` relation.
6. Preserved partial-recovery invariant and added an open-balance index.
7. Added a duplicate-application guard for `(payout_line_id, bonus_recovery_event_id)`.

## Executed in this build environment
- Repository static validation.
- v0.6.6 convergence validation.
- Pure-domain Golden invariants.

## Environment limitation
The current build container has Node.js but no installed pnpm/Docker/project node_modules and cannot reach npm registry. Therefore `prisma validate`, `prisma generate`, Nest TypeScript compile, and PostgreSQL migration smoke cannot truthfully be reported as executed here.

## Production gate
These commands remain mandatory in a networked DEV/CI environment:
1. `pnpm install --frozen-lockfile`
2. `pnpm db:generate`
3. `pnpm --filter @ucell/database exec prisma validate`
4. `pnpm build`
5. start PostgreSQL
6. `pnpm db:deploy`
7. `pnpm test`
8. Golden DB E2E
