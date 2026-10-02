# Physical ERP reconciliation checkpoint

Authority: scope decision §DC-10/11; this checkpoint does not close the full batch.

The controlled warehouse result endpoint records actual SKU/quantity/serial reports against the immutable handoff snapshot. Exact sets match; exact subsets remain partial; unknown SKU, excess/inconsistent quantity, wrong or duplicate serials create mismatch evidence. Repeated same-SKU source lines are aggregated without changing their stored purpose or source allocation. ERP results do not authorize financial effects or claim that a Shipment exists.

Each fulfillment is locked while recording. Same result key and normalized content replay one result and one audit; changed content under that key is rejected. Partial/mismatched results create deduplicated Operational Exceptions. Results, handoffs, source allocations and serial bindings have append-only database protection. Existing facts are preserved; no historical result is inferred.

Admin Order Operations can enter actual reports and view the most recent 50 outcomes. Audit users can read only. Report inputs start empty, retain values and request identity after a failure, and use Chinese feedback. The HTTP boundary binds fulfillment to order and validates nested input; it does not disclose member IDs or internal source identifiers.

## Verification

- Fresh migration 0→103 and 162 baseline real-DB assertions; focused fulfillment HTTP/concurrency tests passed.
- `node backend/scripts/fulfillment-erp-upgrade-golden.mjs`: deploys 102 migrations into a disposable local database, seeds a pre-existing handoff/source/serial, deploys the new migration, verifies exact historical equality and append-only guards, and cleans up. PASS.
- Isolated database Golden PASS, including commerce, recognition, return/replay, Member authorization and historical snapshot checks.
- Admin typecheck/build and 34 files / 125 tests PASS, including actual report entry and same-key retry.
- Full API/OpenAPI governance verification recorded in implementation progress after completion.

## Remaining work

This is controlled Admin evidence entry, not verified live EzTooL transport. Provider-neutral dispatch/retry/reconciliation wiring, exact Shipment/return serial provenance, delivery requirements, stale-handoff monitoring and actual-browser UX acceptance remain executable work. Only real EzTooL protocol/credentials remain external. A matched report does not mark Fulfillment/Order shipped or release a serial for reuse. No Stage or Production deployment occurred.
