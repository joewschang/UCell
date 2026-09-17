# Issue #2 Phase 2 — Implementation Report

Date: 2026-09-18
Branch: `integration/member-backend-mvp`
Baseline: `85f4869a2ae1b415a300029ab46ef0996b7bfddf`

## Scope completed

- Member qualification-scoped pages now use a common header that exposes qualification code, rank, and ball.
- Member terminology is centralized for qualification state, binary organization, award lifecycle, adjustment, null, and unavailable states.
- Admin denied routes render an explicit 403 state at the requested URL; unauthenticated access still follows the existing login redirect.
- Admin navigation labels now distinguish subscription, award/settlement evidence, and payout/reconciliation concepts.
- The System route inventory is explicitly labelled as a static Phase 1 snapshot. OpenAPI remains the live contract source of truth.
- Focused regression tests cover terminology, navigation labels, authorization state, and static route-inventory disclosure.

## Deliberately unchanged

- R1.0B monetary rules and calculations
- Qualification ownership and BOLA/IDOR authorization
- Historical evidence and append-only monetary records
- API contracts and backend read models
- Production credential and UAT status

## Deferred dependencies

- Carry and complete binary-tree presentation require authoritative Member read models.
- Admin NASL, GMV, organization-health, settlement-health, and security aggregates require additive authoritative APIs.
- Formal LINE/LIFF and Entra evidence requires operational credentials.
- UAT evidence remains pending a governed evidence store and formal sign-off workflow.

Production Promotion remains **BLOCKED**.

## Checkpoint 2

- Binary placement counts remain authoritative, while volume, carry, and full-tree projections now expose explicit additive availability contracts.
- Missing Binary settlement metrics remain `null` with `SETTLEMENT_METRICS_READ_MODEL_NOT_AVAILABLE`; the UI never converts them to zero.
- The Admin dashboard connects the existing compensation summary for historical award, recovery, and finalized-batch facts, without inferring current settlement state.
- Member and Admin API clients now distinguish missing data, offline service, timeout, cancellation, and expired sessions.
- OpenAPI was regenerated for the additive Binary response fields.

No database migration was introduced.

## Checkpoint 3

- Admin Dashboard order-day and order-month windows now use the effective versioned `accounting.timezone` snapshot inside one repeatable-read transaction.
- The database resolves half-open UTC boundaries with `AT TIME ZONE`; missing, invalid, or overlapping configuration fails closed before aggregate queries.
- The UAT page and exported JSON are explicitly classified `LOCAL_ASSISTIVE_ONLY` with `formalSignOff: false`.
- Conditional Member journey regressions cover zero-Qualification shop/onboarding and network-registration entry without scoped reads or mutations.
- A timing-sensitive Admin package test now uses deterministic React Query cache setup while retaining its GET and content assertions.

Production operational cut-off remains undecided and is not used by the Dashboard calendar aggregation.

## Checkpoint 4

- Added append-only `audit.uat_execution_evidence` storage with database guards against update and delete.
- Formal UAT evidence ingestion requires the governed UAT deployment, explicit feature enablement, Super Admin, actor, approval reference, immutable artifact hash, and idempotency key. Every API result remains `formalSignOff: false`.
- Added exact-scope Member Binary settlement reads using an explicit finalized `BINARY_K1` batch and its sealed historical replay snapshot.
- Historical period GPV and carry reject missing, negative, non-finite, unsafe-range, mismatched, draft, or corrupt evidence. No current-state fallback is used.
- Dashboard now reports exhaustive current Person record and Qualification lifecycle status counts while keeping NASL New/Active/Suspend/Lost explicitly unavailable.

Member UI still does not guess a “latest” Binary settlement batch. An authoritative member-visible settlement index is required before adding a selector.

## Checkpoint 5

- Refreshed the frozen UX-3 reference set from checkpoint `2bceaa0492dc70462b431819a743c0d0877cc16d` after the authoritative Admin lifecycle-count integration.
- All 104 responsive route/viewport assertions and all 26 automated accessibility route checks pass.
- These results remain local visual/basic accessibility evidence. They do not certify formal LINE/LIFF, Entra/RBAC, screen-reader, or complete WCAG operation.
