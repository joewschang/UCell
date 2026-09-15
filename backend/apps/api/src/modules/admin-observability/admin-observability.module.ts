import { Module } from '@nestjs/common';
import { AdminObservabilityController } from './admin-observability.controller';
import { AdminObservabilityService } from './admin-observability.service';

@Module({
  controllers:[AdminObservabilityController],
  providers:[AdminObservabilityService],
})
export class AdminObservabilityModule{}
