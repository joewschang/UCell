# V1.5 Package Checkout Core Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Outcome

Member package selection is now connected to the authoritative Order and Admin payment path. The mutation atomically stores the Order, immutable `PackagePurchaseSnapshot`, and exact `PackagePurchaseSelection` rows under Serializable idempotency.

Qualification packages create a non-entitled DRAFT Qualification at checkout so the existing non-null Order ownership contract remains backward compatible. Payment creates `QualificationSetup` in `BALL_SETUP_PENDING`, linked to the immutable package snapshot. It does not create Sponsor/Binary edges, set Active, or emit generic sale recognition.

Active-duration packages require an owned target Qualification. Payment records dedicated package evidence but returns `RECOGNITION_CONFIGURATION_PENDING`; no entitlement dates are created because production stacking/start-date semantics remain pending formal approval.

## Safety and contracts

- Retail checkout remains qualification-scoped and backward compatible.
- Package checkout accepts `packageVersionId`, optional owned `targetQualificationId`, and exact versioned product-profile selections.
- Package product choices carry zero inferred line PV/GPV and zero inferred allocation; the server-authoritative package price is the Order total.
- Package payments emit `PACKAGE_PAYMENT_CONFIRMED`, never `SALE_CONFIRMED`.
- A database trigger rejects accidental generic `SALE_CONFIRMED` outbox insertion for a package Order.
- Qualification setup now has a forward-only optional unique link to `PackagePurchaseSnapshot`.
- Lost-response retries preserve one Order, one snapshot, one setup, and one payment effect.

## Validation evidence

- Prisma validate/generate: PASS
- Fresh DB `prisma migrate deploy`: PASS, 39 migrations
- DB Golden: PASS, including 19 package-checkout assertions and all prior concurrency, return, membership, RPV, placement, package config, content, and formal-application suites
- Backend Jest on random disposable database: 17 suites PASS, 186 passed, 3 TODO
- Backend API build: PASS
- Worker build: PASS
- Admin build/tests: PASS, 10 files / 22 tests
- Member build/tests: PASS, 19 files / 127 tests
- Schema, migration, OpenAPI, static, and security policy preflights: PASS
- TODO gate: BLOCKED by the existing 3 executable placeholders (`negative-flow-v05`: 1; `vertical-slice-02`: 2)

## Remaining blockers

- Active-duration stacking, period start, and extension rules need formal Active-policy SSOT before entitlement creation can be enabled.
- Package recognition processing must resolve `recognitionConfigRef` into explicit PV/BV/consumption events; price or retail-line totals must never be used as inferred recognition.
- Admin package mutation endpoints still require the previously recorded idempotency/audit hardening before production readiness.
- Formal external credentials, Security E2E, UAT, and Production Promotion remain blocked.
