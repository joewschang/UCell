# ERP business projection foundation

Bounded §35 implementation evidence. Overall CR-BATCH-01 and four-stream ERP acceptance remain IN_PROGRESS; Stage NOT_READY.

Migration 118 adds immutable provider-neutral Sales/Return/Compensation projection evidence, independent drillback snapshots/hashes, durable Outbox links, pinned dispatch identities, append-only attempts and reconciliation storage. These are interface evidence, not accounting journals, inventory costing or tax calculations. Database guards require exact projection/Outbox identity, approved source status, request-hash consistency and approved ERP connection. Compensation dispatch with no accounting mapping fails with ERP_ACCOUNT_MAPPING_REQUIRED.

Sales projects only paid authoritative Order/Line snapshots. Return projects only a POSTED ReturnCase and its accepted lines, separately exposing any physically received serials. Neither writer changes source transactions, recognition, Recovery, inventory or Shipment. Stable business references and allowlisted payload fields keep person/actor/source UUIDs and private detail out of external payloads; detailed internal source links remain in the protected drillback snapshot. Repeated and concurrent requests reuse the original projection and one Outbox; sealing failure rolls back both.

The existing Worker loop now includes a separate empty, explicitly configured business-ERP adapter registry. Dispatch pins connection/version, hash and idempotency key, performs authoritative lookup before submit, never submits after unknown lookup, and fences completion with the existing Outbox lease. Ambiguous submissions retry the same key; accepted external evidence can recover without another submit. Raw adapter errors are replaced by fixed safe codes. Rejected/wrong-request acceptance creates a controlled exception. Acceptance does not imply reconciliation, shipment or UCell payment.

No live adapter, credentials, account mapping or deployment was added. This slice does not yet expose Admin commands, compensation aggregation, general reconciliation commands, duplicate external-reference handling or four-stream UI; those are the next internal work items.

## Verification

- Fresh PostgreSQL migrations 0→118, baseline 162 assertions, focused 2 suites / 20 tests and cleanup PASS, including existing physical ERP dispatch regression.
- Upgrade 117→118 preserves original Order/Lines, accepted Return/Lines, Fulfillment, existing physical ERP handoff and Outbox exactly; new Sales/Return projection and immutable guards PASS.
- Complete DB Golden, backend/API/Worker build, schema/migration/security preflights PASS.
- After the reported power outage, Git connectivity and worktree state were checked; committed HEAD still matched origin. Docker/local PostgreSQL were restarted without changing stored data. Tests/upgrade/build above were rerun after the database became ready. Initial upgrade-fixture failure (missing retail purchaser) was fixed; startup-only failures are not counted as passing evidence.

Logs under `C:/UCell/logs`: `cr-batch-erp-projection-post-outage-tests-20260930.log`, `cr-batch-erp-projection-upgrade-20260930.log`, `cr-batch-erp-projection-db-golden-20260930.log`, `cr-batch-erp-projection-post-outage-build-20260930.log`, and schema/migration/security logs with the same prefix.
