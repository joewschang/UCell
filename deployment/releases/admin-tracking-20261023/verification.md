# Admin order tracking — 2026-10-23

Route: `/order-tracking` under 商務. Eight order-level status filters, exact counts across the current order history, search, 20-order pagination, payment and delivery separation, per-parcel event history, private member reviews, links to existing payment and fulfillment operations. Responsive layout uses shared light/dark theme tokens.

CSV v1 is specified in `Docs/order-tracking-import-v1.md`. Admin download assets include a UTF-8 CSV header template, an Excel text-formatted preparation workbook, and the specification. XLSX is a preparation aid; upload accepts UTF-8 CSV. Limits are 500 events / 256 KiB. The schema deliberately updates registered shipments only, without creating orders/shipments or changing payment, refunds, stock, or compensation.

Preview performs no writes, reports row errors and proposed transitions, and binds a hash to the current shipment states. Commit revalidates under fulfillment/shipment locks, serializes import event IDs, rejects changed previews or any invalid row, and writes canonical shipment evidence, transitions, state, and an audit record in one transaction. Identical files replay their committed result. Same source-event identity with different content is rejected. State progression reuses the existing shipment state machine. Dates require a real calendar date and explicit timezone.

Read: SUPER_ADMIN, ORDER_OPS, FINANCE, COMPLIANCE_AUDIT. Import: SUPER_ADMIN, ORDER_OPS. Actor, role, time, file hash, source event, and changed status are retained in audit records. The list displays no member identity data.

## Validation

- 11 backend tests pass: UTF-8 BOM/quoted CSV/leading zero, malformed headers/quotes/size, identifier and formula restrictions, timezone and real calendar dates, chronological transitions, unknown shipments, invalid jumps, duplicate/conflicting events, preview changes, persistence/replay, and finance read-only authorization.
- API build and admin TypeScript check pass.
- Production admin asset build passes Entra/login/API endpoint configuration checks.
- Browser QA passes desktop 1440px and mobile 390px, error-preview write blocking, explicit commit success, and event history, with no page errors or horizontal overflow. Light and dark appearances were inspected. QA used API fixtures; logos are supplied by the preserved production base image.
- Final API image was tested against the production database in an outer rollback transaction. A temporary provider configuration, QC evidence, parcel, and order were used to exercise three real status events. Preview, commit, replay, event/transition persistence, timeline, member REVIEW classification, and unchanged payment events all pass. Temporary rows were rolled back and order absence verified.
- The database test exposed an advisory-lock void-deserialization issue; the final implementation casts the lock result to text. Fixture constraints were corrected before the successful final verification.
- Public unauthenticated tracking API request returns 401.

## Deployment

API: `sha256:900a1f2de792980d9265776b3b325d182950250f3850d3bd4f6bfdedc7ab0818`, revision `ucell-prod-api--admin-track-v3-20261023`.

Admin: `sha256:8acb4ce321b8ada6273f52b1e9a5692ded2bda095dfc389887462e8a68e998f7`, revision `ucell-prod-admin--admin-tracking-20261023`.

The API overlay adds only the tracking controller/service/parser and registers them in the extracted live order module, preserving unrelated compiled production fixes. No database migration or Prisma regeneration is required. The frontend overlay preserves existing public assets. Member and public website images are unchanged.

Rollback bases: API `sha256:8f8157f3bf51b88d40c18bba1be1ea15f2970eccfe0cb8d34edbc0d8aabb508a`; admin `sha256:7fe0e2cf61c3a317696675eef4aae8815dcac8fdab8cb1c74f1beb9eae7fb0a3`.

No real external shipping file was supplied or imported. Actual imports must reference registered shipments and use the documented codes; unknown mappings are rejected with a preview explanation.

Final public checks: admin route, CSV template, format guide, and XLSX preparation workbook all return HTTP 200. The served HTML references the new bundle, which includes the tracking endpoints. Both final API and admin revisions are Healthy/Running and receive 100% traffic.

