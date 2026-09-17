# UCell Commerce & Fulfillment — Data / API / Adapter Contract
Status: DESIGN FREEZE CANDIDATE
Date: 2026-09-17

## 1. System boundary
UCell Commerce owns member-facing Order orchestration and immutable order/package snapshots. Commerce/Fulfillment is modular: Payment Hub, Inventory Lite, Fulfillment/Warehouse, Serial/Lot Traceability, QC, Invoice Hub, Logistics Hub, Return/RMA, ERP Integration Gateway. R1.0B monetary recognition remains Core authority.

## 2. Payment model
Payment(id,orderId,provider TAISHIN_ECOM|TAISHIN_POS|ECPAY|LINE_PAY|OTHER,method,amount,currency,status CREATED|PENDING|AUTHORIZED|CAPTURED|PAID|FAILED|CANCELLED|PARTIALLY_REFUNDED|REFUNDED,providerTransactionRef,createdAt,paidAt?).
PaymentAttempt(id,paymentId,attemptNo,providerRequestRef,idempotencyKey,status,requestedAt,completedAt?,safeResponseRef?).
PaymentWebhookEvidence(id,provider,eventId/hash,receivedAt,signatureVerified,processedAt?,result,correlationId) unique provider/event identity.
PaymentReconciliation(id,provider,settlementDate,providerBatchRef,expectedAmount,settledAmount,difference,status,reviewedBy?).
PhysicalPosPaymentEvidence(id,orderId,provider=TAISHIN_POS,terminalRef?,batchRef?,transactionRef,amount,occurredAt,recordedBy,reconciliationStatus). Never store PAN/CVV/full track data.

Adapter contract: createPayment/queryPayment/cancelOrVoid/refund/verifyWebhook/reconcile. Provider-specific DTOs remain inside adapters.

## 3. Inventory Lite (ERP-less SoR)
Warehouse(id,code,name,status,addressRef?).
InventoryItem(id,productProfileId,sku,trackingMode NONE|LOT|SERIAL|LOT_SERIAL,status).
InventoryBalance(warehouseId,inventoryItemId,onHand,reserved,available,updatedAt).
InventoryMovement(id,warehouseId,itemId,type RECEIPT|RESERVE|RELEASE|PICK|SHIP|RETURN|ADJUST,quantity,lotId?,serialUnitId?,sourceType,sourceId,occurredAt,idempotencyKey).
Lot(id,itemId,lotNumber,mfgDate?,expiryDate?,status).
SerialUnit(id,itemId,serialNumber UNIQUE,lotId?,status IN_STOCK|RESERVED|PICKED|QC_PASSED|SHIPPED|RETURNED|QUARANTINED,warehouseId?,currentSourceRef?).

No negative available inventory. Reservation/pick/ship transitions transactional/idempotent. When BC becomes Inventory SoR, these become local operational projections/references rather than competing authoritative balances.

## 4. Fulfillment / Warehouse
FulfillmentOrder(id,orderId,warehouseId,status READY|ALLOCATED|PICKING|PICKED|QC_PENDING|QC_PASSED|PACKED|SHIPPING_REQUESTED|SHIPPED|DELIVERED|EXCEPTION|CANCELLED,createdAt,allocatedAt?).
FulfillmentLine(id,fulfillmentOrderId,orderLineId,itemId,requiredQty,allocatedQty,pickedQty,shippedQty).
PickTask(id,fulfillmentOrderId,status,assignedTo?,startedAt?,completedAt?).
PickScanEvidence(id,pickTaskId,lineId,barcode,lotId?,serialUnitId?,quantity,scannedBy,scannedAt,result).
PackageParcel(id,fulfillmentOrderId,parcelNo,weight?,dimensions?,status,sealedAt?).

## 5. QC
QcInspection(id,fulfillmentOrderId/parcelId,status PENDING|PASS|FAIL|HOLD,inspectorId,startedAt,completedAt?,reasonCode?).
QcCheckEvidence(id,inspectionId,checkType SKU|QTY|LOT_SERIAL|EXPIRY|PACKAGE_INTEGRITY|LABEL,result,noteRef?,occurredAt).
Shipment cannot reach dispatch-ready state until required QC policy passes. Optional packing photo can be future private evidence.

## 6. Logistics
Shipment(id,fulfillmentOrderId,provider BLACK_CAT|SEVEN_ELEVEN|ECPAY_LOGISTICS|OTHER,serviceType HOME_DELIVERY|CVS_PICKUP,recipientSnapshotRef,pickupStoreRef?,status READY|LABEL_CREATED|PICKED_UP|IN_TRANSIT|DELIVERED|DELIVERY_FAILED|RETURNING|RETURNED|CANCELLED,trackingNo?,providerShipmentRef?,createdAt).
ShipmentLabel(id,shipmentId,labelRef,createdAt,expiresAt?).
ShipmentTrackingEvent(id,shipmentId,providerEventId?,status,eventTime,locationHint?,receivedAt,rawSafeRef?) idempotent.

