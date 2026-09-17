import {Prisma} from '@prisma/client';
import {createHash, randomUUID} from 'node:crypto';

const TAIPEI_OFFSET_MS=8*60*60*1000;
const decimal=(value:Prisma.Decimal.Value)=>new Prisma.Decimal(value).toDecimalPlaces(4,Prisma.Decimal.ROUND_HALF_UP);
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,Object.keys(value as any).sort())).digest('hex');

export type ConcreteRecognitionType='GPV'|'RPV'|'EPV';
export interface RecognizeConsumptionInput {
  qualificationId:string;
  sourceType:string;
  sourceId:string;
  sourceLineId?:string|null;
  amount:Prisma.Decimal.Value;
  eligible:boolean;
  exclusionReasonCode?:string;
  concreteVolumeType:ConcreteRecognitionType;
  productProfileVersion:string;
  ruleVersionCode:string;
  parameterSnapshotHash:string;
  recognizedAt:Date;
  activeThreshold:Prisma.Decimal.Value;
  correlationId?:string;
}

export function taipeiMonth(at:Date){
  if(!Number.isFinite(at.getTime())) throw new Error('INVALID_RECOGNITION_TIMESTAMP');
  const local=new Date(at.getTime()+TAIPEI_OFFSET_MS),year=local.getUTCFullYear(),month=local.getUTCMonth();
  return {
    key:`${year}-${String(month+1).padStart(2,'0')}`,
    calendarMonth:new Date(Date.UTC(year,month,1)),
    start:new Date(Date.UTC(year,month,1)-TAIPEI_OFFSET_MS),
    end:new Date(Date.UTC(year,month+1,1)-TAIPEI_OFFSET_MS),
  };
}

/**
 * Records the complete R1.0B recognition chain. The caller must provide a
 * SERIALIZABLE transaction; the qualification/month lock also makes sequence
 * allocation deterministic when independent workers race.
 */
