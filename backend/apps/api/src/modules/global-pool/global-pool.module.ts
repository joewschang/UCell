import { SettlementModule } from '../settlement/settlement.module';
import { Module } from '@nestjs/common';
import { RuntimeRuleModule } from '../rules/runtime-rule.module';
import { BonusQueryModule } from '../bonus/bonus-query.module';
import { GlobalPoolController } from './global-pool.controller';
import { GlobalPoolService } from './global-pool.service';

@Module({
  imports:[SettlementModule,RuntimeRuleModule,BonusQueryModule],
  controllers:[GlobalPoolController],providers:[GlobalPoolService]
})
export class GlobalPoolModule {}
