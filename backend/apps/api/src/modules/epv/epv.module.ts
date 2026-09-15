import { Module } from '@nestjs/common';
import { RuntimeRuleModule } from '../rules/runtime-rule.module';
import { BonusQueryModule } from '../bonus/bonus-query.module';
import { EpvController } from './epv.controller';
import { EpvService } from './epv.service';

@Module({
  imports:[RuntimeRuleModule,BonusQueryModule],
  controllers:[EpvController],providers:[EpvService],exports:[EpvService]
})
export class EpvModule {}
