# ERP external reference integrity

Migration 119 adds an immutable claim of one external document per projection and ERP connection, scoped across connection versions. Unique database constraints prevent concurrent double claims. Accepted dispatch attempts must match the claimed reference; changing or deleting a claim is forbidden. A different projection receiving the same external reference becomes DEAD with ERP_PROJECTION_EXTERNAL_REFERENCE_CONFLICT and a controlled CRITICAL exception. Concurrent uniqueness/serialization losers retain their durable lease/request and diagnose the conflict on fresh delivery.

Upgrade 118→119 backfills only unambiguous historical accepted references. Existing attempts are unchanged. Conflicting historical receipts remain unclaimed for explicit reconciliation; no external reference is selected arbitrarily.

Verification: migrations 0→119, 162 baseline assertions, 2 suites / 22 tests, cleanup PASS; sequential cross-version duplicate and concurrent duplicate tests PASS. Upgrade preservation/backfill/conflict fixtures PASS. Full DB Golden, backend/API/Worker build, schema/migration/security preflights PASS. Logs `C:/UCell/logs/cr-batch-erp-reference-*20260930.log`.

Bounded interface integrity only. Full ERP four-stream commands, compensation aggregation, Admin UX and whole-batch recertification remain IN_PROGRESS. No live transport or deployment.
