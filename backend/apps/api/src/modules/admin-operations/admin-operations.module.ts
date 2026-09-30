import {OperationsFinancialHealthController} from './operations-financial-health.controller';
import {OperationsFinancialHealthService} from './operations-financial-health.service';
import { Module } from '@nestjs/common';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import {FulfillmentOperationsModule} from '../commerce/fulfillment-operations.module';
import {OperationsControlController} from './operations-control.controller';
import {OperationsControlService} from './operations-control.service';
import {OperationsWorkItemsController} from './operations-work-items.controller';
import {OperationsWorkItemsService} from './operations-work-items.service';

@Module({
  imports:[IdempotencyModule,FulfillmentOperationsModule],
  controllers:[OperationsFinancialHealthController,AdminOperationsController,OperationsControlController,OperationsWorkItemsController],
  providers:[OperationsFinancialHealthService,AdminOperationsService,OperationsControlService,OperationsWorkItemsService],
})
export class AdminOperationsModule{}
