# Shipment confirmation personal messages — local increment

Authority: §33 MSG-1 requires shipment notices through the UCell message experience. Source is the actual verified serial dispatch/delivery confirmation workflow, not the presence of a label or an arbitrary shipment status.

FulfillmentSerialProvenanceService now appends a SHIPMENT-category personal message in the same transaction that confirms serial dispatch or delivery. Existing verified tracking/connection/reference evidence, pack/source allocation and physical-state guards are retained. A shipped notice requires an actual ALLOCATED→SHIPPED serial change; delivery requires verified DELIVERED tracking evidence and an actual fulfillment delivery transition. Direct verified delivery creates only the delivery notice, avoiding simultaneous redundant shipped/delivered notices. Repeated confirmation and old replays do not backfill or duplicate messages.

Audience is the order's saved purchaserPersonId, with no qualification-holder fallback. An order with no saved purchaser produces no inferred recipient. No address, phone, provider reference, tracking number or internal UUID is emitted. Templates are fixed Traditional Chinese with a hashed fulfillment business reference and safe /orders link. Notices do not imply arrival before a delivery proof, nor refund completion. No LINE delivery or external request is created by this producer. Existing source-page authorization remains authoritative.

Verification: API build PASS; four isolated suites / 31 tests PASS, fresh 126 migrations, 162 baseline assertions and cleanup PASS. Real PostgreSQL serial provenance tests prove once-only verified dispatch, person-scoped reads, private-ID exclusion, foreign-person exclusion, no LINE delivery, repeated delivery and both direct/two-step delivery. Missing dispatch proof produces no notice; a conflicting notice rolls back serial/fulfillment dispatch and its confirmation audit. Existing physical returns, source allocation, substitution, shipment/tracking and message tests remain passing.

Evidence: evidence/shipment-member-messages-20261001.json, C:/UCell/logs/cr-batch-shipment-message-focused.log and cr-batch-shipment-message-api-build.log. No schema, migration, API contract or UI changes. No new full API/OpenAPI gate is claimed for this increment; focused checks cover the changed command path and existing shipment/message boundaries. Final frozen whole-batch recertification remains required.

Remaining: broader provider-to-member shipment/source-routing browser acceptance; other required message-domain producers; Compensation overall business-stage history; Operations/Member360 integration and full Learning/Event/Growth/UX acceptance. This increment does not certify all message families or whole-batch readiness.

LOCAL_IMPLEMENTATION = IN_PROGRESS
FULL_ISOLATED_RECERTIFICATION = IN_PROGRESS
STAGE_RC = NOT_READY
