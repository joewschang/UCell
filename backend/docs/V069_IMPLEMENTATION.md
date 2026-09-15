# UCell R1.0B FROZEN — Backend v0.6.9

## Objective
Perform a deeper Prisma/service convergence pass before the first real `prisma validate`.

## Defects found

### 1. Invalid Person-side domain relations
The evolving Prisma schema had stale fields on `Person` pointing directly to:
- BonusAward
- source BonusAward
- BinaryCarry
- QualificationStatusHistory
- QualificationGlobalRankHistory

Those facts are Qualification-scoped in R1.0B.
The stale Person relations were removed.

### 2. AuthSession relation incomplete
The database FK from AuthSession.person_id to Person existed, but Prisma had no relation field.
Added:
- Person.authSessions
- AuthSession.person

### 3. BonusAward sourceAwardId relation incomplete
Matching replay uses `sourceAwardId`.
Added an explicit self relation:
- sourceAward
- derivedAwards

### 4. HTTP audit entity_id type mismatch
`audit_event.entity_id` is UUID.
HTTP request audit previously attempted to store request_id there, which may be a non-UUID string.
HTTP audit now leaves entity_id NULL and uses request_id/correlation_id.

### 5. Legacy payout bypass
An old PayoutService could bypass:
- PayableEntry
- partial Recovery balance
- RecoveryApplication

It is now only a compatibility façade delegating to UnifiedPayableService.

## New gates
- PRISMA_RELATION_PREFLIGHT
- PRISMA_CLIENT_ACCESS_PREFLIGHT
- RUNTIME_SAFETY_PREFLIGHT

These run before dependency-backed Prisma validation and are designed to catch schema/service drift early.
