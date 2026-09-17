# V1.22 Inventory Lite Reservation Contract Report

Status: IMPLEMENTED — DOMAIN INVARIANT SLICE
Date: 2026-09-17
Branch: integration/member-backend-mvp

## Scope delivered

- Added immutable Inventory balance snapshots with `onHand`, `reserved` and `available` quantities.
- Enforced `available = onHand - reserved`, non-negative quantities and safe-integer storage boundaries.
- Added deterministic RESERVE decisions that keep on-hand unchanged and fail when requested quantity exceeds available stock.
- Added deterministic RELEASE decisions that keep on-hand unchanged and fail when quantity exceeds the current reservation.
- Movement quantity must be a positive safe integer.
- Decisions return explicit before/after evidence without mutating the supplied snapshot.
- Errors expose stable machine-readable codes for invalid balance, invalid quantity, overflow, insufficient availability and excessive release.

This slice intentionally does not define PICK/SHIP inventory accounting timing because that transition detail is not yet approved in a higher-order operational policy.

## Verification

- Focused Inventory reservation Jest: 1 suite, 15 tests PASS.
- Backend API build: PASS.
- Isolated Backend API Jest: fresh DB, 39 migrations, 23 suites, 246 tests PASS.
- Isolated database cleanup: PASS.
- No schema, provider, Order, recognition or monetary-rule change.

## Remaining gates

The designated Prisma schema owner must add forward-only Warehouse/InventoryItem/InventoryBalance/InventoryReservation/InventoryMovement persistence. C10 final-unit competition requires real Serializable/concurrency DB proof; these pure domain tests are not that proof. Initial stock count/import and warehouse operational UAT also remain open.

Production Promotion remains blocked.
