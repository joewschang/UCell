# Verified Shipment tracking Worker

Scope: provider-neutral ingestion of verified logistics evidence through the existing Inbox worker, without a live carrier transport or deployment.

The shared shipment decision boundary is moved into `@ucell/database` and re-exported through the existing API module. Existing state-transition semantics are preserved. The Worker registers exact logistics adapters only; the registry remains empty until a real adapter and approved provider configuration are supplied.

The handler checks the persisted verification evidence, provider/connection/version and adapter digest before applying normalized facts. The official enablement manifest must agree with the pinned database version, environment, approval and credential references before polling. Adapter IO is bounded; the Inbox lease is rechecked and locked after IO, then the Fulfillment and Shipment are locked in their normal order.

One transaction persists append-only tracking evidence, an allowed state transition, safe Outbox intent and immutable operation claim. Concurrent/repeated delivery has one effect. Older facts remain evidence without regressing status. Conflicting event identity, unmapped status and invalid transition retain reconciliation evidence and fail closed. Transaction failure rolls back the whole effect, allowing safe retry.

Verified physical dispatch updates exactly bound serials and Fulfillment state. Recalled or otherwise ineligible serial controls remain intact and produce an exception; a carrier's physical observation is retained independently. Carrier return status does not create an accepted ReturnCase, consume return entitlement, mark serial receipt or alter economic authority. Outbox payloads omit private evidence, recipient information and internal source IDs.

Focused isolated PostgreSQL evidence: 3 suites / 28 tests, fresh 0→109 migrations, 162 baseline assertions and cleanup PASS. Includes concurrency/replay, stale events, expired lease after adapter response, unverified/foreign/digest mismatch, pinned-version mismatch, unknown/invalid mapping, recalled unit, atomic rollback/retry, actual Inbox claim/finalization runner and carrier-return separation. Database/API/Worker builds PASS. No migration or public HTTP contract change.

Full frozen-code isolated API regression PASS: 153 suites / 1,155 tests, fresh 0→109, 162 baseline assertions and cleanup. OpenAPI/security preflights PASS. Logs: `C:/UCell/logs/shipment-tracking-focused.log` and `C:/UCell/logs/shipment-tracking-full.log`. Actual carrier transport/certification remains unverified; no engineering fixture is represented as official provider evidence. Remaining payout, period orchestration, Operations, Learning/Event/Growth and actual-browser UX work stays open; Stage RC is NOT READY.
