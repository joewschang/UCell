import {Module} from '@nestjs/common';
import {SettlementModule} from '../settlement/settlement.module';
import {AuditModule} from '../../common/audit/audit.module';
import {SettlementJobsController} from './settlement-jobs.controller';
@Module({imports:[SettlementModule,AuditModule],controllers:[SettlementJobsController]})
export class SettlementJobsModule {}
