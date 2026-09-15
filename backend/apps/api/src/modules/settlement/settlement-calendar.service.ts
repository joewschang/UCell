import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { captureParameters, ParameterSnapshot, pending, snapshotValue } from '../rules/parameter-snapshot';

@Injectable()
export class SettlementCalendarService {
  constructor(private readonly prisma:PrismaService){}

  validate(snapshot:ParameterSnapshot,type:string) {
    const timezone=snapshotValue(snapshot,'settlement.timezone',type);
    const period=snapshotValue(snapshot,'settlement.period',type) as any;
    const cutoff=snapshotValue(snapshot,'settlement.cut_off',type) as any;
    if(typeof timezone!=='string') pending('CONFIGURATION_PENDING','Explicit settlement timezone required');
    try {new Intl.DateTimeFormat('en',{timeZone:timezone});} catch {pending('INVALID_TIMEZONE','Invalid settlement timezone');}
    if(!period || !['DAY','WEEK','MONTH'].includes(period.unit) || !Number.isInteger(period.count)||period.count<1 || typeof period.anchorLocal!=='string' || !/^\d{4}-\d{2}-\d{2}T00:00:00$/.test(period.anchorLocal)) pending('CONFIGURATION_PENDING','Configure period unit/count/local midnight anchor');
    if(period.unit==='MONTH' && !period.anchorLocal.slice(0,10).endsWith('-01')) pending('INVALID_PERIOD','Monthly anchor must be first calendar day');
    if(!cutoff || typeof cutoff.approvalReference!=='string' || !cutoff.approvalReference.trim() || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(cutoff.localTime??'') || !Number.isInteger(cutoff.daysAfterPeriodEnd) || cutoff.daysAfterPeriodEnd<0) pending('CONFIGURATION_PENDING','Approved cut-off localTime/daysAfterPeriodEnd/approvalReference required; no default');
    return {timezone,period,cutoff};
  }

  async periodFor(tx:Prisma.TransactionClient,eventAt:Date,snapshot:ParameterSnapshot,type:string) {
    const {timezone,period}=this.validate(snapshot,type);
    const width=period.count*(period.unit==='WEEK'?7:1);
    const interval=period.unit==='MONTH'?`${width} months`:`${width} days`;
    const [row]=await tx.$queryRaw<Array<{start:Date;end:Date}>>`
      WITH x AS (SELECT ${eventAt}::timestamptz AT TIME ZONE ${timezone} AS t,${period.anchorLocal}::timestamp AS a),
      b AS (SELECT CASE WHEN ${period.unit}='MONTH' THEN
        a + floor(((extract(year FROM t)-extract(year FROM a))*12+extract(month FROM t)-extract(month FROM a))/${width})::int * ${interval}::interval
        ELSE a + floor(extract(epoch FROM (t-a))/(86400*${width}))::int * ${interval}::interval END AS s FROM x)
      SELECT s AT TIME ZONE ${timezone} AS start,(s+${interval}::interval) AT TIME ZONE ${timezone} AS end FROM b`;
    return {...row,timezone};
  }

  async captureForPeriod(tx:Prisma.TransactionClient,start:Date,end:Date,type:string,version:string) {
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end) pending('INVALID_PERIOD','Period must be finite and increasing');
    const snapshot=await captureParameters(tx,end,version);
    const resolved=await this.periodFor(tx,start,snapshot,type);
    if(resolved.start.getTime()!==start.getTime()||resolved.end.getTime()!==end.getTime()) pending('PERIOD_CONFIGURATION_MISMATCH','Supplied period differs from effective approved calendar');
    const {timezone,cutoff}=this.validate(snapshot,type);
    const [row]=await tx.$queryRaw<Array<{at:Date}>>`SELECT (((${end}::timestamptz AT TIME ZONE ${timezone})::date + ${cutoff.daysAfterPeriodEnd}::int + ${cutoff.localTime}::time) AT TIME ZONE ${timezone}) AS at`;
    if(new Date()<row.at) pending('SETTLEMENT_CUTOFF_NOT_REACHED','Approved cut-off has not been reached');
    return snapshot;
  }

  async weeklyPeriodFor(eventAt:Date,version='R1.0B',tx?:Prisma.TransactionClient) {
    const db=tx??this.prisma;
    const snapshot=await captureParameters(db,eventAt,version);
    const period=await this.periodFor(db,eventAt,snapshot,'BINARY_K1');
    return {...period,parameterSnapshot:snapshot};
  }
}
