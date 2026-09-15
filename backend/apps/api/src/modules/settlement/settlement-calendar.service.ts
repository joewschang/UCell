import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Injectable()
export class SettlementCalendarService {
  constructor(private readonly prisma:PrismaService){}

  async weeklyPeriodFor(eventAt:Date,ruleVersionCode='R1.0B'){
    const rows=await this.prisma.runtimeRuleParameter.findMany({
      where:{
        ruleVersionCode,
        parameterCode:{in:['settlement.timezone','settlement.week.starts_on']},
        effectiveFrom:{lte:eventAt},
        OR:[{effectiveTo:null},{effectiveTo:{gt:eventAt}}]
      }, orderBy:{effectiveFrom:'desc'}
    });
    const tz=String(rows.find(x=>x.parameterCode==='settlement.timezone')?.valueJson ?? 'Asia/Taipei').replace(/^"|"$/g,'');
    const starts=Number(rows.find(x=>x.parameterCode==='settlement.week.starts_on')?.valueJson ?? 1);
    const r=await this.prisma.$queryRaw<Array<{period_start:Date;period_end:Date}>>`
      WITH x AS (SELECT (${eventAt}::timestamptz AT TIME ZONE ${tz}) AS local_ts),
      d AS (SELECT local_ts,EXTRACT(ISODOW FROM local_ts)::int AS iso_dow FROM x),
      b AS (
        SELECT date_trunc('day',local_ts)
          - (((iso_dow-${starts}+7)%7)*interval '1 day') AS local_start FROM d
      )
      SELECT (local_start AT TIME ZONE ${tz}) AS period_start,
             ((local_start+interval '7 day') AT TIME ZONE ${tz}) AS period_end FROM b
    `;
    if(!r[0]) throw new Error('SETTLEMENT_PERIOD_NOT_RESOLVED');
    return {start:r[0].period_start,end:r[0].period_end,timezone:tz,weekStartsOn:starts};
  }
}
