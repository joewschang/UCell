import { Module } from '@nestjs/common';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';

@Module({
  imports:[IdempotencyModule],
  controllers:[AdminOperationsController],
  providers:[AdminOperationsService],
})
export class AdminOperationsModule{}
