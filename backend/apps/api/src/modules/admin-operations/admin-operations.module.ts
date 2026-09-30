import { Module } from '@nestjs/common';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import {FulfillmentOperationsModule} from '../commerce/fulfillment-operations.module';
import {OperationsControlController} from './operations-control.controller';
import {OperationsControlService} from './operations-control.service';

@Module({
  imports:[IdempotencyModule,FulfillmentOperationsModule],
  controllers:[AdminOperationsController,OperationsControlController],
  providers:[AdminOperationsService,OperationsControlService],
})
export class AdminOperationsModule{}
