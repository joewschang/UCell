# Fulfillment delivery and Shipment registration evidence

This is implementation evidence for approved scope, not new business authority. Batch implementation remains IN PROGRESS and Stage RC remains NOT READY.

## Implemented behavior

- Warehouse operators explicitly capture HOME_DELIVERY recipient requirements in immutable, encrypted, versioned Fulfillment snapshots. The existing PII crypto implementation is shared by API and Worker. Read models, audit and Outbox contain metadata only. No current member profile is inferred as a historical order recipient.
- Optimistic version checks reject conflicting concurrent edits. A delayed retry of an earlier saved version returns its original result and the current version without reverting newer data; the Admin form retains the version at which editing began.
- An approved logistics connection and explicit package/label inspection allow registration of an already-created external logistics label. The existing Shipment/parcel/QC aggregate and exact serial bindings are committed atomically. Retry creates neither another Shipment nor another audit. LABEL_CREATED is not physical dispatch.
- Shipment creation or ERP dispatch pins the delivery snapshot. New ERP requests hash the delivery reference together with immutable physical content. Only an approved adapter's submit receives decrypted delivery requirements; lookup and stored handoff remain safe metadata.
- Before ERP submission, locked physical allocations, source quantities, product identity, serial eligibility and batch expiry are revalidated. Recalled, expired or already-shipped units cannot be newly submitted. Already-accepted provider lookup results can be reconciled without another submission.
- Migration 106 adds immutable delivery snapshots and nullable references for historical Shipment/ERP dispatch rows. Existing records receive no invented recipient or request hash; legacy incomplete dispatches fail closed.

## Validation

- Isolated affected PostgreSQL regression: 7 suites / 44 tests, 162 baseline assertions, fresh 0→106 and cleanup PASS. Covers HTTP RBAC, concurrent register/capture, delayed address replay, encrypted persistence, no PII read/audit/Outbox exposure, provider submission eligibility and lease fencing.
- Admin typecheck/build and 35 files / 130 tests PASS, including retained input/version on retry, approved logistics selection and missing-configuration recovery.
- API/Worker/database builds, migration/relation/enum preflights PASS. Existing DB Golden and isolated 105→106 preservation/cleanup PASS; legacy Shipment/dispatch/result/return evidence remains unchanged.
- Final frozen-code pinned OpenAPI governance PASS: 141 suites / 970 tests, 162 baseline assertions, fresh 0→106 and cleanup. The baseline is unchanged.

## Remaining work

Verified carrier tracking ingestion/projection, broader ERP/Operations health and drilldowns, actual-browser UX acceptance and the other expanded batch slices remain executable work. Actual EzTooL transport still requires real provider specifications and credentials; no live transport or deployment was invented or enabled.
