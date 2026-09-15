import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, processHistoricalReturn } from '@ucell/database';
import { SettlementCalendarService } from '../settlement/settlement-calendar.service';
import { EpvMonthService } from '../epv/epv-month.service';
@Injectable()
export class ReversalService {
  constructor(private readonly prisma:PrismaService,private readonly calendar:SettlementCalendarService,private readonly epvMonths:EpvMonthService){}
  async processReturn(returnCaseId:string) {
    return this.prisma.$transaction(tx=>processHistoricalReturn(tx,returnCaseId),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000});
  }
}
