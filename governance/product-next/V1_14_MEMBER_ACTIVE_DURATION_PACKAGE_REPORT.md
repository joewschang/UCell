# V1.14 Member Active-Duration Package Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Delivered

- Added Member discovery for active `ACTIVE_DURATION` package versions.
- Added an existing-Qualification package selector to the connected Member shop.
- Bound checkout to the currently selected owned Qualification through `targetQualificationId`.
- Reused the exact-quantity Product Rule Profile selector and idempotent order command.
- Rejects a malformed active-duration package that does not require a target Qualification.
- Rejects an order response whose Qualification differs from the selected Ball.
- Kept each Ball isolated; no same-Person cross-Ball substitution is performed.

## Monetary and lifecycle boundary

The Member UI submits only package version, target Qualification, and selected Product Rule Profile quantities. Backend/Core remains authoritative for official price, duration effect, payment, PV/BV, recognition, and Qualification lifecycle. A created order remains pending payment and does not claim that the Qualification has been extended.

## Verification

- Member production build: PASS.
- Member Vitest: 22 files, 136 tests PASS.
- New tests verify exact target-Qualification payload, selected-Ball read-back, cross-Ball fail-closed behavior, and absence of eager checkout mutation.

Production Promotion, operational UAT, formal credentials, and external payment processing remain outside this checkpoint.
