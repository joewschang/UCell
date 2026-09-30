# §36 canonical substitution closure verification — 2026-09-30

Starting code: 663fe58a234f8fbc8e32e4b14d9c14c0247046b4 (the subsequent progress-only commit does not change runtime).

The new isolated PostgreSQL suite uses STARTER Qualification quantity 3 plus a quarter Repurchase quantity 2 of TIP-777, one packed/bound Shipment and five serialized units. Two units originally allocated to Qualification satisfy the accepted Repurchase ReturnCase. Original fulfillment allocations and physical source rows remain unchanged. Actual RpvService recognition and replayRpvCancellation prove original Award 100 remains immutable, one RPV reversal -1, one entitlement posting -100 and two cancelled future recognition schedules; repeated replay/receipt has no duplicate effect.

Cross-purchaser/same-SKU, same-purchaser/different-order and same-order/shipment/different-SKU cases reject without receipts. Concurrent distinct ReturnCases consuming one substituted unit yield one success and one SERIAL_ALREADY_RETURNED rejection. Existing provenance tests additionally cover recalled/quarantined units, stored opt-out, unshipped units, immutable receipts, quantity concurrency and safe Admin presentation.

| Required §36 invariant | Executable evidence |
| --- | --- |
| SAME_ORDER_SAME_SKU_RETURN_SUBSTITUTION | return-substitution-closure-db: canonical STARTER 3 + quarter 2 |
| RETURN_SUBSTITUTION_PRESERVES_ORIGINAL_PROVENANCE | Same canonical test compares original source/allocation rows |
| RETURN_SUBSTITUTION_USES_RETURNCASE_ECONOMIC_PURPOSE | Repurchase ReturnLine retained while received units originated from Qualification |
| RETURN_SUBSTITUTION_SAME_MEMBER_REQUIRED | Identical SKU from another purchaser rejected |
| RETURN_SUBSTITUTION_SAME_ORDER_REQUIRED | Identical SKU from another order of the same purchaser rejected |
| RETURN_SUBSTITUTION_SAME_SKU_REQUIRED | Different SKU within the same order/shipment rejected |
| RETURN_SUBSTITUTION_ALREADY_RETURNED_REJECTED | Existing provenance rejection and concurrent ReturnCase consumption |
| RETURN_SUBSTITUTION_RECALLED_QUARANTINED_REJECTED | fulfillment-serial-provenance-db parameterized physical-state cases |
| RETURN_SUBSTITUTION_QUANTITY_LIMIT | Existing distinct-unit concurrent receipt bound |
| RETURN_SUBSTITUTION_IDEMPOTENT | Canonical receipt retry and economic replay retry |
| RETURN_SUBSTITUTION_CONCURRENT_SINGLE_CONSUMPTION | Two ReturnCases / one physical unit |
| RETURN_SUBSTITUTION_ERP_PHYSICAL_FACTS_PRESERVED | Exact accepted serials/SKU and original physical source remain stored; outbound ERP Return stream remains a separate implementation gap |
| RETURN_SUBSTITUTION_ECONOMIC_RECOVERY_CORRECT | Actual RPV recognition/cancellation/replay integration described above |

## Verification

- New plus existing provenance and partial-return suites: **3 suites / 26 tests PASS**, fresh **0→113 migrations**, **162 baseline assertions**, cleanup PASS.
- Log: C:/UCell/logs/return-substitution-closure-final-20260930.log.
- Independent unchanged baseline: **159 suites / 1,177 tests PASS**, 113 migrations, 162 assertions, cleanup PASS. Log: C:/UCell/logs/cr-batch-baseline-20260930.log. This run discovered suites before the new test file existed and does not include its five tests.
- Backend packages/API/Worker build PASS; Admin **42 files / 157 tests**, Member **31 files / 175 tests PASS**.
- Source review: only synthetic test fixtures and governance evidence change; no new runtime writes, transport, migration or Stage/Production action.

Physical substitution and linked economic recovery are locally verified. Four-stream ERP Return delivery/reconciliation remains under §35 and prevents claiming overall Fulfillment/ERP batch closure. Full-batch implementation and Stage readiness remain IN_PROGRESS / NOT_READY.
