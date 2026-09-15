# UCell R1.0B RC1 — Specification / AI / Rule Alignment Report

## Decision
RC1 is the consolidated release candidate source. It is structurally aligned to R1.0B FROZEN, the Master/MVP system specifications and Intelligence OS governance. It is **not yet authorized for production promotion** until connected dependency, database, live security, UAT and backup/restore gates pass.

## Rule alignment confirmed
- Person != Qualification; one adult Person may hold multiple independent Qualifications.
- Sponsor Tree != Binary Tree.
- Active First is event-time/temporal and applies to all awards.
- Referral G1: STARTER 15%, ELITE 20%, LEADER 25%.
- Equalization: LEADER G5 explicitly 10%.
- Referral Pool 42% / K0.
- Binary theory 12%, weekly caps 450k/900k/1.5m paired PV, strong-side carry, Binary Pool 36% / K1.
- Matching source is post-K1 Binary Paid; G1-G5 15/10/5/5/5; Matching Pool 15% / K2.
- Subscription 6k/12k/24k with 3/6/12 monthly recognitions; 1,200 RPV/month.
- RPV uses Binary Tree and 0/1/2+ direct unlock 5/8/12 generations, NT$100/generation.
- EPV uses REPURCHASE excess above 2,000 x 60%; Self 50%; Sponsor G1-G5 each 6%.
- Global Pool 5%; Welfare Pool 2% accrual only.
- Award lifecycle CALCULATED → PENDING_45D → EFFECTIVE → PAYABLE → PAID.
- Return corrections use reversal/clawback/recovery/replay/adjustment and never overwrite history.
- Upgrade/Transfer review fee NT$600; transfer retains Qualification ID and organization position.

## System alignment confirmed
- NestJS API + Worker + PostgreSQL + Prisma + Swagger/OpenAPI architecture.
- Transactional Outbox and idempotency patterns present.
- Immutable/temporal data structures used for qualification, holder, status, ledger and settlement facts.
- MVP Commerce Bridge remains separate from future D365 BC ERP responsibility.
- Admin Entra authentication, explicit AdminAccessGrant and fail-closed RBAC are implemented in R6 source.

## AI alignment confirmed
- AI is not in the deterministic money path.
- AI runtime remains deferred as permitted by MVP specification.
- Production AI must be read/explain/diagnose/simulate by default and may not write monetary or rule facts.

## Blocking items before production
- Generate/review/freeze backend and admin pnpm lockfiles.
- Install dependencies and run real TypeScript/Prisma builds.
- Apply migrations through 0016 to PostgreSQL and run DB golden E2E.
- Complete live Entra/JWKS login tests.
- Complete Security E2E / BOLA-IDOR / privilege tests.
- Execute all R6 P0/P1 UAT and attach evidence.
- Zero CRITICAL Integrity Alerts.
- Complete and sign backup/restore drill.
- Pass final RC gate.

No production deployment should bypass these blockers.

## Additional release blocker found during final audit
The backend test tree currently contains **148 `it.todo` / `test.todo` executable E2E placeholders** across 13 test files. These are now treated as an explicit production blocker. RC1 adds `scripts/test-todo-gate.mjs`; production promotion requires `TEST_TODO_GATE_PASS`.
