import { Module } from '@nestjs/common';
import { AdminOpsReadyController } from './admin-ops-ready.controller';
import { AdminOpsReadyService } from './admin-ops-ready.service';

@Module({
  controllers:[AdminOpsReadyController],
  providers:[AdminOpsReadyService],
})
export class AdminOpsReadyModule{}
