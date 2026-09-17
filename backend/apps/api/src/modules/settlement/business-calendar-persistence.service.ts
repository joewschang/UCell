import {createHash} from 'node:crypto';
import {Injectable} from '@nestjs/common';
import {Prisma, PrismaService} from '@ucell/database';
import {
  BusinessCalendarDay,
  LocalDate,
  resolvePayoutSchedule,
  UCELL_TIME_ZONE,
  VersionedBusinessCalendar,
} from '@ucell/shared';

export class BusinessCalendarPersistenceError extends Error {
  constructor(readonly code:string,message:string){super(message);this.name='BusinessCalendarPersistenceError';}
}

export interface CalendarVersionInput {
  versionCode:string;
  effectiveFrom:LocalDate;
  effectiveTo?:LocalDate;
  approvalReference:string;
  dates:readonly BusinessCalendarDay[];
}

const iso=(value:Date)=>value.toISOString().slice(0,10) as LocalDate;
const date=(value:LocalDate)=>new Date(`${value}T00:00:00.000Z`);
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Persists the immutable calendar and payout anchors introduced by migration 41. */
@Injectable()
export class BusinessCalendarPersistenceService {
  constructor(private readonly prisma:PrismaService){}

  async createVersion(input:CalendarVersionInput){
    this.validateVersionInput(input);
    const ordered=[...input.dates].sort((a,b)=>a.date.localeCompare(b.date));
    const calendarHash=hash({versionCode:input.versionCode,timezone:UCELL_TIME_ZONE,effectiveFrom:input.effectiveFrom,effectiveTo:input.effectiveTo??null,approvalReference:input.approvalReference,dates:ordered});
    return this.prisma.$transaction(async tx=>{
      const existing=await tx.businessCalendarVersion.findUnique({where:{versionCode:input.versionCode}});
      if(existing){
        if(existing.calendarHash!==calendarHash) throw new BusinessCalendarPersistenceError('BUSINESS_CALENDAR_VERSION_CONFLICT',`Calendar ${input.versionCode} already exists with different evidence`);
        return existing;
      }
      const version=await tx.businessCalendarVersion.create({data:{
        versionCode:input.versionCode,timezone:UCELL_TIME_ZONE,effectiveFrom:date(input.effectiveFrom),
        effectiveTo:input.effectiveTo?date(input.effectiveTo):null,approvalReference:input.approvalReference,calendarHash,
      }});
      await tx.businessCalendarDate.createMany({data:ordered.map(day=>({
        businessCalendarVersionId:version.businessCalendarVersionId,calendarDate:date(day.date),isBusinessDay:day.businessDay,
        holidayReason:day.holidayReason,holidaySource:day.source,evidenceHash:hash({version:input.versionCode,...day}),
      }))});
      return version;
    });
  }

