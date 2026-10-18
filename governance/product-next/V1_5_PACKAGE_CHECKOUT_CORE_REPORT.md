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

## Product-owner GPV clarification — 2026-10-18

The owner explicitly confirmed qualification package prices LEADER 72,000,
ELITE 43,200 and STARTER 14,400, followed by: 「GPV 都是 *0.6，PV與BV是概念class」.
For these three approved qualification packages, GPV candidates are therefore
43,200, 25,920 and 8,640 respectively. PV and BV are not independently inferred
numeric amounts from this clarification. Existing historical fields are not
renamed or migrated by this change.

`resolveQualificationPackageGpv` in `@ucell/shared` implements this bounded rule
under explicit reference `PO_20261018_QUALIFICATION_GPV_60`. It rejects unknown
package classes/codes, currencies, changed prices and legacy rule references.
It returns an immutable GPV candidate only; it does not post recognition or
change the existing package payment event or settlement input barrier.

Validation: 23 focused tests passed; standalone strict TypeScript checking of
the new resolver passed. No production data or runtime deployment changed.

Still required for posting: approved eligible-consumption treatment and
partial-return allocation; an explicit effective/historical application
decision; membership/sponsor/placement evidence; and the transactional package
recognition handler. The existing 2026-10-17 paid LEADER order belongs to an
already closed weekly interval, so it additionally requires the governed
correction path. Do not rewrite its purchase snapshot, reset finalized receipts,
emit a generic SALE_CONFIRMED event, or mark its pending package event processed
merely because its GPV candidate can now be calculated.

Earlier verification and blocker statements above describe the original
checkout release, not current deployment status. This dated clarification is
limited to the GPV rule; it does not re-open previously completed launch gates.
