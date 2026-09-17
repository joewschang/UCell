# V1.24 Inventory Reservation Release Batch Report

Status: IMPLEMENTED — COMPENSATING DECISION SLICE
Date: 2026-09-17
Branch: integration/member-backend-mvp

## Scope delivered

- Added deterministic multi-item reservation RELEASE decisions for cancellation/allocation-failure compensation.
- RESERVE and RELEASE batches share one validation, aggregation, ordering and balance lookup pipeline.
- Duplicate release lines are aggregated before checking current reserved stock.
- Any excessive release, empty batch, invalid item ID, missing balance or quantity failure rejects the whole decision.
- Successful release keeps on-hand unchanged, reduces reserved and increases available.
- Results remain stable by InventoryItem ID and input balance snapshots are never mutated.

This slice coordinates Inventory reservation compensation only. It does not connect Payment cancellation, Return POSTED, PICK, SHIP or monetary recognition.

## Verification

- Focused Inventory reserve/release Jest: 3 suites, 25 tests PASS.
- Backend API build: PASS.
- Isolated Backend API Jest: fresh DB, 39 migrations, 25 suites, 256 tests PASS.
- Isolated database cleanup: PASS.
- No schema, Payment Hub, Return, Order, recognition or monetary-rule change.

## Remaining gates

Forward-only Inventory persistence, movement idempotency, transaction/outbox integration and real concurrent DB proof remain with the designated Schema Owner process. Operational policy must still approve PICK/SHIP accounting timing.

Production Promotion remains blocked.
