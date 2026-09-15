import { Module } from '@nestjs/common';
import { SettlementCalendarService } from './settlement-calendar.service';
@Module({providers:[SettlementCalendarService],exports:[SettlementCalendarService]})
export class SettlementModule {}
