# UCell Commerce & Fulfillment Integration Architecture
Status: DESIGN BASELINE
Date: 2026-09-17

## 1. Goal
Allow UCell to operate orders, payment, warehouse fulfillment, serial/lot traceability, QC, invoice and logistics before ERP exists, while later integrating Microsoft Dynamics 365 Business Central without rewriting Member/Qualification/Bonus Core.

## 2. Bounded modules
Order Orchestration; Payment Hub; Inventory Lite; Fulfillment/Warehouse; Serial & Lot Traceability; QC; Invoice Hub; Logistics Hub; Return/RMA; ERP Integration Gateway; Reconciliation/Operations Monitor.
Each provider is an adapter behind canonical UCell contracts.

## 3. Initial provider roadmap
Payment: Taishin Bank online credit-card gateway (current), Taishin physical card/POS evidence path (current/offline-store scenario), ECPay payment (next), LINE Pay (next).
Logistics: T-Cat/Black Cat home delivery and 7-ELEVEN store pickup. Integration may be direct or through an approved aggregator/provider adapter depending on commercial/API contract; canonical UCell Shipment remains unchanged.
Invoice: ECPay e-invoice as initial candidate plus alternative InvoiceProviderAdapter support. Provider selection is configuration, not domain logic.
ERP: NONE initially; DYNAMICS_365_BC adapter later.

## 4. Provider abstraction
PaymentProviderAdapter: createPayment, queryPayment, capture/confirm where applicable, refund, handleWebhook/callback, reconcile.
LogisticsProviderAdapter: createShipment, choosePickupStore where applicable, get/printLabel, cancelShipment, queryTracking, handleStatus.
InvoiceProviderAdapter: issue, void, allowance/credit adjustment, query, handleCallback.
ErpAdapter: syncItem, syncCustomer reference, syncOrder, syncShipment, syncInvoice/accounting reference, inventory reconciliation as approved.

## 5. Canonical payment model
PaymentIntent/Transaction separate from Order. States CREATED/PENDING/AUTHORIZED/CAPTURED(PAID)/FAILED/CANCELLED/REFUND_PENDING/PARTIALLY_REFUNDED/REFUNDED. Provider transaction IDs and callback evidence immutable. Browser redirect is not payment truth; verified server callback/query/reconciliation establishes status according to provider contract.
Physical Taishin card payment can be recorded through a controlled payment-capture/reconciliation workflow referencing terminal/batch/transaction evidence; do not store PAN/CVV.

## 6. Order to fulfillment state
ORDER_CREATED -> PAYMENT_PENDING -> PAID -> ALLOCATION_PENDING -> ALLOCATED -> PICKING -> PICKED -> SERIAL_QC_PENDING -> QC_PASSED -> PACKED -> SHIPMENT_CREATED/LABEL_READY -> SHIPPED -> DELIVERED. Exception states include PAYMENT_FAILED, STOCK_EXCEPTION, PICK_EXCEPTION, QC_FAILED, SHIPMENT_EXCEPTION, DELIVERY_FAILED, RETURN_REQUESTED/RETURNING/RETURNED.
Order, Payment, Invoice and Shipment have separate state machines.

## 7. Inventory Lite before BC
Minimal entities: Warehouse, Bin/Location optional, StockItem/ProductVersion, InventoryBalance, InventoryReservation, InventoryMovement, Lot, ProductUnit/Serial, StockAdjustmentEvidence. Support RECEIVE, RESERVE, RELEASE, PICK, SHIP, RETURN, ADJUST. This is operational inventory, not a replacement for full accounting ERP.

## 8. Picking / packing
Paid/eligible order creates FulfillmentOrder and PickList. Warehouse UI shows SKU/product, quantity, bin, lot/expiry rules and scan requirement. Barcode/QR scan must validate SKU/lot/serial against expected line. Wrong product/duplicate serial/expired or invalid lot fails closed.

## 9. Serial/lot traceability
ProductProfile config declares traceability mode NONE|LOT|SERIAL|LOT_AND_SERIAL and expiry policy. ProductUnit/lot evidence links receiving -> stock -> pick -> shipment -> order/member -> return. Serial unique where applicable. This supports complaints/recall/anti-duplication.

