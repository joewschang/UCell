# V1.25 Inventory Operation Idempotency Contract

Date: 2026-09-17  
Scope: Backend/Core Inventory Lite pure decision boundary

## Implemented

- Canonical RESERVE/RELEASE command with warehouse, source and idempotency context.
- Duplicate item lines are aggregated and sorted before SHA-256 operation identity is produced.
- Retries return `NOOP_REPLAY` only when the persisted claim has the same hash and complete movement, balance and outbox evidence references.
- The persisted claim also carries a hashed result snapshot. Lost-response retries return that committed result without recalculating against already-changed balances; tampered or command-mismatched results fail closed.
- Reusing an idempotency claim for a different operation fails closed.
- Missing context, invalid runtime operation type and incomplete/orphan claims fail closed.
- The boundary remains pure. Its caller must lock balances in canonical item order and atomically persist movements, balances, operation claim and outbox intent.

No schema, migration, HTTP API, monetary rule, Commerce-owned runtime file or Member/Admin UX file changed in this batch.

## Verification

- Inventory focused Jest: 4 suites / 33 tests PASS.
- API TypeScript build check with `--noEmit`: PASS.
- Normal Nest build attempt was blocked by the running local API holding `dist` files (`EPERM`); this is an environment lock and is not recorded as a build PASS.
- Full isolated API regression was attempted twice. Both runs applied all 39 migrations from zero, then the legacy replay helper was denied writing its evidence JSON (`EPERM`) in this execution sandbox, including when redirected to a new file. This is recorded as environment-blocked, not PASS.
- Git whitespace check: PASS.

## Remaining

- Add forward-only Inventory Lite persistence only after the reviewed Commerce contract is selected for integration.
- Validate real serializable concurrency, atomic movement/balance/outbox writes, retry after lost response and rollback on partial failure.
- Production provider, warehouse, QC and ERP policies remain blocked until approved configuration and UAT evidence exist.
