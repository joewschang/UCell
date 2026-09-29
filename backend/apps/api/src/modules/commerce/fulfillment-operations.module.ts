import {Module} from '@nestjs/common';
import {FulfillmentOperationsController} from './fulfillment-operations.controller';
import {FulfillmentOperationsService} from './fulfillment-operations.service';
import {FulfillmentSerialScanService} from './fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from './fulfillment-pack-verification.service';
import {FulfillmentErpHandoffService} from './fulfillment-erp-handoff.service';
@Module({controllers:[FulfillmentOperationsController],providers:[FulfillmentOperationsService,FulfillmentSerialScanService,FulfillmentPackVerificationService,FulfillmentErpHandoffService]})
export class FulfillmentOperationsModule{}