## 10. QC
QC checklist versioned by Product/Fulfillment policy. Initial checks: SKU, quantity, lot/serial validity, expiry threshold, package integrity, shipment recipient/method/label. QCEvidence stores checker, timestamp, checklistVersion, result, exceptions. QC failure blocks packing/shipping until resolved.

## 11. Logistics
Canonical ShippingMethod HOME_DELIVERY|CONVENIENCE_STORE_PICKUP|future. Shipment stores provider, service, recipient/store snapshot, providerShipmentId, trackingNo, labelRef, statuses and callbacks. 7-ELEVEN store selection data is snapshotted. Provider-specific status maps to canonical ShipmentStatus; retain raw provider code/evidence.

## 12. Invoice
InvoiceRequest/InvoiceEvidence independent from payment/shipment. Provider adapter supports B2C/B2B capabilities as configured. Trigger policy is versioned (e.g. payment/fulfillment timing) and must comply with approved accounting/tax SOP. Return/refund maps to void/allowance/credit workflow according to invoice state; never assume payment refund automatically adjusts invoice.

## 13. Return/RMA integration
RMA receives returned units/lot/serial, QC/disposition (RESTOCK/QUARANTINE/SCRAP etc.), inventory movement, payment refund, invoice adjustment and Core RETURN_POSTED/replay/recovery through explicit events. These effects are coordinated but independently evidenced/idempotent.

## 14. ERP-less System of Record
UCell: Member, Qualification, Package, Order, Payment canonical status, Inventory Lite, Fulfillment, Serial/Lot, Shipment, Invoice references, Return, Bonus.
External providers remain authoritative for their provider transaction/service outcome; UCell stores verified synchronized evidence.

## 15. With Dynamics 365 BC
UCell remains authority for Member/Qualification/Sponsor/Binary/Package/Bonus and customer-facing order orchestration. BC progressively becomes authority for Item Master (after mapping), inventory/accounting and selected warehouse/financial records. ERP Integration Gateway maps stable UCell IDs to BC IDs and uses outbox/idempotent sync. Do not dual-write DBs in one transaction.

## 16. Event backbone
PAYMENT_CAPTURED/FAILED/REFUNDED; INVENTORY_RESERVED/RELEASED; FULFILLMENT_CREATED; PICK_STARTED/COMPLETED; SERIAL_ASSIGNED; QC_PASSED/FAILED; SHIPMENT_CREATED/DISPATCHED/DELIVERED/FAILED; INVOICE_ISSUED/VOIDED/ALLOWANCE_CREATED; RETURN_POSTED; ERP_SYNC_REQUESTED/SUCCEEDED/FAILED. Events are idempotent/outbox-backed where business critical.

## 17. Security
No card PAN/CVV storage. Provider credentials in Key Vault/secrets. Verify callback signatures/checksums/source according to each provider spec. Least-privilege warehouse/QC/refund/invoice roles. Mask recipient PII. Audit manual payment capture, stock adjustment, QC override, refund, invoice adjustment and shipment override.

## 18. Reconciliation
Daily/periodic Payment Reconciliation compares UCell transactions to Taishin/ECPay/LINE Pay provider settlement/query evidence. Shipment reconciliation checks stuck/mismatched shipments. Invoice reconciliation checks issued/failed/void/allowance. Inventory reconciliation detects negative/serial mismatch. BC phase adds ERP sync reconciliation.

## 19. Rollout
Phase F0 contracts/data model/provider simulator.
F1 Taishin online payment + ERP-less Inventory Lite/Fulfillment/Serial/QC.
F2 Black Cat + 7-ELEVEN logistics adapters.
F3 E-invoice adapter (ECPay initial candidate) and invoice operations.
F4 ECPay payment + LINE Pay payment adapters.
F5 Return/RMA full orchestration and reconciliation hardening.
F6 Dynamics 365 BC adapter; migrate selected Systems of Record with reconciliation/shadow period.

## 20. Non-negotiable rule
Provider choice must not leak into Order/Qualification/Bonus domain logic. `ERP Provider = NONE` is a supported production mode. Later `DYNAMICS_365_BC` changes integration ownership, not historical UCell business facts.