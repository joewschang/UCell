import { Module } from '@nestjs/common';
import { RuntimeRuleModule } from '../rules/runtime-rule.module';
import { BonusQueryModule } from '../bonus/bonus-query.module';
import { EpvController } from './epv.controller';
import { EpvService } from './epv.service';
import { EpvMonthService } from './epv-month.service';

@Module({
  imports:[RuntimeRuleModule,BonusQueryModule],
  controllers:[EpvController],providers:[EpvService,EpvMonthService],exports:[EpvService,EpvMonthService]
})
export class EpvModule {}
