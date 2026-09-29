# ERP dispatch reliability checkpoint

The existing Worker loop now polls physical ERP handoffs through an explicit adapter registry and the existing Outbox lease/fence mechanism. The deployed registry remains empty until real protocol and credential enablement is available; pending requests are never acknowledged by a placeholder transport.

The provider-neutral boundary supports EzTooL and Dynamics 365 BC without introducing either vendor's unverified HTTP protocol. A dispatch pins an approved immutable ProviderConnectionVersion and one stable idempotency key. Every execution performs authoritative lookup first. Only an explicit absence permits submission with that same key; unknown results and exceptions never trigger a blind resubmission. Adapter IO is bounded, and late/stale workers cannot commit an acknowledgement after losing their lease. A recovered worker can look up previously accepted work and commit its receipt without sending again.

Migration 104 adds append-only dispatch binding and attempt evidence, plus the ERP domain in existing provider configuration. PostgreSQL rejects unapproved/non-ERP bindings. Acceptance is committed atomically with Outbox acknowledgement. Invalid or mismatched receipts require review; exhausted unknown attempts stop and create a deduplicated operational exception. Raw adapter response bodies/errors are not persisted. This is request acceptance, not proof of physical shipment or financial entitlement.

The production polling boundary reuses official provider enablement manifest validation and checks the exact database connection version/configuration. Synthetic adapters in isolated tests establish engineering behavior only. They do not certify a real provider, authorize Stage deployment, or turn missing EzTooL specifications into an invented integration.

Admin warehouse staff can see acceptance state and request re-evaluation of a stopped handoff. Concurrent requests queue one retry and audit, preserving the original request, connection, key and attempt history. Audit roles remain read-only. The worker still looks up acceptance before any retry submission.

## Evidence

Focused isolated dispatch/reconciliation tests established concurrent lease exclusion, append-only evidence, ambiguous-send recovery, no send after unknown lookup, invalid receipt rejection, stale completion fencing, approved connection checks and unconfigured no-op behavior. Final full API/OpenAPI/upgrade counts are recorded in Implementation Progress.

`node backend/scripts/fulfillment-erp-upgrade-golden.mjs --dispatch` checks upgrade from migration 103 with pre-existing handoff, source, serial and reconciliation rows. It verifies historical equality and that migration 104 invents no transport acceptance.

Delivery requirements, normalized transport result ingestion, Shipment/return serial provenance and actual-browser UX remain open. No live ERP call or deployment occurred.
