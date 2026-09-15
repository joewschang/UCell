import { Module } from '@nestjs/common';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';

@Module({
  controllers:[AdminOperationsController],
  providers:[AdminOperationsService],
})
export class AdminOperationsModule{}
