import { Module } from '@nestjs/common';
import { AdminObservabilityController } from './admin-observability.controller';
import { AdminObservabilityService } from './admin-observability.service';
import { BinaryMapController } from './binary-map.controller';
import { SponsorMapController } from './sponsor-map.controller';

@Module({
  controllers:[AdminObservabilityController,BinaryMapController,SponsorMapController],
  providers:[AdminObservabilityService],
})
export class AdminObservabilityModule{}
