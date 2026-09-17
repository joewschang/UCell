# V1.9 Admin Package Read-back Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Delivered

- Added an Admin navigation entry and RBAC-protected route for Core package configuration read-back.
- Added package profile/version status, authoritative price, exact selection quantity, product-pool count, sales/effective windows, approval reference, and config-hash display.
- Kept the screen read-only for this checkpoint. Existing Backend lifecycle commands remain the sole mutation boundary.
- Removed an accidental literal line-break token from the Admin route declaration while preserving the existing content and document routes.

## Verification

- Admin production build: PASS.
- Admin Vitest: 11 files, 23 tests PASS.
- The new test verifies that the UI displays the persisted Core amount and evidence and does not introduce a PV formula.

## Next slice

Connect the already hardened Admin package commands to role-specific create, version, product-pool, approval, scheduling, activation, and retirement controls. Production schedule values remain blocked until formally approved and must not be invented by the UI.
