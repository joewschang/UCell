# Operations fulfillment integrity candidates — 2026-09-29

Continues `96eb658` on the local integration branch. The existing Operations invariant read now checks recent fulfillment source allocations for:

- an order-line source belonging to a different order, or an SKU snapshot inconsistent with that order line;
- serials bound to another fulfillment or to a different physical product;
- more bound serials than the allocated quantity;
- a durable ERP handoff whose bound serial count does not equal its allocated quantity.

Incomplete scanning before an ERP handoff is normal and produces no shortage candidate. Checks compare immutable order snapshots and linked physical product identity rather than current catalog display data.

Results retain the existing candidate shape and deterministic ordering. References use order number, fulfillment key and SKU; internal source IDs are hashed into the evidence identity but are not returned. Inspection does not update source allocations, serial bindings, handoff evidence or outbox state, and does not automatically create or resolve exceptions.

The scan uses the endpoint's existing bounded `take` behavior (up to 200 recent source allocations). It is not an exhaustive historical audit. Company-to-Reservoir-B reconciliation, additional broken-lineage checks and external ERP shipment-result reconciliation remain separate unfinished scope.

Real PostgreSQL regression fixtures cover valid/in-progress allocations, a handoff missing serials, wrong-product and cross-fulfillment bindings, excessive scans, incorrect order/SKU sources, deterministic results, internal-ID exclusion, and unchanged source evidence. Final validation counts are recorded in the batch progress report.

Full-suite verification exposed an existing ERP scan test that counted handoff events across the entire shared test database. Its assertion now scopes the count to that fixture's fulfillment, preserving the exactly-once expectation while allowing independent scenarios to coexist.

Final evidence: API build PASS; focused **7 tests PASS**; full isolated API **133 suites / 914 tests PASS**, **162 real-DB assertions**, fresh **0→102 migrations**, and cleanup PASS. Log: `C:/UCell/logs/operations-full-api-20260929.log`. No new migration or Stage/Production deployment.
