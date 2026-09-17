import { Module } from '@nestjs/common';
import { QualificationPlacementService } from '../qualification/qualification-placement.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, QualificationPlacementService],
  exports: [OrganizationService, QualificationPlacementService],
})
export class OrganizationModule {}
