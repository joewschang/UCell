import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRefreshWorker } from './analytics.refresh';
import { ConfigModule } from '@nestjs/config';
@Module({imports:[AuditModule,ConfigModule],controllers:[AnalyticsController],providers:[AnalyticsService,AnalyticsRefreshWorker]})
export class AnalyticsModule {}
