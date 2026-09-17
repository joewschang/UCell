# Schema proposal — 未核准、不可 migrate

基線 `2176b049dde32300e5023bcb7088d89890fec519`。沿用 commerce / integration namespaces；不新增另一份 Prisma schema。所有新增表由唯一 Schema Owner 排程。通用 evidence：UUID、server occurredAt/recordedAt、actor、correlationId、schemaVersion、policy/config version/hash；append-only guards、RESTRICT FK；mutable aggregate 以 version/CAS 更新並追加 transition evidence。

## Existing identity mapping

| 規格用語 | 本 repo authority |
|---|---|
| Product / SKU | commerce.product_reference.product_id / unique sku |
| Product version / recognition profile | commerce.product_rule_profile.product_rule_profile_id；不可將其 gpvRate 解釋為 BV |
| Package version / selections | 既有 PackageProfileVersion / PackageSelectableProduct / PackagePurchaseSnapshot / PackagePurchaseSelection |
| Order / OrderLine | 既有 order_id / order_line_id；保留 non-null qualification_id 與 monetary snapshots |
| Posted return | 既有 ReturnCase + ReturnLine；一個 economic posting owner |
| Core business outbox | 既有 integration.outbox_event；processStatus 為單 consumer ACK |

## Payment（B2）

| Proposed entity | Minimum fields / constraints |
|---|---|
| Payment | paymentId, orderId FK, providerConnectionId, method, amount Decimal(18,2), currency, canonical status, capturedAmount/refundedAmount, version, paidAt；amount>0，0<=refunded<=captured<=authorized order amount；split/tender 尚未核准，不自動開啟 |
| PaymentAttempt | paymentId, attemptNo, operation, requestRef, idempotencyKey, requestedAt/completedAt, outcome, safeResponseRef；unique(paymentId,attemptNo)、unique(connection,operation,idempotencyKey) |
| PaymentWebhookEvidence | connection/provider/eventIdentity, payloadDigest, signatureVerified, receivedAt, safeEvidenceRef, verificationConfigVersion；unique(connection,eventIdentity)。body digest 不能取代不同 eventId 對同交易的 business idempotency |
| PaymentEvidenceProcessing | webhookEvidenceId UNIQUE, result, processedAt, attempts/errorCode；驗證內容 immutable，處理 checkpoint 可更新且留 audit |
| PaymentTransactionEvidence | paymentId, providerTransactionRef, evidenceIdentity, kind AUTH/CAPTURE/REFUND/CANCEL/QUERY, amount/currency, verified source, occurredAt, safeRef；unique(connection,evidenceIdentity)，防同交易 webhook/query 雙寫 |
| PaymentCorePosting | paymentId, effectType, paymentEventId FK, coreReceiptRef；unique(paymentId,effectType)，一個 paid effect 只接 Core 一次 |
| PaymentRefund | paymentId,rmaId?,amount,currency,status,idempotencyKey,providerRefundRef,version；safe amount cap；refund completion 與 RMA POSTED 分離 |
| PhysicalPosPaymentEvidence | orderId,paymentId?,connectionId,terminalRef?,batchRef?,transactionRef,amount/currency,occurredAt,recordedBy,reconciliationStatus；verified batch identity 唯一範圍由 provider contract 決定，未決前不可標 PAID |
| PaymentReconciliation / Line | providerConnectionId,settlementDate,batchRef,expected/settled/difference,status,reviewedBy,sourceEvidenceRef；unique(connection,batchRef,version)，差異不得自動改訂單 |
| ProviderConnectionVersion | provider code/service/environment、non-secret configuration hash、secretRef、effective window、approval；secret bytes 永不入 DB |

Canonical 使用 PAID 表示 approved CAPTURED/PAID 成功語意，保留 raw provider code/CAPTURE evidence；adapter 不可僅憑 AUTHORIZE 標 PAID。`REFUND_PENDING` 留在 PaymentRefund workflow，不用來抹掉原 PAID 事實。這是待凍結的命名提案。

## Inventory（B3）

