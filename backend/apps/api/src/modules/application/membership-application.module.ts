import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { QualificationModule } from '../qualification/qualification.module';
import { MembershipApplicationController } from './membership-application.controller';
import { MembershipApplicationService } from './membership-application.service';

@Module({
  imports:[OrganizationModule,QualificationModule],
  controllers:[MembershipApplicationController],
  providers:[MembershipApplicationService]
})
export class MembershipApplicationModule {}
