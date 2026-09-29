import {Module} from '@nestjs/common';
import {SettlementModule} from '../settlement/settlement.module';
import {AuditModule} from '../../common/audit/audit.module';
import {SettlementJobsController} from './settlement-jobs.controller';
import {CompensationPeriodControlController} from './compensation-period-control.controller';
import {CompensationPeriodControlService} from './compensation-period-control.service';
@Module({imports:[SettlementModule,AuditModule],controllers:[SettlementJobsController,CompensationPeriodControlController],providers:[CompensationPeriodControlService]})
export class SettlementJobsModule {}
