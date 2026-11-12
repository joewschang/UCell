import { Module } from '@nestjs/common';
import { AdminObservabilityController } from './admin-observability.controller';
import { AdminObservabilityService } from './admin-observability.service';
import { SponsorMapController } from './sponsor-map.controller';

@Module({
  controllers:[AdminObservabilityController,SponsorMapController],
  providers:[AdminObservabilityService],
})
export class AdminObservabilityModule{}
