import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {taipeiMonth} from './recognition-active';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Append the linked consumption reversal, then rebuild only its mutable
 * Active projection. Original recognition and interval evidence stay intact. */
export async function replayPackageMonthlyActive(tx:Prisma.TransactionClient,original:any,delta:Prisma.Decimal,returnCaseId:string){
 const month=taipeiMonth(original.occurredAt),qid=original.qualificationId;
 await tx.$queryRaw`WITH locked AS (SELECT pg_advisory_xact_lock(hashtextextended(${`${qid}:${month.key}`},0))) SELECT 1::integer FROM locked`;
 const source=await tx.consumptionRecognitionEvent.findUniqueOrThrow({where:{idempotencyKey:`recognition:${original.sourceType}:${original.sourceId}:${original.sourceLineId??'-'}`}});
 const key=`package-active-return:${returnCaseId}:${original.eventId}`;
 if(await tx.consumptionRecognitionEvent.findUnique({where:{idempotencyKey:key}}))return;
 if(delta.gte(0))throw new Error('PACKAGE_ACTIVE_REVERSAL_MUST_BE_NEGATIVE');
 const prior=await tx.qualificationMonthAccumulatorEvidence.findFirstOrThrow({where:{qualificationId:qid,calendarMonth:month.calendarMonth},orderBy:{sequenceNo:'desc'}});
 const after=prior.cumulativeAfter.add(delta);
 if(after.lt(0))throw new Error('PACKAGE_CONSUMPTION_REVERSAL_EXCEEDED');
 const evidenceHash=hash({source:source.consumptionRecognitionEventId,delta:delta.toString(),after:after.toString(),returnCaseId});
 const reversal=await tx.consumptionRecognitionEvent.create({data:{qualificationId:qid,sourceType:'RETURN',sourceId:returnCaseId,sourceLineId:original.eventId,direction:'REVERSAL',eligible:true,eligibleAmount:delta,recognitionPurpose:'GPV',productProfileVersion:source.productProfileVersion,ruleVersionCode:source.ruleVersionCode,parameterSnapshotHash:source.parameterSnapshotHash,recognizedAt:source.recognizedAt,recognitionMonth:month.calendarMonth,reversalOfEventId:source.consumptionRecognitionEventId,idempotencyKey:key,correlationId:returnCaseId,evidenceHash}});
 const accumulator=await tx.qualificationMonthAccumulatorEvidence.create({data:{qualificationId:qid,calendarMonth:month.calendarMonth,consumptionRecognitionEventId:reversal.consumptionRecognitionEventId,cumulativeBefore:prior.cumulativeAfter,eligibleDelta:delta,cumulativeAfter:after,activeThreshold:prior.activeThreshold,thresholdCrossed:false,epvAfter:after,sequenceNo:prior.sequenceNo+1,ruleVersionCode:source.ruleVersionCode,evidenceHash,idempotencyKey:`accumulator:${key}`}});
 const originals=await tx.consumptionRecognitionEvent.findMany({where:{qualificationId:qid,recognitionMonth:month.calendarMonth,direction:'ORIGINAL'},orderBy:[{recognizedAt:'asc'},{consumptionRecognitionEventId:'asc'}]});
 let total=new Prisma.Decimal(0),activeFrom:Date|undefined;
 for(const row of originals){
  const reversed=await tx.consumptionRecognitionEvent.aggregate({where:{reversalOfEventId:row.consumptionRecognitionEventId,direction:'REVERSAL'},_sum:{eligibleAmount:true}});
  const retained=row.eligibleAmount.add(reversed._sum.eligibleAmount??0);
  if(retained.lt(0))throw new Error('PACKAGE_CONSUMPTION_REVERSAL_EXCEEDED');
  total=total.add(retained);
  if(!activeFrom&&total.gte(prior.activeThreshold))activeFrom=row.recognizedAt;
 }
 if(!total.eq(after))throw new Error('PACKAGE_MONTH_ACCUMULATOR_CONFLICT');
 const priorIntervals=await tx.activeIntervalEvidence.findMany({where:{qualificationId:qid,calendarMonth:month.calendarMonth},orderBy:{createdAt:'desc'}});
 if(!activeFrom&&!priorIntervals.length)return;
 const interval=await tx.activeIntervalEvidence.create({data:{qualificationId:qid,calendarMonth:month.calendarMonth,sourceAccumulatorEvidenceId:accumulator.qualificationMonthAccumulatorEvidenceId,activeFrom:activeFrom??month.end,activeTo:month.end,supersedesActiveEvidenceId:priorIntervals[0]?.activeIntervalEvidenceId,reasonCode:activeFrom?'HISTORICAL_RETURN_REPLAY':'HISTORICAL_RETURN_REPLAY_INACTIVE',ruleVersionCode:source.ruleVersionCode,evidenceHash,idempotencyKey:`active:${key}`}});
 const projections=await tx.activePeriod.findMany({where:{qualificationId:qid,sourceType:'CONSUMPTION_RECOGNITION',sourceId:{in:priorIntervals.map(row=>row.activeIntervalEvidenceId)}}});
 for(const projection of projections)await tx.activePeriod.update({where:{activePeriodId:projection.activePeriodId},data:{activeTo:projection.activeFrom}});
 if(activeFrom)await tx.activePeriod.create({data:{qualificationId:qid,activeFrom,activeTo:month.end,sourceType:'CONSUMPTION_RECOGNITION',sourceId:interval.activeIntervalEvidenceId,ruleVersionCode:source.ruleVersionCode}});
 const now=new Date(),active=await tx.activePeriod.count({where:{qualificationId:qid,activeFrom:{lte:now},OR:[{activeTo:null},{activeTo:{gt:now}}]}});
 await tx.qualification.update({where:{qualificationId:qid},data:{activeFlag:active>0}});
}
