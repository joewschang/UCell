import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, captureParameters, pending, snapshotValue } from '@ucell/database';

export interface DashboardCalendarBounds {
  dayStart: Date;
  dayEnd: Date;
  monthStart: Date;
  monthEnd: Date;
  timezone: string;
  parameterSnapshotHash: string;
}

export async function dashboardCalendarBounds(tx:Prisma.TransactionClient,now:Date):Promise<DashboardCalendarBounds>{
  const snapshot=await captureParameters(tx,now,'R1.0B');
  const timezone=snapshotValue(snapshot,'accounting.timezone');
  if(typeof timezone!=='string')pending('CONFIGURATION_PENDING','Versioned accounting timezone must be a string');
  try{new Intl.DateTimeFormat('en',{timeZone:timezone});}
  catch{pending('INVALID_TIMEZONE','Versioned accounting timezone is invalid');}
  const [row]=await tx.$queryRaw<Array<{dayStart:Date;dayEnd:Date;monthStart:Date;monthEnd:Date}>>`
    WITH local_clock AS (SELECT ${now}::timestamptz AT TIME ZONE ${timezone} AS value)
    SELECT
      date_trunc('day',value) AT TIME ZONE ${timezone} AS "dayStart",
      (date_trunc('day',value)+interval '1 day') AT TIME ZONE ${timezone} AS "dayEnd",
      date_trunc('month',value) AT TIME ZONE ${timezone} AS "monthStart",
      (date_trunc('month',value)+interval '1 month') AT TIME ZONE ${timezone} AS "monthEnd"
    FROM local_clock`;
  if(!row||![row.dayStart,row.dayEnd,row.monthStart,row.monthEnd].every(value=>value instanceof Date&&Number.isFinite(value.getTime())))
    pending('CONFIGURATION_PENDING','Accounting timezone calendar bounds could not be resolved');
  return {...row,timezone,parameterSnapshotHash:snapshot.hash};
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma:PrismaService){}

  async summary(at=new Date()){
    if(!Number.isFinite(at.getTime()))pending('INVALID_PARAMETER_TIME','Dashboard read time is invalid');
    return this.prisma.$transaction(async tx=>{
      const bounds=await dashboardCalendarBounds(tx,at);

      const [
        persons,qualifications,activeQualifications,
        draftApplications,submittedApplications,
        todayOrders,monthOrders,openRecoveries,payableEntries
      ]=await Promise.all([
        tx.person.count(),
        tx.qualification.count(),
        tx.qualification.count({where:{status:'EFFECTIVE',activeFlag:true}}),
        tx.membershipApplication.count({where:{status:'DRAFT'}}),
        tx.membershipApplication.count({where:{status:'SUBMITTED'}}),
        tx.order.count({where:{createdAt:{gte:bounds.dayStart,lt:bounds.dayEnd}}}),
        tx.order.count({where:{createdAt:{gte:bounds.monthStart,lt:bounds.monthEnd}}}),
        tx.bonusRecoveryEvent.count({where:{status:{in:['OPEN','OFFSETTING']}}}),
        tx.payableEntry.count({where:{status:'OPEN'}}),
      ]);

      return {
        generatedAt:at,
        persons,qualifications,activeQualifications,
        applications:{draft:draftApplications,submitted:submittedApplications},
        orders:{today:todayOrders,month:monthOrders},
        recoveries:{open:openRecoveries},
        payable:{open:payableEntries},
        ruleVersionCode:'R1.0B',
      };
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
