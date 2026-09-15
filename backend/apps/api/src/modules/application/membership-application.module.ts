import { Module } from '@nestjs/common';
import { MembershipApplicationController } from './membership-application.controller';
import { MembershipApplicationService } from './membership-application.service';

@Module({
  controllers:[MembershipApplicationController],
  providers:[MembershipApplicationService]
})
export class MembershipApplicationModule {}
