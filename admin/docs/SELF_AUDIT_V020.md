# Admin MVP v0.2.0 Self Audit

## A. DTO / API Alignment

已修正 v0.1.0 中發現的欄位落差：
- Person 使用 `legalName / preferredName / birthDate / mobile / email`。
- Membership Application 使用 `requestedPlanLevelCode`。
- Product 使用 `displayName / price / gpvRate`。
- Order 使用 `qualificationId + items[{productId,quantity}]`。
- Payment Confirmation 使用 `amount / paymentMethod / referenceNo / occurredAt`。

## B. Idempotency

所有受 `IdempotencyGuard` 保護的核心 Command 使用 `command()`：
- Create Person
- Create/Submit/Approve Membership Application
- Create Qualification（Workbench）
- Create Order
- Payment Confirmation
- Active Period
- Subscription create
- Return / Workflow / Payout command 等

`command()` 自動送 `Idempotency-Key`。

限制：
同一UI操作若使用者自行重新點擊，會產生新的key；真正斷線重送策略在Production UX應保留同一operation key。

## C. R1.0B Rule Safety

PASS：
- 不在Frontend計算Referral、Equalization、Binary、Matching、RPV、EPV、Global、K0/K1/K2。
- Binary Placement只做read-only preview，Approve時Backend再次檢查。
- Qualification仍為獨立運算單位。
- Payment後才進PV事件流程。
- Upgrade/Transfer/Exit仍走Workflow。

## D. Backend Companion R2

新增Read Models：
- GET /admin/dashboard/summary
- GET /admin/membership-applications
- GET /admin/qualifications
- GET /admin/orders
- GET /admin/organization/placement-preview

本次自我審查亦發現原Reviewed Backend的 SubscriptionController 有結構性語法錯誤，
已在R2修正，並新增 TypeScript structural parse preflight。

## E. UX

已完成：
- Application Queue + Detail
- New Application Wizard
- Search Select
- Placement Preview
- Qualification List/Detail
- Order Builder
- Payment Completion → PV Ledger
- Real Dashboard summary

仍待：
- Search debounce
- pagination/cursor
- confirmation dialog
- toast
- loading skeleton
- bulk operation
- scanned document attachments
- tree visualization

## F. Security

UI Role Matrix與Route Guard已完成，但只屬UX。
Production仍需：
- Entra/JWT signature verification
- Backend controller-level RBAC enforcement
- session refresh/revoke
- dual approval for finance/high-risk operations
- security test / BOLA / IDOR

## G. Release Verdict

**Admin MVP v0.2.0 = Membership Vertical Slice Complete / Integration-ready / Pre-Production**

可進入真實DEV API聯調與內勤UAT設計，但不可宣稱Production Ready。
