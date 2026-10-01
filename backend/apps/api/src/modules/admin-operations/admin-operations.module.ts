import {MaturedPayableSourcesController} from './matured-payable-sources.controller';
import {MaturedPayableSourcesService} from './matured-payable-sources.service';
import {OperationsCompanyHealthController} from './operations-company-health.controller';
import {OperationsCompanyHealthService} from './operations-company-health.service';
import {OperationsWorkflowHealthController} from './operations-workflow-health.controller';
import {OperationsWorkflowHealthService} from './operations-workflow-health.service';
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
  controllers:[MaturedPayableSourcesController,OperationsCompanyHealthController,OperationsWorkflowHealthController,OperationsFinancialHealthController,AdminOperationsController,OperationsControlController,OperationsWorkItemsController],
  providers:[MaturedPayableSourcesService,OperationsCompanyHealthService,OperationsWorkflowHealthService,OperationsFinancialHealthService,AdminOperationsService,OperationsControlService,OperationsWorkItemsService],
})
export class AdminOperationsModule{}
