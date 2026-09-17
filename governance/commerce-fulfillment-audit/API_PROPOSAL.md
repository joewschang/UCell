# API / OpenAPI proposal

未實作、未凍結；以 `/api/v1`、existing success envelope / top-level error 相容。`openapi.proposal.json` 是 Commerce API draft，不覆蓋 `backend/openapi.generated.json`。existing Member checkout/package APIs 由 Member/Core Owner 維護。

Closing delta 新增 payment-hub 已讀；CAPTURED/PAID/REFUND_PENDING 與本提案的 alias 策略有差異。所有 status / interface 提案待與該 writer 合併凍結；不得單方面修改。見 CLOSING_DELTA.md。

## Shared contract

- Internal IDs 為 UUID；金額/數量 decimal string，quantity>0；server owns price/recognized values、provider config、order ownership。
- Authenticated mutation：Idempotency-Key 必填；不同 payload 同 key -> 409 IDEMPOTENCY_CONFLICT。Auth/ownership 必須在 replay response 前驗證，避免從 idempotency cache 越權讀資料。
- Member accesses owned order；package Person snapshot / existing Qualification ownership 的歷史轉移存取政策須 Core 定義，不能以任意 qualification query 欄位繞過。
- Admin action method-level permission；warehouse/bin operational scope 另外驗證，僅 role 名稱不足。
- Lists limit 1..100 + opaque cursor，stable order `(createdAt,id)`；invalid UUID/filter/quantity -> 422。foreign/missing resource -> 404（或沿既有明確 403 合約），不可洩漏另一會員收件資料。
- Successful response `{data,meta:{request_id,timestamp,api_version,replayed?}}`；error `{code,message,details?,request_id,timestamp}`。新增錯誤含 PAYMENT_EVIDENCE_INVALID、PROVIDER_CONFIGURATION_PENDING、STOCK_INSUFFICIENT、SERIAL_ALREADY_ASSIGNED、SKU_MISMATCH、LOT_EXPIRED、QC_NOT_PASSED、CORE_CONTRACT_PENDING。
- Provider callbacks 不用 member/admin bearer，必須經 connection-specific cryptographic verification、body size/replay 限制與 durable inbox。原始 body 僅 transient。驗證失败不消耗合法 event identity；invalid callback 只記安全拒絕證據。正確 duplicate ACK 不再施加效果。
- Browser return route 僅 refresh payment status，沒有「mark paid」API。raw provider ACK encoding/status 在 Adapter 內轉換；OpenAPI 的 normalized ingestion result 是內部邊界，provider 真實 wire format 待 B2/B6/B7 契約。

## Proposed routes by batch

