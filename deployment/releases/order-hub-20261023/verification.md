# Order tracking and reviews — 2026-10-23

Account page now contains five icon links with red nonzero order counts: payment, shipping, receiving, review, all orders. Counts include the complete authorized history; lists paginate 20 rows, search by order number/product name and preserve filters in the URL. Order route belongs to the My Account navigation section. Zero counts hide the bubble; counts above 99 display 99+ with the exact count in the accessible label.

Classification uses recorded payment and ERP/logistics facts. All non-cancelled batches must be delivered; existing non-cancelled shipment facts take precedence over a batch's delivered status. Partially delivered orders remain receiving. Returns/refunds/voided orders are visible under all orders and not reviewable. FULFILLED alone is not delivery proof. No member confirmation mutates logistics or accounting.

Reviews are private order-level 1–5 stars with optional 1,000-character text, authenticated/authorized, server delivery-gated and stored in a dedicated table with foreign keys, rating/text checks and a unique order/member key. Existing reviews are displayed in order details. No public publication, notifications, payment or settlement changes. Idempotency and order locking protect retries; server retains an identical existing review and rejects conflicting repeat submissions. Audit records rating without the text.

API image: `sha256:8f8157f3bf51b88d40c18bba1be1ea15f2970eccfe0cb8d34edbc0d8aabb508a`, revision `ucell-prod-api--order-hub-20261023`.
Member image: `sha256:d430069cef555f5d4f0db4b17ff7edb5075370e0f2cbbb0e231423b0b77402a9`, revision `ucell-prod-member--order-hub-20261023`.

API additive overlay preserves prior live module content and adds only the new controller/service/state helper. Prisma client regeneration is not required at runtime: review table access uses parameterized queries. Migration `20261023100000_member_order_reviews` applied transactionally and recorded with SHA-256 in Prisma migration history. Source Prisma model validated.

Validation:
- Backend: 3 focused tests pass (classification including partial delivery/refund, ownership/delivery gate, 121-order exact counts and pagination).
- Frontend: 15 navigation, 6 connected account, 2 existing order layout, localization and cart tests pass. TypeScript and Nest builds pass.
- Browser: 390px/1280px; five badges, filtered navigation, logistics, disabled unrated submit, failed request retry using same key, review saved/displayed, badge decrease to zero, search, no page errors or horizontal overflow. Mocked APIs, no real writes. Fixed old global `nav`/`span` CSS collisions uncovered by browser QA.
- Live transaction verification: real MemberService authorization, unauthorized order rejected, undelivered order rejected, review persisted/read, duplicate protected, exact counts and badge decrement. All test orders, fulfillment and review records rolled back. No payment created.
- Unauthenticated order-hub request returns 401.
- Production build script validates LINE/Google client configuration; member image inherits the latest product photographs.

Design references: https://help.shopee.tw/portal/4/article/79971?seo=1 (status-based order navigation); https://rules.momo.com.tw/standard/00012/ (reviews after delivery). Screenshot evidence outside Git: `C:/UCell/order-hub-20261023/`.
