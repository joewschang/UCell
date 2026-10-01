import {Prisma,verifySnapshot,verifyReplayEnvelope,ParameterSnapshot} from '@ucell/database';
import {SettlementCalendarService} from '@ucell/settlement';

export type CompensationPeriod={periodStart:Date;periodEnd:Date;ruleVersionCode:string};
type Window={kind:string;periodStart:Date;periodEnd:Date};
const identity=(row:Window)=>`${row.kind}:${row.periodStart.toISOString()}:${row.periodEnd.toISOString()}`;
const families=['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE'];

/** Resolve the approved source cohort, including whole weeks that start before a 10/25 period. */
export async function compensationPeriodEvidence(tx:Prisma.TransactionClient,period:CompensationPeriod){
 const calendar=new SettlementCalendarService(tx as any);
 const preparation=await tx.periodCloseJob.findUnique({where:{kind_periodStart_periodEnd_ruleVersionCode:{kind:'PAYABLE_PREPARATION',...period}},include:{receipt:true,outbox:true}});
 let parameters:ParameterSnapshot|undefined,configured=true;
 const problems:Array<{code:string;jobId?:string}>=[];
 let windows:Window[]=families.map(kind=>({kind,periodStart:period.periodStart,periodEnd:period.periodEnd}));
 try{
  parameters=preparation?verifySnapshot(preparation.parameterSnapshot):await calendar.captureForPeriod(tx,period.periodStart,period.periodEnd,'PAYABLE_PREPARATION',period.ruleVersionCode);
  if(parameters.ruleVersionCode!==period.ruleVersionCode)throw new Error('RULE');
  const canonical=await calendar.preparationWindows(tx,period.periodStart,period.periodEnd,parameters);
  if(canonical)windows=canonical;
  else{
   windows=[];
   for(const kind of families){
    let cursor=period.periodStart;
    while(cursor<period.periodEnd){
     const next=await calendar.periodFor(tx,cursor,parameters,kind);
     if(next.start.getTime()!==cursor.getTime()||next.end>period.periodEnd||next.end<=cursor||windows.length>=100)throw new Error('COVERAGE');
     windows.push({kind,periodStart:next.start,periodEnd:next.end});cursor=next.end;
    }
   }
  }
 }catch{configured=false;windows=families.map(kind=>({kind,periodStart:period.periodStart,periodEnd:period.periodEnd}));problems.push({code:'COMPENSATION_APPROVED_CALENDAR_UNAVAILABLE'});}
 const required=[...windows,{kind:'PAYABLE_PREPARATION',periodStart:period.periodStart,periodEnd:period.periodEnd}];
 const jobs=await tx.periodCloseJob.findMany({where:{ruleVersionCode:period.ruleVersionCode,OR:required},include:{receipt:true,outbox:{include:{periodProcessTransitions:{orderBy:{revision:'desc'},take:1}}}},orderBy:[{kind:'asc'},{periodStart:'asc'}]});
 const byWindow=new Map(jobs.map(job=>[identity(job),job]));
 const missing=required.filter(window=>!byWindow.has(identity(window)));
 if(preparation&&configured){
  const expected=windows.map(window=>byWindow.get(identity(window))?.periodCloseJobId).filter((id):id is string=>Boolean(id)).sort();
  if(expected.length!==windows.length||JSON.stringify(expected)!==JSON.stringify([...(preparation.prerequisiteIds as string[])].sort()))problems.push({code:'COMPENSATION_PREPARATION_COHORT_MISMATCH',jobId:preparation.periodCloseJobId});
 }
 const snapshots=await tx.historicalReplaySnapshot.findMany({where:{snapshotId:{in:jobs.flatMap(job=>job.receipt?[job.receipt.snapshotId]:[])}}});
 const sealed=new Set<string>();
 for(const job of jobs){
  if(Boolean(job.receipt)!==(job.outbox.processStatus==='PROCESSED')){problems.push({code:'COMPENSATION_RECEIPT_STATUS_MISMATCH',jobId:job.periodCloseJobId});continue;}
  if(!job.receipt)continue;
  try{
   const pinned=verifySnapshot(job.parameterSnapshot),snapshot=snapshots.find(row=>row.snapshotId===job.receipt!.snapshotId),envelope=verifyReplayEnvelope(snapshot);
   if(envelope.kind!==job.kind||envelope.sourceId!==job.receipt.sourceId||envelope.ruleVersionCode!==period.ruleVersionCode||envelope.parameters.hash!==pinned.hash||envelope.inputs.periodStart!==job.periodStart.toISOString()||envelope.inputs.periodEnd!==job.periodEnd.toISOString())throw new Error('IDENTITY');
   sealed.add(job.periodCloseJobId);
  }catch{problems.push({code:'COMPENSATION_SEALED_RESULT_INVALID',jobId:job.periodCloseJobId});}
 }
 const receiptSources=(kinds:string[])=>jobs.filter(job=>kinds.includes(job.kind)&&sealed.has(job.periodCloseJobId)).map(job=>job.receipt!.sourceId);
 const referral=jobs.find(job=>job.kind==='REFERRAL_K0'&&job.periodStart.getTime()===period.periodStart.getTime()&&job.periodEnd.getTime()===period.periodEnd.getTime()&&sealed.has(job.periodCloseJobId));
 return {configured,required,jobs,missing,problems,sealed,allComplete:configured&&missing.length===0&&problems.length===0&&sealed.size===required.length,
  inputSealedAt:referral?.receipt?.completedAt??null,
  sourcePeriod:{periodStart:period.periodStart,periodEnd:period.periodEnd,settlementSourceIds:receiptSources(['REFERRAL_K0','BINARY_K1','MATCHING_K2']),globalSourceIds:receiptSources(['GLOBAL'])}};
}
