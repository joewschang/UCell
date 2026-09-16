import { Injectable } from '@nestjs/common';
import { captureParameters, ParameterSnapshot, pending, Prisma, snapshotValue } from '@ucell/database';

type SubscriptionCalendar={timezone:string;period:{unit:string;count:number;anchorLocal:string};cutoff:{localTime:string;daysAfterPeriodStart:number;approvalReference:string}};

@Injectable()
export class SubscriptionCalendarService {
 private validate(snapshot:ParameterSnapshot):SubscriptionCalendar{
  const timezone=snapshotValue(snapshot,'subscription.calendar.timezone');
  const period=snapshotValue(snapshot,'subscription.calendar.period') as any;
  const cutoff=snapshotValue(snapshot,'subscription.calendar.cutoff') as any;
  if(typeof timezone!=='string')pending('CONFIGURATION_PENDING','Explicit subscription calendar timezone required');
  try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{pending('INVALID_TIMEZONE','Invalid subscription calendar timezone');}
  if(!period||period.unit!=='MONTH'||period.count!==1||typeof period.anchorLocal!=='string'||!/^[0-9]{4}-[0-9]{2}-01T00:00:00$/.test(period.anchorLocal))pending('CONFIGURATION_PENDING','Monthly subscription calendar and local anchor required');
  if(!cutoff||typeof cutoff.approvalReference!=='string'||!cutoff.approvalReference.trim()||!/^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(cutoff.localTime??'')||!Number.isInteger(cutoff.daysAfterPeriodStart)||cutoff.daysAfterPeriodStart<0)pending('CONFIGURATION_PENDING','Approved subscription recognition cutoff required');
  return {timezone,period,cutoff};
 }
 async schedule(tx:Prisma.TransactionClient,startMonth:string,durationMonths:number,ruleVersionCode:string){
  if(!/^[0-9]{4}-(0[1-9]|1[0-2])-01$/.test(startMonth))pending('INVALID_SUBSCRIPTION_START_MONTH','Subscription startMonth must be the first calendar day');
  const snapshot=await captureParameters(tx,new Date(startMonth+'T00:00:00.000Z'),ruleVersionCode),calendar=this.validate(snapshot),rows=[];
  for(let index=0;index<durationMonths;index++){
   const [row]=await tx.$queryRaw<Array<{recognitionMonth:Date;dueAt:Date}>>`
    SELECT ((${startMonth}::date + (${index}::text || ' months')::interval)::date) AS "recognitionMonth",
      ((((${startMonth}::date + (${index}::text || ' months')::interval)::date + ${calendar.cutoff.daysAfterPeriodStart}::int + ${calendar.cutoff.localTime}::time) AT TIME ZONE ${calendar.timezone})) AS "dueAt"`;
   rows.push(row);
  }
  return {rows,snapshot,calendar};
 }
}
