import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { QualificationController } from './qualification.controller';
import { QualificationService } from './qualification.service';
import { QualificationStatusService } from './qualification-status.service';
import { QualificationWorkflowController } from './qualification-workflow.controller';
import { QualificationWorkflowService } from './qualification-workflow.service';
import { SystemAssignmentService } from './system-assignment.service';

@Module({
  imports:[OrganizationModule],
  controllers:[QualificationController,QualificationWorkflowController],
  providers:[QualificationService,QualificationStatusService,QualificationWorkflowService,SystemAssignmentService],
  exports:[QualificationStatusService]
})
export class QualificationModule {}
