# UCell R1.0B Backend Implementation v0.5.0

v0.5 closes the first negative-flow and payout loop.

## New
- Qualification temporal status history
- Return / partial return
- GPV reversal
- Referral / Equalization reversal and clawback
- Bonus recovery ledger
- Binary / Matching recalculation request
- PAYABLE / PAID payout batches
- recovery offsets
- EPV excess repurchase
- Global Pool
- retained rank history
- Welfare Pool accrual

## Important design decisions

### Historical facts are not rewritten
A return never edits the original:
- Order Line
- GPV event
- Bonus Award
- Settlement
- Binary Carry

It creates reversal/recovery/adjustment facts.

### Binary and Matching refund handling
v0.5 intentionally does not pretend that a simple negative bonus row is enough.
A refund may change Pairing, Carry, K1 and therefore Matching/K2.
The system creates an explicit `SettlementRecalculationRequest`.
The compensating-delta engine is the next implementation step.

### Welfare Pool
2% is accrued only.
No distribution formula was invented.

### Remaining production gaps
- settlement delta/recalculation engine
- subscription cancellation/reversal
- upgrade/transfer/exit
- unified payout treatment for Global Pool
- canonical hierarchical parameter registry convergence
- production authentication / RBAC / LINE identity
- D365 BC adapter
- first dependency install / compile / migration smoke test in a network-enabled DEV runtime


## v0.6.10
Deterministic Binary/Matching replay, RPV reversal worker, subscription cancellation and qualification workflow closure.


## v0.6.2
Economic attribution, all Binary ancestor impact discovery, period-wide K1/K2 replay and multi-week carry propagation.


## v0.6.3
Asia/Taipei settlement calendar, unified payable/payout, Recovery application and Qualification-level authorization baseline.


## v0.6.4
Partial Recovery balance, identity/session baseline, audit interceptor and deterministic R1.0B Golden Dataset.


## v0.6.5
Validation/convergence slice: module wiring, Global Pool payable adapter, executable frozen-rule invariants and static repository validation.


## v0.6.6
Engineering convergence release: Prisma relation drift corrections, recovery guards, convergence validator, and executable pure-domain Golden gate.

## v0.6.7

Engineering preflight release: migration convergence, AuditInterceptor activation,
UUID-safe correlation IDs, dependency-free schema/migration/source gates, expanded R1.0B Golden regression,
and a reproducible DEV smoke script.

Run offline:
`npm run preflight`

Run in a dependency/database-enabled DEV environment:
`npm run dev:smoke`

## v0.6.8

Adds the dependency/database-backed CI and Release Candidate gates:
PostgreSQL migrations, Prisma validate/generate, build, Golden DB checks,
OpenAPI contract verification and HTTP health smoke.

Production promotion requires `RC_GATE_PASS`.

## v0.6.9

Deep Prisma relation convergence and runtime-safety pass.
Adds relation/client-access/runtime preflights and removes stale Person-level relations
that violated the Qualification-first R1.0B domain model.


## v0.6.10
Final offline convergence: enum/migration checks, deterministic Golden Economic Cases, and explicit v0.7.0 RC promotion policy.
