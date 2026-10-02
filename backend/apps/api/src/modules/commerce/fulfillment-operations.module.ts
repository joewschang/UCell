import {ErpAccountingMappingController} from './erp-accounting-mapping.controller';
import {ErpAccountingMappingService} from './erp-accounting-mapping.service';
import {ErpPaymentProjectionController} from './erp-payment-projection.controller';
import {ErpPaymentProjectionService} from './erp-payment-projection.service';
import {FulfillmentShipmentService} from './fulfillment-shipment.service';
import {PiiCryptoService} from '@ucell/database';
import {FulfillmentDeliveryService} from './fulfillment-delivery.service';
import {FulfillmentSerialProvenanceService} from './fulfillment-serial-provenance.service';
import {Module} from '@nestjs/common';
import {FulfillmentOperationsController} from './fulfillment-operations.controller';
import {FulfillmentOperationsService} from './fulfillment-operations.service';
import {FulfillmentSerialScanService} from './fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from './fulfillment-pack-verification.service';
import {FulfillmentErpHandoffService} from './fulfillment-erp-handoff.service';
import {FulfillmentSourceAllocationService} from './fulfillment-source-allocation.service';
import {FulfillmentErpReconciliationService} from './fulfillment-erp-reconciliation.service';
import {ErpReconciliationBridgeController} from './erp-reconciliation-bridge.controller';
import {ErpReconciliationBridgeService} from './erp-reconciliation-bridge.service';
import {ErpBusinessProjectionService} from './erp-business-projection.service';
import {ErpBusinessProjectionController} from './erp-business-projection.controller';
import {ErpCompensationProjectionController} from './erp-compensation-projection.controller';
import {ErpCompensationProjectionService} from './erp-compensation-projection.service';
@Module({exports:[ErpBusinessProjectionService,ErpReconciliationBridgeService],controllers:[FulfillmentOperationsController,ErpReconciliationBridgeController,ErpBusinessProjectionController,ErpCompensationProjectionController,ErpPaymentProjectionController,ErpAccountingMappingController],providers:[FulfillmentOperationsService,FulfillmentSerialScanService,FulfillmentPackVerificationService,FulfillmentErpHandoffService,FulfillmentSourceAllocationService,FulfillmentErpReconciliationService,FulfillmentSerialProvenanceService,FulfillmentDeliveryService,PiiCryptoService,FulfillmentShipmentService,ErpReconciliationBridgeService,ErpBusinessProjectionService,ErpCompensationProjectionService,ErpPaymentProjectionService,ErpAccountingMappingService]})
export class FulfillmentOperationsModule{}
