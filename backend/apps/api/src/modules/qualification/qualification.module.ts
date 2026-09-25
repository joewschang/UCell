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
import {CompanySponsorAliasController} from './company-sponsor-alias.controller';
import {CompanySponsorAliasService} from './company-sponsor-alias.service';

@Module({
  imports:[OrganizationModule,AuthModule],
  controllers:[QualificationController,SponsorResolverController,QualificationWorkflowController,MemberQualificationPlacementController,AdminQualificationPlacementController,CompanySponsorAliasController],
  providers:[QualificationService,SponsorResolver,QualificationStatusService,QualificationWorkflowService,SystemAssignmentService,CompanySponsorAliasService],
  exports:[QualificationStatusService,SponsorResolver]
})
export class QualificationModule {}
