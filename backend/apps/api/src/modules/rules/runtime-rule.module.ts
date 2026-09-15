import { Module } from '@nestjs/common';
import { RuntimeRuleService } from './runtime-rule.service';

@Module({providers:[RuntimeRuleService],exports:[RuntimeRuleService]})
export class RuntimeRuleModule {}
