import {Module} from '@nestjs/common';
import {FulfillmentOperationsController} from './fulfillment-operations.controller';
import {FulfillmentOperationsService} from './fulfillment-operations.service';
import {FulfillmentSerialScanService} from './fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from './fulfillment-pack-verification.service';
import {FulfillmentErpHandoffService} from './fulfillment-erp-handoff.service';
import {FulfillmentSourceAllocationService} from './fulfillment-source-allocation.service';
import {FulfillmentErpReconciliationService} from './fulfillment-erp-reconciliation.service';
@Module({controllers:[FulfillmentOperationsController],providers:[FulfillmentOperationsService,FulfillmentSerialScanService,FulfillmentPackVerificationService,FulfillmentErpHandoffService,FulfillmentSourceAllocationService,FulfillmentErpReconciliationService]})
export class FulfillmentOperationsModule{}