| Entity | Minimum fields / constraints |
|---|---|
| Warehouse | warehouseId,code UNIQUE,name,status,addressRef |
| InventoryItem | inventoryItemId,productId FK,sku snapshot/reference,trackingPolicyVersionId,status；同一 active product/item mapping unique，tracking mode NONE/LOT/SERIAL/LOT_SERIAL |
| InventoryPolicyVersion | itemId,version,trackingMode,serial normalization/expiry/allocation policy refs,effective window,hash,approval；used versions immutable |
| InventoryBalance | warehouseId,itemId composite PK,onHand,reserved,version；available 由 onHand-reserved 產生，不給三個獨立可任改欄位；CHECK onHand>=reserved>=0 |
| InventoryLotBalance | warehouseId,itemId,lotId composite key,onHand,reserved,version；同樣 nonnegative；Lot FK 綁 item；避免彙總足夠但 lot 不足 |
| InventoryReservation / Line | reservationId,orderId,orderLineId,warehouseId,itemId,lotId?,qty,status,sourceEffectKey UNIQUE,policyVersion；remaining reserve/consumed/released quantity 可核對；不自定 expiry TTL |
| InventoryMovement | id,warehouse,item,lot?,serial?,type RECEIPT/RESERVE/RELEASE/PICK/SHIP/RETURN/ADJUST,quantity>0,deltas,sourceType/sourceId/sourceLineId,idempotencyKey UNIQUE,occurredAt；append-only；ledger effects 與 balance 同交易 |
| Lot | lotId,itemId,lotNumber,mfgDate?,expiryDate?,status；unique(itemId,lotNumber)，expiry/mfg 合理性；expiry threshold / timezone 從 policy 取得 |
| SerialUnit | serialUnitId,itemId,serialNumber UNIQUE,lotId?,warehouseId?,status,version,currentBindingRef；lot 同 item；狀態變更有 immutable evidence |
| StockAdjustmentEvidence | item/warehouse,delta,reason,actor,approvalRef,correlationId,movementId UNIQUE；不得直接修改 balance |

Reserve 提案：以固定 warehouse/item/lot 排序 lock，conditional UPDATE `reserved=reserved+q WHERE onHand-reserved>=q`，必須返回一列；同 transaction 寫 reservation/movement/audit/outbox。Serial/lot validation 與狀態更新同交易。失敗全部 rollback，P2034 等映射 409 RETRYABLE_CONFLICT；同 key 重試。另需 item+lot bucket 適用鎖、跨品項全成或全敗，不依賴 UI 庫存。

Pick 只轉 reservation/serial 狀態，不再扣 available；SHIP 同時減 onHand/reserved；RELEASE 只減尚未 ship 的 reserved。RETURN 於 POSTED 依 disposition 增 restock 或 quarantine bucket，quarantine 不可售。這些是 inventory bookkeeping proposal，不是 monetary rule。以 movement replay/reconciliation 證明投影一致。

## Fulfillment / QC（B4–B5）

| Entity | Minimum fields / constraints |
|---|---|
| OrderDeliverySnapshot | orderId,version,method HOME_DELIVERY/CVS_PICKUP,encrypted recipientRef,pickupStoreSnapshotRef,configHash；immutable；不得回讀 mutable delivery profile 代替歷史地址 |
| FulfillmentOrder / Line | orderId,warehouseId,status,version；line->orderLine FK,itemId,required/allocated/picked/shipped qty。composite relation 保證 line 屬於同 order；0<=shipped<=picked<=allocated<=required |
| PickTask / PickScanEvidence | task,line,barcode safeRef/digest,lot/serial,qty,actor,time,result,reason,correlationId,idempotencyKey；同 key replay 原結果；不同 key 重掃同 serial 回 conflict |
| SerialAssignment / History | serialUnitId,fulfillmentLineId,reservationId,active,assignment history；partial unique(serialUnitId) WHERE active；不許同時被兩張 fulfillment 占用 |
| PackageParcel / ParcelLine | fulfillmentId,parcelNo,weight/dimensions,status,seal evidence,contentVersion/hash；unique(fulfillmentId,parcelNo)；內容变更使原 QC 過期 |
| QcPolicyVersion | immutable checklist/version/approval，6 required checks 與 expiry policy |
| QcInspection / QcCheckEvidence | fulfillment/parcel,policyVersion,contentVersion/hash,inspector,timestamp,status PENDING/PASS/FAIL/HOLD,reason,correlationId；逐 check immutable，PASS 必須六項齊全 |

QC 是後端 gate：replacement/re-pick/parcel內容或label變更須重新檢核；舊 PASS 不可沿用。規格要求 label correct 又要求 QC 前不能 createShipment：需 freeze「草稿 shipping label/recipient check」與 provider booking 的先後，或 provider 可 dry-run label 能力；未解決前拒絕 dispatch，不以假 PASS 打通。

