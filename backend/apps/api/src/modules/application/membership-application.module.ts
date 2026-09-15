import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { MembershipApplicationController } from './membership-application.controller';
import { MembershipApplicationService } from './membership-application.service';

@Module({
  imports:[OrganizationModule],
  controllers:[MembershipApplicationController],
  providers:[MembershipApplicationService]
})
export class MembershipApplicationModule {}
