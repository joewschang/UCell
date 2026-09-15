# Vertical Slice 01 — Person → Qualification → Order → Payment → GPV

## 已實作

1. Person
   - 建立
   - 查詢
   - 搜尋
   - Idempotency
   - Audit

2. Qualification
   - 建立 Qualification
   - Holder History
   - Sponsor Relationship
   - 永久 Sponsor Sequence
   - Binary Placement
   - Binary Slot 檢查
   - Binary Cycle 檢查
   - 第1/3直推左子樹規則
   - Audit
   - Serializable transaction

3. Product Reference / Rule Profile
   - Pre-ERP 商品Reference
   - 交易當下價格、GPV Rate、Rule Version Snapshot

4. Order
   - Qualification-bound
   - Server-side pricing
   - GPV snapshot per line
   - Referral token hash
   - Confirmed order

5. Payment
   - Idempotent manual confirmation
   - Exact amount check
   - Append-only Payment Event
   - Order PAID projection
   - Transactional Outbox SALE_CONFIRMED
   - Audit

6. Worker
   - Poll SALE_CONFIRMED
   - Create GPV_CREATED per Order Line
   - Unique key guarantees retry safety
   - Mark Outbox PROCESSED / retry / DEAD

7. Ledger
   - GPV ledger query
   - Balance aggregation
   - PostgreSQL append-only trigger

## 下一個Slice

Vertical Slice 02:
- Membership Application
- Qualification approval workflow
- Active periods
- Repurchase Subscription 3/6/12
- Monthly Recognition
- RPV 5/8/12 depth
