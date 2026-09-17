# B1 Core review corrections

Status: corrections implemented and verified; resubmitted to Core, not yet approved for merge.
Original submission: `ae71939a498a0183474e531295d8100d12a2d536`.
Current integration base: `d5bcfb648c146d1e3946b869052b6b2b4271598e`.
Branch: `feature/commerce-fulfillment-b1-contracts`.

Commerce's original submission and correction commit were rebased onto d5bcfb6. The three Inventory release-batch files in that baseline remain Core-authored and unchanged by Commerce. No schema/migration, Inventory implementation, Order, ReturnService, Worker, monetary logic, provider enablement or UI modification was made.

## Requested corrections

| Core request | Implemented behavior | Evidence |
|---|---|---|
| Do not freeze unresolved QC/label sequencing | Required checks come from a backend policy snapshot with ID/version; evidence must match that policy. Missing/empty/unknown/duplicate policy checks fail closed. LABEL is mandatory only when the supplied policy requires it. No default operational policy is installed. | Tests cover with/without LABEL, missing required checks, policy/version mismatch and missing/invalid policy. |
| Make RMA POSTED canonical boundary explicit | Port renamed to `postReceivedRmaAtCanonicalBoundary`; input requires RECEIVED status, received evidence and Core-approved posting/allocation references. Output requires POSTED status. Only Core implements its validation, persistence and reversal. | Type-level negative tests reject APPROVED-only input, RECEIVED without receipt and APPROVED output; compiled by ts-jest. No Core function is called. |
| Reject orphan operation claims | Existing operation is now a COMMITTED/INCOMPLETE claim with operation identity/hash and committed effect/state/outbox references. Incomplete/missing references fail closed on both replay and new-observation NOOP paths. Wrong identity/hash conflicts. | Tests cover each missing reference, explicit INCOMPLETE, legacy bare hash, wrong identity, complete callback/query NOOP and delivery-without-operation. |

Complete references express the persistence contract; Core must verify those actual records under one transaction. The pure helper cannot prove a DB commit. Outbox intent does not imply the downstream provider or recognition workflow succeeded.

## Exact correction runtime/test delta from ae71939

1. `backend/apps/api/src/modules/commerce/contracts/fulfillment.ts`
2. `backend/apps/api/src/modules/commerce/contracts/core-boundary.ts`
3. `backend/apps/api/src/modules/commerce/contracts/rma.ts`
4. `backend/apps/api/src/modules/payment-hub/provider-event-decision.ts`
5. `backend/apps/api/test/commerce-contracts.e2e-spec.ts`
6. `backend/apps/api/test/provider-event-decision.e2e-spec.ts`

The full Commerce slice still changes 20 runtime/test files versus d5bcfb6; exact file lists/hashes and governance delta are in revision-evidence.json. Differences from ae71939 also include the three inherited Core baseline files, separately identified in that manifest.

## Final verification on d5bcfb6

| Gate | Result |
|---|---|
| API build | PASS, direct existing Node/Nest binaries |
| Focused contract Jest | PASS, 6 suites / 73 tests |
| Full isolated API Jest | PASS, 26 suites / 288 tests |
| Existing migrations from zero | PASS, 39 migrations |
| Test database cleanup | PASS |
| DB regression assertions | PASS within full suite; revision-db-regression.json copied from this run |
| Protected scope diff | Empty against d5bcfb6; no schema or monetary implementation edits |
| Git whitespace check | PASS after normalizing log trailing whitespace; raw log hash retained |

A first focused compile detected TypeScript array narrowing in the QC policy predicate; the explicit QcCheck type fixed it before these final PASS runs. No final test failures remain. Existing dependency junctions were reused; no package/lockfile changes or Prisma generation were performed. The test-generated historical governance file was preserved as revision evidence and restored to its baseline afterward.

No new HTTP/DB persistence path is implemented by these fixes. New provider HTTP/BOLA, real payment/stock concurrency, the full 20 Commerce Golden journeys, official provider verification, provider Mock, Sandbox/UAT and production remain unverified/unimplemented as previously reported. Schema/API proposal amendments are in SCHEMA_API_DELTA.md. This resubmission does not authorize schema work or provider enablement.