  async anchorSettlement(settlementBatchId:string,settlementDate:LocalDate){
    return this.prisma.$transaction(tx=>this.anchorInTransaction(tx,settlementBatchId,settlementDate),{
      isolationLevel:Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private async anchorInTransaction(tx:Prisma.TransactionClient,settlementBatchId:string,settlementDate:LocalDate){
    const batch=await tx.settlementBatch.findUnique({where:{settlementBatchId},select:{settlementBatchId:true,awards:{select:{bonusAwardId:true}}}});
    if(!batch) throw new BusinessCalendarPersistenceError('SETTLEMENT_BATCH_MISSING',`Settlement batch ${settlementBatchId} does not exist`);
    const settlementDay=date(settlementDate);
    const persistedEvidence=await tx.settlementCalendarEvidence.findUnique({where:{settlementBatchId}});
    // Once captured, replay reads the exact historical version instead of resolving
    // against calendars approved after the delayed job originally ran.
    const calendarVersion=persistedEvidence
      ? await tx.businessCalendarVersion.findUnique({where:{businessCalendarVersionId:persistedEvidence.businessCalendarVersionId}})
      : await tx.businessCalendarVersion.findFirst({
          where:{effectiveFrom:{lte:settlementDay},OR:[{effectiveTo:null},{effectiveTo:{gte:settlementDay}}]},orderBy:[{effectiveFrom:'desc'},{createdAt:'desc'}],
        });
    if(!calendarVersion) throw new BusinessCalendarPersistenceError('BUSINESS_CALENDAR_VERSION_MISSING',`No approved calendar covers ${settlementDate}`);
    if(calendarVersion.timezone!==UCELL_TIME_ZONE) throw new BusinessCalendarPersistenceError('BUSINESS_CALENDAR_TIMEZONE_INVALID',`Calendar ${calendarVersion.versionCode} is not Asia/Taipei`);

    const calendarRows=await tx.businessCalendarDate.findMany({where:{businessCalendarVersionId:calendarVersion.businessCalendarVersionId},orderBy:{calendarDate:'asc'}});
    const days=new Map(calendarRows.map(row=>[iso(row.calendarDate),{date:iso(row.calendarDate),businessDay:row.isBusinessDay,holidayReason:row.holidayReason??undefined,source:row.holidaySource??undefined}]));
    const calendar:VersionedBusinessCalendar={version:calendarVersion.versionCode,get:value=>days.get(value)};
    let schedule;
    try { schedule=resolvePayoutSchedule(settlementDate,calendar); }
    catch(error:any){throw new BusinessCalendarPersistenceError(error.code??'PAYOUT_SCHEDULE_RESOLUTION_FAILED',error.message);}
    const slot=settlementDate.endsWith('-10')?'TENTH':'TWENTY_FIFTH';
    const evidenceHash=hash({settlementBatchId,settlementDate,slot,businessCalendarVersionId:calendarVersion.businessCalendarVersionId,timezone:UCELL_TIME_ZONE});
    let evidence=persistedEvidence;
    if(evidence){
      if(iso(evidence.settlementDate)!==settlementDate || evidence.settlementSlot!==slot || evidence.businessCalendarVersionId!==calendarVersion.businessCalendarVersionId || evidence.anchorHash!==evidenceHash)
        throw new BusinessCalendarPersistenceError('SETTLEMENT_CALENDAR_EVIDENCE_CONFLICT','Persisted settlement calendar evidence differs from the requested anchor');
    } else evidence=await tx.settlementCalendarEvidence.create({data:{settlementBatchId,settlementDate:settlementDay,settlementSlot:slot,businessCalendarVersionId:calendarVersion.businessCalendarVersionId,timezone:UCELL_TIME_ZONE,anchorHash:evidenceHash}});

    for(const award of batch.awards){
      const anchorHash=hash({bonusAwardId:award.bonusAwardId,settlementCalendarEvidenceId:evidence.settlementCalendarEvidenceId,...schedule,businessCalendarVersionId:calendarVersion.businessCalendarVersionId});
      const existing=await tx.awardPayoutAnchor.findUnique({where:{bonusAwardId:award.bonusAwardId}});
      if(existing){
        if(existing.settlementCalendarEvidenceId!==evidence.settlementCalendarEvidenceId || iso(existing.settlementDate)!==settlementDate || iso(existing.nominalPayoutDate)!==schedule.nominalPayoutDate || iso(existing.adjustedPayoutDate)!==schedule.adjustedPayoutDate || existing.businessCalendarVersionId!==calendarVersion.businessCalendarVersionId || existing.anchorHash!==anchorHash)
          throw new BusinessCalendarPersistenceError('AWARD_PAYOUT_ANCHOR_CONFLICT',`Award ${award.bonusAwardId} already has a different payout anchor`);
      } else await tx.awardPayoutAnchor.create({data:{bonusAwardId:award.bonusAwardId,settlementCalendarEvidenceId:evidence.settlementCalendarEvidenceId,settlementDate:settlementDay,nominalPayoutDate:date(schedule.nominalPayoutDate),adjustedPayoutDate:date(schedule.adjustedPayoutDate),businessCalendarVersionId:calendarVersion.businessCalendarVersionId,anchorHash}});
    }
    return {evidence,schedule,awardCount:batch.awards.length};
  }

  private validateVersionInput(input:CalendarVersionInput){
    if(!input.versionCode.trim()||!input.approvalReference.trim()||input.dates.length===0) throw new BusinessCalendarPersistenceError('BUSINESS_CALENDAR_INVALID','Version, approval and at least one date are required');
    if(input.effectiveTo && input.effectiveTo<input.effectiveFrom) throw new BusinessCalendarPersistenceError('BUSINESS_CALENDAR_INVALID','effectiveTo precedes effectiveFrom');
    const seen=new Set<string>();
    for(const day of input.dates){
      if(seen.has(day.date)) throw new BusinessCalendarPersistenceError('BUSINESS_CALENDAR_DUPLICATE_DATE',`Duplicate calendar date ${day.date}`);
      seen.add(day.date);
      if(!day.businessDay && (!day.holidayReason?.trim()||!day.source?.trim())) throw new BusinessCalendarPersistenceError('BUSINESS_CALENDAR_HOLIDAY_EVIDENCE_MISSING',`Holiday ${day.date} requires reason and source`);
    }
  }
}
