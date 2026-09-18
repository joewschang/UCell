import {PeriodProjectionController} from './period-projection.controller';
import {PeriodProjectionService} from './period-projection.service';
import {PeriodExportService} from './period-export.service';
import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRefreshWorker } from './analytics.refresh';
import { ConfigModule } from '@nestjs/config';
@Module({imports:[AuditModule,ConfigModule],controllers:[AnalyticsController,PeriodProjectionController],providers:[AnalyticsService,AnalyticsRefreshWorker,PeriodProjectionService,PeriodExportService]})
export class AnalyticsModule {}
