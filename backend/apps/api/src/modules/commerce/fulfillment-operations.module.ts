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
@Module({controllers:[FulfillmentOperationsController,ErpReconciliationBridgeController],providers:[FulfillmentOperationsService,FulfillmentSerialScanService,FulfillmentPackVerificationService,FulfillmentErpHandoffService,FulfillmentSourceAllocationService,FulfillmentErpReconciliationService,FulfillmentSerialProvenanceService,FulfillmentDeliveryService,PiiCryptoService,FulfillmentShipmentService,ErpReconciliationBridgeService]})
export class FulfillmentOperationsModule{}
