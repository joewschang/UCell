# V1.8 First Qualification Member UI Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Delivered

- Added a Member route for people who do not yet own a Qualification to browse active `QUALIFICATION` packages.
- Added authoritative delivery-profile gating before package product selection.
- Added package product selection with exact server-configured quantity, minimum, maximum, increment, and availability constraints.
- Added idempotent first-Qualification order submission and automatic Qualification context refresh after success.
- Kept price, PV, BV, recognition, placement, and monetary calculation outside the frontend. The UI submits only the package version and selected product-profile quantities.
- Kept the order explicitly pending payment; the screen does not claim payment, Qualification activation, or volume recognition.

## Verification

- Member production build: PASS.
- Member Vitest: 21 files, 133 tests PASS.
- New first-Qualification UI tests: 2 PASS.
- Existing connected shop, registration, formal upgrade, Qualification lifecycle, Admin payment refresh, and contract tests remain green.

## Release boundary

This checkpoint implements the Member UI integration against the existing Core package APIs. Production Promotion, UAT, external credentials, payment-provider settlement, and production operational calendar approval remain outside this checkpoint.
