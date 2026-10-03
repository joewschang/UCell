import {Prisma} from '@prisma/client';
import {pending} from '@ucell/database';
import {createHash} from 'node:crypto';
const ref=(kind:string,id:string)=>`${kind}:${createHash('sha256').update(`${kind}:${id}`).digest('hex')}`;

/** Exact return evidence only. Month-wide amounts are never allocated to one order. */
export async function returnActiveEvidence(tx:Prisma.TransactionClient,returnIds:string[]){
  if(!returnIds.length)return [];
  const decisions=await tx.consumptionRecognitionEvent.findMany({where:{sourceType:'RETURN',sourceId:{in:returnIds},direction:'REVERSAL',recognitionPurpose:'EPV'},orderBy:[{createdAt:'asc'},{consumptionRecognitionEventId:'asc'}]});
  const output=[];
  for(const decision of decisions){
    const original=decision.reversalOfEventId?await tx.consumptionRecognitionEvent.findUnique({where:{consumptionRecognitionEventId:decision.reversalOfEventId}}):null;
    if(!original||original.direction!=='ORIGINAL'||original.qualificationId!==decision.qualificationId||original.recognitionMonth.getTime()!==decision.recognitionMonth.getTime())pending('HISTORICAL_SNAPSHOT_CORRUPT','Active replay conflicts with its original recognition');
    const accumulators=await tx.qualificationMonthAccumulatorEvidence.findMany({where:{consumptionRecognitionEventId:decision.consumptionRecognitionEventId}});
    if(accumulators.length>1)pending('HISTORICAL_SNAPSHOT_CORRUPT','Active replay has ambiguous accumulation');
    const accumulator=accumulators[0];
    if(accumulator&&(accumulator.qualificationId!==decision.qualificationId||accumulator.calendarMonth.getTime()!==decision.recognitionMonth.getTime()||accumulator.ruleVersionCode!==decision.ruleVersionCode||!accumulator.eligibleDelta.eq(decision.eligibleAmount)||!accumulator.cumulativeBefore.add(accumulator.eligibleDelta).eq(accumulator.cumulativeAfter)))pending('HISTORICAL_SNAPSHOT_CORRUPT','Active replay accumulation conflicts with its decision');
    const intervals=accumulator?await tx.activeIntervalEvidence.findMany({where:{sourceAccumulatorEvidenceId:accumulator.qualificationMonthAccumulatorEvidenceId},orderBy:[{createdAt:'asc'},{activeIntervalEvidenceId:'asc'}]}):[];
    if(intervals.length>1)pending('HISTORICAL_SNAPSHOT_CORRUPT','Active replay has ambiguous replacement intervals');
    const replacements=[];
    for(const interval of intervals){
      const removed=interval.reasonCode==='HISTORICAL_RETURN_REPLAY_INACTIVE';
      if(interval.qualificationId!==decision.qualificationId||interval.calendarMonth.getTime()!==decision.recognitionMonth.getTime()||interval.ruleVersionCode!==decision.ruleVersionCode||
        (removed?interval.activeFrom.getTime()!==interval.activeTo.getTime()||!interval.supersedesActiveEvidenceId||accumulator!.cumulativeAfter.gte(accumulator!.activeThreshold):interval.reasonCode!=='HISTORICAL_RETURN_REPLAY'||interval.activeFrom>=interval.activeTo||accumulator!.cumulativeAfter.lt(accumulator!.activeThreshold)))pending('HISTORICAL_SNAPSHOT_CORRUPT','Active replacement conflicts with its recorded accumulation');
      const prior=interval.supersedesActiveEvidenceId?await tx.activeIntervalEvidence.findUnique({where:{activeIntervalEvidenceId:interval.supersedesActiveEvidenceId}}):null;
      if(interval.supersedesActiveEvidenceId&&(!prior||prior.qualificationId!==interval.qualificationId||prior.calendarMonth.getTime()!==interval.calendarMonth.getTime()))pending('HISTORICAL_SNAPSHOT_CORRUPT','Active replacement points to unrelated prior evidence');
      replacements.push({reference:ref('ACTIVE_EVIDENCE',interval.activeIntervalEvidenceId),status:removed?'HISTORICAL_INTERVAL_REMOVED':'HISTORICAL_INTERVAL_REPLACED',activeFrom:interval.activeFrom.toISOString(),activeTo:interval.activeTo.toISOString(),recordedAt:interval.createdAt.toISOString(),previousInterval:prior?{reference:ref('ACTIVE_EVIDENCE',prior.activeIntervalEvidenceId),activeFrom:prior.activeFrom.toISOString(),activeTo:prior.activeTo.toISOString()}:null});
    }
    output.push({reference:ref('CONSUMPTION_RECOGNITION',decision.consumptionRecognitionEventId),returnReference:ref('RETURN',decision.sourceId),basis:'RETURN_MONTH_REPLAY_NOT_CURRENT_ACTIVE',recognitionMonth:decision.recognitionMonth.toISOString(),recordedAt:decision.createdAt.toISOString(),ruleVersionCode:decision.ruleVersionCode,
      monthContext:accumulator?{basis:'HISTORICAL_MONTH_CONTEXT_NOT_ORDER_TOTAL',cumulativeBefore:accumulator.cumulativeBefore.toString(),eligibleDelta:accumulator.eligibleDelta.toString(),cumulativeAfter:accumulator.cumulativeAfter.toString(),activeThreshold:accumulator.activeThreshold.toString()}:null,replacements});
  }
  return output;
}
