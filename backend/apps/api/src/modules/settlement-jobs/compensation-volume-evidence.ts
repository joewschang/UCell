import {Prisma,verifyReplayEnvelope} from '@ucell/database';
import {compensationPeriodEvidence,CompensationPeriod} from './compensation-period-evidence';

/** Verify original recognition evidence; linked correction facts remain separate. */
export async function compensationVolumeEvidence(tx:Prisma.TransactionClient,period:CompensationPeriod,cohort:Awaited<ReturnType<typeof compensationPeriodEvidence>>){
 const volumes=await tx.pvLedger.findMany({where:{ruleVersionCode:period.ruleVersionCode,pvType:{in:['GPV','RPV','EPV']},reversalOfEventId:null,OR:[
  {occurredAt:{gte:period.periodStart,lt:period.periodEnd}},
  ...cohort.required.filter(row=>row.kind!=='PAYABLE_PREPARATION').map(row=>({pvType:'GPV' as const,occurredAt:{gte:row.periodStart,lt:row.periodEnd}})),
 ]},orderBy:{eventId:'asc'}});
 const schedules=await tx.monthlyRecognitionSchedule.findMany({where:{pvLedgerEventId:{in:volumes.filter(row=>row.pvType==='RPV').map(row=>row.eventId)}}});
 const sourceId=(row:typeof volumes[number])=>row.pvType==='RPV'?schedules.find(schedule=>schedule.pvLedgerEventId===row.eventId)?.recognitionId:row.eventId;
 const ids=volumes.map(sourceId).filter((id):id is string=>Boolean(id));
 const snapshots=await tx.historicalReplaySnapshot.findMany({where:{kind:{in:['GPV','RPV','EPV']},sourceId:{in:ids}}});
 const counts={GPV:0,RPV:0,EPV:0},invalid={GPV:0,RPV:0,EPV:0};let lateOriginals=0;
 for(const row of volumes){
  const kind=row.pvType;if(kind!=='GPV'&&kind!=='RPV'&&kind!=='EPV')continue;
  counts[kind]++;
  try{
   const id=sourceId(row),snapshot=snapshots.find(item=>item.kind===row.pvType&&item.sourceId===id),envelope=verifyReplayEnvelope(snapshot);
   if(!id||envelope.ruleVersionCode!==period.ruleVersionCode||envelope.kind!==row.pvType||envelope.sourceId!==id||!new Prisma.Decimal(envelope.inputs.volume).equals(row.amount))throw new Error('SOURCE');
   if(row.pvType==='RPV'&&envelope.inputs.eventId!==row.eventId)throw new Error('RECOGNITION');
  }catch{invalid[kind]++;}
  if(cohort.jobs.some(job=>cohort.sealed.has(job.periodCloseJobId)&&job.receipt&&row.occurredAt>=job.periodStart&&row.occurredAt<job.periodEnd&&row.recordedAt>job.receipt.completedAt))lateOriginals++;
 }
 return {counts,invalid,lateOriginals,ready:Object.values(invalid).every(count=>count===0)&&lateOriginals===0};
}