export async function recognizeConsumption(tx:Prisma.TransactionClient,input:RecognizeConsumptionInput){
  if(!['GPV','RPV','EPV'].includes(input.concreteVolumeType)) throw new Error('GENERIC_VOLUME_CANNOT_BE_RECOGNIZED');
  const amount=decimal(input.amount),threshold=decimal(input.activeThreshold);
  if(amount.lte(0)||threshold.lte(0)) throw new Error('INVALID_RECOGNITION_AMOUNT');
  if(!input.eligible&&!input.exclusionReasonCode) throw new Error('EXCLUSION_REASON_REQUIRED');
  const month=taipeiMonth(input.recognizedAt),correlationId=input.correlationId??randomUUID();
  const key=`recognition:${input.sourceType}:${input.sourceId}:${input.sourceLineId??'-'}`;

  await tx.$queryRaw<Array<{locked:number}>>`
    WITH qualification_month_lock AS (
      SELECT pg_advisory_xact_lock(hashtextextended(${`${input.qualificationId}:${month.key}`},0))
    )
    SELECT 1::integer AS locked FROM qualification_month_lock
  `;
  const existing=await tx.consumptionRecognitionEvent.findUnique({where:{idempotencyKey:key}});
  if(existing){
    if(existing.qualificationId!==input.qualificationId||existing.eligible!==input.eligible||!existing.eligibleAmount.eq(input.eligible?amount:0)||existing.recognitionPurpose!==input.concreteVolumeType||existing.recognizedAt.getTime()!==input.recognizedAt.getTime())
      throw new Error('RECOGNITION_IDEMPOTENCY_CONFLICT');
    const accumulator=await tx.qualificationMonthAccumulatorEvidence.findUnique({where:{idempotencyKey:`accumulator:${existing.consumptionRecognitionEventId}`}});
    const volume=await tx.pvLedger.findFirst({where:{sourceType:input.sourceType,sourceId:input.sourceId,sourceLineId:input.sourceLineId??null,pvType:input.concreteVolumeType}});
    return {recognition:existing,accumulator,volume,created:false};
  }

  const eligibleDelta=input.eligible?amount:new Prisma.Decimal(0);
  const recognitionEvidence={qualificationId:input.qualificationId,sourceType:input.sourceType,sourceId:input.sourceId,sourceLineId:input.sourceLineId??null,
    eligible:input.eligible,eligibleAmount:eligibleDelta.toString(),purpose:input.concreteVolumeType,recognizedAt:input.recognizedAt.toISOString(),month:month.key};
  const recognition=await tx.consumptionRecognitionEvent.create({data:{
    qualificationId:input.qualificationId,sourceType:input.sourceType,sourceId:input.sourceId,sourceLineId:input.sourceLineId??null,
    eligible:input.eligible,eligibleAmount:eligibleDelta,exclusionReasonCode:input.eligible?null:input.exclusionReasonCode,
    recognitionPurpose:input.concreteVolumeType,productProfileVersion:input.productProfileVersion,ruleVersionCode:input.ruleVersionCode,
    parameterSnapshotHash:input.parameterSnapshotHash,recognizedAt:input.recognizedAt,recognitionMonth:month.calendarMonth,
    idempotencyKey:key,correlationId,evidenceHash:hash(recognitionEvidence)
  }});
  const previous=await tx.qualificationMonthAccumulatorEvidence.findFirst({where:{qualificationId:input.qualificationId,calendarMonth:month.calendarMonth},orderBy:{sequenceNo:'desc'}});
  const before=previous?.cumulativeAfter??new Prisma.Decimal(0),after=before.add(eligibleDelta);
  const thresholdCrossed=before.lt(threshold)&&after.gte(threshold);
  const accumulatorEvidence={recognitionId:recognition.consumptionRecognitionEventId,before:before.toString(),delta:eligibleDelta.toString(),after:after.toString(),threshold:threshold.toString()};
  const accumulator=await tx.qualificationMonthAccumulatorEvidence.create({data:{
    qualificationId:input.qualificationId,calendarMonth:month.calendarMonth,consumptionRecognitionEventId:recognition.consumptionRecognitionEventId,
    cumulativeBefore:before,eligibleDelta,cumulativeAfter:after,activeThreshold:threshold,thresholdCrossed,epvAfter:after,
    sequenceNo:(previous?.sequenceNo??0)+1,ruleVersionCode:input.ruleVersionCode,evidenceHash:hash(accumulatorEvidence),idempotencyKey:`accumulator:${recognition.consumptionRecognitionEventId}`
  }});

  if(thresholdCrossed){
    const activeEvidence=await tx.activeIntervalEvidence.create({data:{qualificationId:input.qualificationId,calendarMonth:month.calendarMonth,
      sourceAccumulatorEvidenceId:accumulator.qualificationMonthAccumulatorEvidenceId,activeFrom:input.recognizedAt,activeTo:month.end,
      reasonCode:'MONTHLY_ELIGIBLE_CONSUMPTION_THRESHOLD',ruleVersionCode:input.ruleVersionCode,
      evidenceHash:hash({accumulatorId:accumulator.qualificationMonthAccumulatorEvidenceId,from:input.recognizedAt.toISOString(),to:month.end.toISOString()}),
      idempotencyKey:`active:${accumulator.qualificationMonthAccumulatorEvidenceId}`}});
    await tx.activePeriod.create({data:{qualificationId:input.qualificationId,activeFrom:input.recognizedAt,activeTo:month.end,sourceType:'CONSUMPTION_RECOGNITION',sourceId:activeEvidence.activeIntervalEvidenceId,ruleVersionCode:input.ruleVersionCode}});
    await tx.qualification.update({where:{qualificationId:input.qualificationId},data:{activeFlag:true}});
  }

  let volume=null;
  if(input.eligible){
    // A pre-v3 worker may already have materialized the concrete fact. Attach
    // v3 evidence to that immutable row instead of minting a second volume.
    volume=await tx.pvLedger.findFirst({where:{sourceType:input.sourceType,sourceId:input.sourceId,sourceLineId:input.sourceLineId??null,
      eventType:`${input.concreteVolumeType}_CREATED`,pvType:input.concreteVolumeType}});
    if(volume&&(!volume.amount.eq(amount)||volume.qualificationId!==input.qualificationId||volume.occurredAt.getTime()!==input.recognizedAt.getTime()))
      throw new Error('HISTORICAL_VOLUME_CONFLICT');
    volume??=await tx.pvLedger.create({data:{qualificationId:input.qualificationId,pvType:input.concreteVolumeType,amount,
      sourceType:input.sourceType,sourceId:input.sourceId,sourceLineId:input.sourceLineId??null,eventType:`${input.concreteVolumeType}_CREATED`,
      ruleVersionCode:input.ruleVersionCode,parameterSnapshotHash:input.parameterSnapshotHash,occurredAt:input.recognizedAt,correlationId}});
    await tx.volumeRecognitionClassification.upsert({where:{volumeEventId:volume.eventId},update:{},create:{volumeEventId:volume.eventId,volumeClass:'PV',concreteVolumeType:input.concreteVolumeType,
      classificationVersion:'R1.0B_V3',ruleVersionCode:input.ruleVersionCode,evidenceHash:hash({volumeEventId:volume.eventId,type:input.concreteVolumeType})}});
  }
  await tx.outboxEvent.create({data:{eventType:'CONSUMPTION_RECOGNIZED',aggregateType:'CONSUMPTION_RECOGNITION',aggregateId:recognition.consumptionRecognitionEventId,
    payload:{recognitionId:recognition.consumptionRecognitionEventId,qualificationId:input.qualificationId,eligible:input.eligible,concreteVolumeType:input.concreteVolumeType,recognizedAt:input.recognizedAt.toISOString()},correlationId}});
  return {recognition,accumulator,volume,created:true};
}
