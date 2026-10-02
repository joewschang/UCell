# Shipment and returned-unit provenance checkpoint

Authority: §DC-11 and the expanded completion directive. Migration 105 adds minimal append-only edges from existing FulfillmentSerialAllocation to existing Shipment, then from that binding to existing ReturnLine. Original OrderLine, Offering and Purpose remain accessible through the immutable source allocation; no replacement Shipment, Return or economic ledger is introduced.

Binding requires the same fulfillment, exact serial-pack evidence and the parcel's matching content snapshot. Each physical allocation can bind once. A label or ERP acceptance does not make a serial shipped: the command requires persisted matching carrier evidence/state transitions before reflecting dispatch. Subsequent replay can apply newly available dispatch evidence once, and returned units are never reset to available stock.

Receiving a return requires an existing POSTED ReturnCase belonging to the original order, a matching ReturnLine, original Shipment binding, verified dispatch provenance and an eligible physical unit. Fulfillment, return-line and unit locks serialize concurrent receipts. Both the service and database prevent quantities exceeding the accepted line. Repeating the same returned unit replays one receipt; a different return cannot claim it again. Receipt processing does not create/change ReturnCase amounts, recognition, awards, recovery or payable authority.

Database guards preserve binding/receipt history and reject retargeting a bound Shipment, Fulfillment or OrderLine, or rewriting a physically received ReturnCase/ReturnLine. Migration never infers historical serials from old shipment or return statuses.

Warehouse APIs and Admin use order-bound opaque references and scanned business serials. Audit users can inspect evidence but cannot bind or receive. Provider credentials, purchaser IDs and internal source IDs are absent from these views.

## Verification

Focused isolated fulfillment coverage passed **7 suites / 39 tests** before the final added different-unit concurrency case. Admin typecheck/build and **34 files / 127 tests PASS**. Final frozen-code API/OpenAPI, fresh migration, historical upgrade and Shipment persistence checks are recorded in Implementation Progress.

`node backend/scripts/fulfillment-erp-upgrade-golden.mjs --serial` deploys migration 104 with historical Shipment/Return/ERP/source rows, applies 105, and checks that old facts are unchanged and no historical serial edges were invented.

## Still open

This checkpoint connects existing Shipment and accepted Return authorities. It does not yet provide the complete warehouse Shipment creation/delivery-snapshot journey or live tracking transport. Delivery requirements and Shipment creation are next executable work, followed by the remaining expanded batch. No Stage/Production deployment or full-batch readiness claim.
