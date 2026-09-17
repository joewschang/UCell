# V1.26 Inventory Persistence Concurrency Evidence

Date: 2026-09-17  
Scope: real PostgreSQL Inventory Lite reservation concurrency

## Verified behavior

- Two concurrent deliveries with the same idempotency key produce one APPLY and one replay result.
- A later lost-response retry returns the committed result without another reservation, movement, claim or balance mutation.
- Two different orders competing for insufficient shared stock are serialized; exactly one succeeds and the other fails with `INVENTORY_INSUFFICIENT_AVAILABLE`.
- The committed balance retains `available = onHand - reserved`, one reservation, and one balance version increment.

The test uses the existing serializable persistence service and real PostgreSQL rows. It does not use an in-memory concurrency mock and does not assert Production readiness.

## Validation

- `inventory-persistence-concurrency-db.e2e-spec.ts`: 2/2 PASS.
- API TypeScript no-emit compilation: PASS.
- Git whitespace validation: PASS.

No schema, migration, Payment Hub, monetary calculation, Member/Admin UX or provider configuration changed in this batch.
