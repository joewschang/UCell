import {Module} from '@nestjs/common';
import {SettlementModule} from '../settlement/settlement.module';
import {AuditModule} from '../../common/audit/audit.module';
import {SettlementJobsController} from './settlement-jobs.controller';
import {CompensationPeriodControlController} from './compensation-period-control.controller';
import {CompensationPeriodControlService} from './compensation-period-control.service';
import {CompensationStageHistoryService} from './compensation-stage-history.service';
import {CompensationStageHistoryController} from './compensation-stage-history.controller';
import {CompensationPeriodSourcesController} from './compensation-period-sources.controller';
import {CompensationPeriodSourcesService} from './compensation-period-sources.service';
@Module({imports:[SettlementModule,AuditModule],controllers:[SettlementJobsController,CompensationPeriodControlController,CompensationPeriodSourcesController,CompensationStageHistoryController],providers:[CompensationPeriodControlService,CompensationPeriodSourcesService,CompensationStageHistoryService]})
export class SettlementJobsModule {}
