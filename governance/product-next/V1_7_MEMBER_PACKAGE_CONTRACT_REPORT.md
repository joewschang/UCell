# V1.7 Member Package Contract Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Delivered

- Added the typed Member transport contract for active `QUALIFICATION` packages.
- Added authoritative package product-pool loading by `packageVersionId`.
- Added first-Qualification package order submission using only `packageVersionId` and member selections.
- Preserved Backend/Core authority: the Member client sends no price, PV, BV, qualification owner, placement, or monetary calculation.
- Added fail-closed runtime checks for UUIDs, currency, decimal amounts, config hashes, dates, duplicate package versions, duplicate product profiles, and duplicate selections.
- Preserved `Idempotency-Key` on the package checkout command.

## Verification

- Member production build: PASS.
- Member Vitest: 20 files, 131 tests PASS.
- New package contract tests: 4 PASS.

The tests verify the exact outbound order body, server-owned monetary response, canonical qualification package endpoint, package product-pool validation, and malformed/duplicate evidence rejection.

## Scope boundary

This checkpoint establishes the Member API transport and validation layer. The first-Ball package selection screen is still a subsequent UI integration slice. No Production Promotion, UAT, formal credential, or external SMS/Google certification claim is made.
