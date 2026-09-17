# V1.11 Admin Package Product Pool Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Delivered

- Added a method-specific idempotent PUT command client for replace-style Admin configuration operations.
- Clears both POST and PUT retained command attempts when the authenticated Admin session is cleared.
- Exposed active Product Rule Profile identifiers in the Admin domain contract.
- Added DRAFT package-version product-pool management with duplicate prevention, explicit minimum/maximum quantity, selection increment, and deterministic sort order.
- Sends the complete pool to the existing hardened Backend replacement command; approved or active versions are not offered for mutation.
- Keeps official product value and PV/BV rules in the selected Backend Product Rule Profile. The Admin UI does not calculate them.

## Verification

- Admin production build: PASS.
- Admin Vitest: 11 files, 28 tests PASS.
- Tests verify PUT method use, non-empty Idempotency-Key, exact product-pool payload, DRAFT targeting, and existing package/RBAC behavior.

## Remaining package UI work

- Separate-actor approval.
- Explicit scheduling using only approved operational values.
- Activation and retirement with confirmation and post-command read-back.
- Production operational calendar/cut-off values remain pending formal approval.
