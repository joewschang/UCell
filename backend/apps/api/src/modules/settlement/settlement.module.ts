import { Module } from '@nestjs/common';
import { SettlementCalendarService } from './settlement-calendar.service';
import { BusinessCalendarPersistenceService } from './business-calendar-persistence.service';
@Module({providers:[SettlementCalendarService,BusinessCalendarPersistenceService],exports:[SettlementCalendarService,BusinessCalendarPersistenceService]})
export class SettlementModule {}