## Logistics / Invoice（B6–B7）

| Entity | Minimum fields / constraints |
|---|---|
| Shipment | fulfillment/parcel,providerConnection,carrier BLACK_CAT/SEVEN_ELEVEN/OTHER,service HOME_DELIVERY/CVS_PICKUP,recipient/store immutable refs,status,trackingNo,providerShipmentRef,version；transport adapter ECPAY_LOGISTICS 與 carrier 分開 |
| ShipmentSerial | shipmentId,serialUnitId,assignmentId,activeClaim；unique(shipmentId,serialId)、partial unique(serialId) WHERE activeClaim；取消/return 只關閉 claim，歷史 join 不刪除 |
| ShipmentLabel | shipmentId,label privateRef,digest,contentVersion,createdAt,expiresAt? |
| ShipmentTrackingEvent | shipmentId,provider event identity,status,eventTime,receivedAt,safeRef；unique(connection,eventIdentity)；亂序不能把 DELIVERED 無證據退回 IN_TRANSIT |
| Invoice | orderId,providerConnection,status,invoiceNumber?,buyerSnapshotRef,taxPolicySnapshotRef,providerRef?,issuedAt,version；不由 Order.status 推論 |
| InvoiceActionEvidence | invoiceId,action,amount?,providerEventRef?,idempotencyKey,occurredAt,result,safeRef；unique(connection,idempotencyKey/operation identity)；多 allowance 累計不能超過核准原額 |
| InvoicePolicyVersion | issue trigger,buyer/tax snapshot policy,void/allowance routing,hash,approval；不填猜測 tax rate / legal deadline |

Shipment / Invoice multiplicity、split shipment / invoice 由 contract freeze 指定；提案保留 1:N 能力但不自動開啟拆單策略。

## Return / ERP / fan-out（B9–B10）

| Entity | Minimum fields / constraints |
|---|---|
| Rma / RmaLine | orderId,fulfillmentId?,lifecycle,version；original orderLine/shipment/serial/lot,qty,condition,disposition；狀態 history；退回 serial 必须是原 shipment、未重複 posted |
| RmaPostingEvidence | rmaId UNIQUE,returnCaseId UNIQUE FK,postingKey UNIQUE,postedAt,correlationId；一個 RMA economic posting 對一個既有 Core ReturnCase，不能重造一個 monetary Return |
| WorkflowEffectDelivery | sourceEventId,targetWorkflow,effectKey UNIQUE,status,attempts,availableAt,receiptRef,lastSafeError；unique(sourceEventId,targetWorkflow)，Inventory/Refund/Invoice/Core 各自 retry |
| ErpConnection | provider NONE/DYNAMICS_365_BC,environment/company refs,configVersion,domainSoR,effective window,secretRef,approval；NONE 是明確可運作模式 |
| ErpSyncOutbox | eventType,aggregateType/id,payloadVersion,idempotencyKey UNIQUE,connectionVersion,status,attempts,availableAt,sentAt,lastSafeError；local transaction enqueue，網路不在 DB transaction |
| ErpExternalMapping | entityType,ucellId,connection/company,externalId,version,status；unique(connection,entityType,ucellId)、unique(connection,entityType,externalId) |
| ErpReconciliation | connection/domain ITEM/INVENTORY/ORDER/SHIPMENT/INVOICE/ACCOUNTING,period,source/target watermarks,differenceSummaryRef,status,reviewer |

現有 outbox 可作本地 source event，但不能由 Core Worker 與 Commerce Worker 競爭同一列而各自當處理完成。提案以獨立 effect delivery/outbox rows 分派。必須用 stored ReturnCase.POSTED 驗證 `RETURN_CONFIRMED` 才對應 canonical RETURN_POSTED；不能僅以名稱相似建立兩次 reversal。

## History / migration decisions

No inferred backfill：不把 Order.PAID 當 verified provider capture、不把 FULFILLED 當 shipment/serial/QC/invoice；不把 legacy ReturnCase.POSTED 假造為已驗收 serial。歷史無證據保持 LEGACY_UNVERIFIED/UNAVAILABLE 的 read-model 分類，另建經審核 mapping/evidence。

Schema Owner 需 review：SKU/product version mapping、decimal stock unit/integrality、lot quarantine buckets、partial unique indexes、source-line FK、check triggers、payment/capture uniqueness、return allocation reference、QC label sequencing、refund statuses。未核准不生成 SQL，也不讓 Prisma db push 推斷 migration。
