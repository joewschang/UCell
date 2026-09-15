import { SettlementModule } from '../settlement/settlement.module';
import { Module } from '@nestjs/common';
import { RuntimeRuleModule } from '../rules/runtime-rule.module';
import { BonusController } from './bonus.controller';
import { BinaryBonusService } from './binary-bonus.service';
import { BonusLifecycleService } from './bonus-lifecycle.service';
import { BonusQueryModule } from './bonus-query.module';
import { ReferralBonusService } from './referral-bonus.service';

@Module({
  imports:[SettlementModule,RuntimeRuleModule,BonusQueryModule],
  controllers:[BonusController],
  providers:[ReferralBonusService,BinaryBonusService,BonusLifecycleService],
  exports:[ReferralBonusService,BinaryBonusService,BonusLifecycleService]
})
export class BonusModule {}
