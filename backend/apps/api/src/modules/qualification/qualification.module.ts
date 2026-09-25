import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { QualificationController } from './qualification.controller';
import { QualificationService } from './qualification.service';
import { SponsorResolver } from './sponsor-resolver.service';
import { SponsorResolverController } from './sponsor-resolver.controller';
import { QualificationStatusService } from './qualification-status.service';
import { QualificationWorkflowController } from './qualification-workflow.controller';
import { QualificationWorkflowService } from './qualification-workflow.service';
import { SystemAssignmentService } from './system-assignment.service';
import {AuthModule} from '../auth/auth.module';
import {AdminQualificationPlacementController,MemberQualificationPlacementController} from './qualification-placement.controller';

@Module({
  imports:[OrganizationModule,AuthModule],
  controllers:[QualificationController,QualificationWorkflowController,MemberQualificationPlacementController,AdminQualificationPlacementController],
  providers:[QualificationService,QualificationStatusService,QualificationWorkflowService,SystemAssignmentService],
  exports:[QualificationStatusService]
})
export class QualificationModule {}