| Batch | Method / path（省略 /api/v1） | Permission / body / result |
|---|---|---|
| B2 | POST member/orders/{orderId}/payments | MEMBER owner；configured connection ID；server amount -> PENDING + safe redirect |
| B2 | GET member/orders/{orderId}/payments | MEMBER owner；canonical status，不含 provider secrets/raw payload |
| B2 | POST integrations/payments/{connectionId}/webhook | verified ingress；一個 canonical PAID effect；實際 wire schema 待 merchant docs |
| B2 | POST admin/payments/{paymentId}/query | PAYMENT_RECONCILE；verified query -> stored evidence |
| B2 | POST admin/payments/pos-evidence | PAYMENT_OPS；order/terminal/batch/transaction/amount/time -> PENDING_RECONCILIATION |
| B2 | POST admin/payment-reconciliations | PAYMENT_RECONCILE；connection/date/batch -> reconciliation job |
| B2 | GET admin/payment-reconciliations/{reconciliationId} | PAYMENT_RECONCILE/AUDITOR；differences + masked evidence |
| B2/B9 | POST admin/payments/{paymentId}/refunds | PAYMENT_OPS + approved refund evidence；不以 FINANCE 或 AUDITOR 自動授權 |
| B3 | GET admin/inventory/balances | WAREHOUSE_SUPERVISOR/INVENTORY_ADJUST/AUDITOR；warehouse/item filter |
| B3 | POST admin/inventory/receipts | INVENTORY_ADJUST；count/lot/serial evidence -> movement |
| B3 | POST admin/inventory/reservations | WAREHOUSE_SUPERVISOR；paid order + warehouse + policy；backend derives lines/qty |
| B3 | POST admin/inventory/reservations/{reservationId}/release | WAREHOUSE_SUPERVISOR；reason；僅未 ship 數量 |
| B3 | POST admin/inventory/adjustments | INVENTORY_ADJUST；reason/approvalRef/delta；domain audit |
| B4 | GET admin/warehouse/fulfillments | PICKER/QC/SUPERVISOR；bounded status queue |
| B4 | GET admin/warehouse/fulfillments/{fulfillmentId} | warehouse scope；order/sku/name/required/scanned/remaining/lot/serial/expiry |
| B4 | POST admin/warehouse/pick-tasks/{taskId}/start | WAREHOUSE_PICKER；claim task |
| B4 | POST admin/warehouse/pick-tasks/{taskId}/scans | WAREHOUSE_PICKER；line/barcode/qty/lot/serial；後端每次驗所有條件 |
| B4 | POST admin/warehouse/pick-tasks/{taskId}/complete | WAREHOUSE_PICKER；後端 count/reservation 再驗證 |
| B4 | POST admin/warehouse/fulfillments/{fulfillmentId}/pack | WAREHOUSE_PICKER/SUPERVISOR；parcel/contents；QC gate/version |
| B5 | POST admin/warehouse/fulfillments/{fulfillmentId}/qc-inspections | WAREHOUSE_QC；server configured checklist |
| B5 | POST admin/warehouse/qc-inspections/{inspectionId}/checks | WAREHOUSE_QC；6 check types、result/reason、contentVersion |
| B5 | POST admin/warehouse/qc-inspections/{inspectionId}/complete | WAREHOUSE_QC；server derives PASS/FAIL/HOLD，不信 client overall PASS |
| B6 | POST member/orders/{orderId}/shipping-selection | MEMBER owner；HOME_DELIVERY/CVS_PICKUP + profile/store ref；後端 snapshot + eligibility |
| B6 | POST admin/warehouse/fulfillments/{fulfillmentId}/shipments | LOGISTICS_OPS；approved QC + parcel，server route adapter |
| B6 | GET admin/shipments/{shipmentId}/label | LOGISTICS_OPS/WAREHOUSE_PICKER；private bounded access / audit |
| B6 | POST admin/shipments/{shipmentId}/dispatch | LOGISTICS_OPS；revalidate QC/parcel/serial/reservation，idempotent inventory ship |
| B6 | POST admin/shipments/{shipmentId}/cancel | LOGISTICS_OPS；reason；provider-confirmed result |
| B6 | POST integrations/logistics/{connectionId}/webhook | signature / duplicate / out-of-order checks |
| B6 | GET member/orders/{orderId}/shipments | MEMBER owner；safe tracking/status |
| B7 | POST admin/orders/{orderId}/invoice-requests | INVOICE_OPS；server tax/issue policy |
| B7 | POST admin/invoices/{invoiceId}/void | INVOICE_OPS + approval evidence；reason |
| B7 | POST admin/invoices/{invoiceId}/allowances | INVOICE_OPS + allocation/approval evidence |
| B7 | POST integrations/invoices/{connectionId}/callback | verified callback；invoice event only |
| B7 | GET member/orders/{orderId}/invoices | MEMBER owner；safe references，不自行宣稱 issued |
| B9 | POST member/orders/{orderId}/rmas | MEMBER owner；lines/qty/reason；REQUESTED only |
| B9 | POST admin/rmas/{rmaId}/approve | RMA_OPS；approval evidence |
| B9 | POST admin/rmas/{rmaId}/receive | RMA_OPS；original shipment serial / inspection / disposition |
| B9 | POST admin/rmas/{rmaId}/post | RMA_OPS；Core approved allocation；one ReturnCase POSTED + effect deliveries |
| B9 | POST admin/rmas/{rmaId}/reject | RMA_OPS；reason，禁止已 posted 歷史回退 |
| B9 | POST admin/rmas/{rmaId}/close | RMA_OPS；必要 downstream receipts 檢查，不把 pending refund 裝成完成 |
| B9 | POST admin/serial-traces/query | SERIAL_TRACE_VIEW；serial 在 body，避免 HTTP originalUrl audit 存 serial；Member 遮罩 |
| B10 | GET admin/erp/connections | ERP_INTEGRATION_ADMIN/AUDITOR；只回 status / configVersion / domainSoR |
| B10 | POST admin/erp/reconciliations | ERP_INTEGRATION_ADMIN；domain/watermarks |
| B10 | POST admin/erp/sync-jobs/{jobId}/retry | ERP_INTEGRATION_ADMIN；same effect key，audited |

Provider config/cutover/admin override endpoints 需獨立 approval policy 與 interface freeze，不提供無條件 PATCH status 或 PATCH stock balance。B1 僅 types / proposals；上述 HTTP runtime 在對應 batch 才啟用。

## Boundary decisions to freeze

1. CAPTURED alias PAID；避免 double final-success transitions；partial capture 是否支援不猜。
2. LOT_AND_SERIAL -> LOT_SERIAL、CONVENIENCE_STORE_PICKUP -> CVS_PICKUP 僅 canonical alias，不改舊資料。
3. RETURN_CONFIRMED + persisted ReturnCase.POSTED -> RETURN_POSTED boundary；保留既有 event 名稱給 Core，採 explicit bridge receipt，不雙觸發 replay。
4. QC label-before-provider-create 循環：先定義可用 draft label / preflight；沒有 approved policy 不 dispatch。
5. New warehouse roles 與現有單一 role model、least privilege、多角色需求及高風險 approval evidence，由安全 Owner 共同確認。

OpenAPI proposal 中未啟用的 operations 均標 `x-implementation-status: PROPOSAL_ONLY`；不承諾 Sandbox/UAT readiness。callback wire schema 使用 x-provider-wire-contract-pending，而非虛構台新/黑貓/綠界欄位。