Adapter: createShipment/getLabel/cancelShipment/queryTracking/verifyWebhook/normalizeTrackingEvent. Current planned providers: 黑貓宅急便 and 7-ELEVEN store pickup; implementation may be direct or via ECPay logistics adapter without changing domain contract.

## 7. Invoice
Invoice(id,orderId,provider ECPAY|OTHER,status REQUESTED|ISSUED|VOIDED|ALLOWANCE_PENDING|ALLOWANCE_ISSUED|FAILED,invoiceNumber?,issuedAt?,buyerSnapshotRef,taxSnapshotRef,providerRef?).
InvoiceActionEvidence(id,invoiceId,action REQUEST|ISSUE|VOID|ALLOWANCE,amount?,providerEventRef?,occurredAt,result,idempotencyKey).
Adapter: issueInvoice/voidInvoice/issueAllowance/queryInvoice/verifyCallback. Invoice lifecycle is independent of Shipment and Payment status though policies coordinate them.

## 8. Return / RMA
Rma(id,orderId,fulfillmentOrderId?,status REQUESTED|APPROVED|RECEIVED|POSTED|REFUNDED|REJECTED|CLOSED,createdAt).
RmaLine(id,rmaId,orderLineId,qty,lotId?,serialUnitId?,condition,disposition RESTOCK|QUARANTINE|DISCARD).
RMA POSTED is the canonical inventory/recognition reversal boundary already aligned with Core Return/Replay policy. Refund and invoice allowance/void are separate downstream actions with idempotent evidence.

## 9. ERP Integration Gateway
ErpConnection(id,provider NONE|DYNAMICS_365_BC,status,configVersion,effectiveFrom,effectiveTo?).
ErpSyncOutbox(id,eventType,aggregateType,aggregateId,payloadVersion,idempotencyKey,status,createdAt,sentAt?,attempts,lastErrorCode?).
ErpExternalMapping(id,entityType,ucellId,erpProvider,externalId,version,status).
ErpReconciliation(id,domain ITEM|INVENTORY|ORDER|SHIPMENT|INVOICE|ACCOUNTING,period/provider,status,differenceSummaryRef,reviewedAt?).

Never synchronous dual-write UCell DB + BC as one assumed transaction. Use outbox/idempotent adapter/reconciliation. After BC cutover, BC becomes SoR for configured Item/Inventory/Accounting domains while UCell remains SoR for Member/Qualification/Sponsor/Binary/Package/Bonus.

## 10. API groups
Member: checkout/payment status; shipping method/store selection; order shipment/tracking; invoice info; return request.
Warehouse: fulfillment queue; pick task start/scan/complete; QC start/check/complete; parcel pack; shipment label/dispatch.
Admin: payment reconciliation/exceptions; inventory receipts/adjustments with permission; fulfillment exceptions; invoice exceptions; logistics exceptions; RMA; serial lookup/trace; provider configuration status (secrets never returned).

## 11. RBAC
PAYMENT_OPS, PAYMENT_RECONCILE, WAREHOUSE_PICKER, WAREHOUSE_QC, WAREHOUSE_SUPERVISOR, INVOICE_OPS, LOGISTICS_OPS, RMA_OPS, INVENTORY_ADJUST, SERIAL_TRACE_VIEW, ERP_INTEGRATION_ADMIN, AUDITOR. Separate high-risk adjustment/refund/config permissions where feasible. Every manual override/reconciliation/adjustment audited.

## 12. Security
No card PAN/CVV storage. Provider secrets in Key Vault/environment secret store. Webhook signature verification, replay/idempotency defense. Shipment/address/invoice buyer PII masked by role. Serial trace authorization/audit. Provider raw payload retention minimized/sanitized.

## 13. Initial provider plan
Payment: Taishin online credit card first; Taishin physical POS evidence/reconciliation; then ECPay payment and LINE Pay.
Logistics: Black Cat and 7-ELEVEN pickup, direct or adapter via approved aggregator.
Invoice: ECPay first candidate with provider abstraction for alternatives.
ERP: NONE initially; DYNAMICS_365_BC later.

## 14. Production gates
Provider sandbox/UAT credentials, signed webhook tests, refund/cancel tests, reconciliation, warehouse scan Golden, serial duplicate prevention, QC gate, label/tracking tests, invoice issue/allowance/void, RMA end-to-end, backup/restore, RBAC/security and provider operational runbooks.