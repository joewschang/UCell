import {Prisma,periodCloseOperationalState} from '@ucell/database';
import {createHash} from 'node:crypto';

export async function periodCloseCandidates(tx:Prisma.TransactionClient,take:number,thresholdHours?:number){
 const now=new Date();
 const rows=await tx.periodCloseJob.findMany({where:{OR:[{receipt:{is:null}},{outbox:{processStatus:{not:'PROCESSED'}}}]},include:{receipt:true,outbox:true},orderBy:[{periodEnd:'asc'},{periodCloseJobId:'asc'}],take});
 const candidates=[];
 for(const row of rows){
  const status=await periodCloseOperationalState(tx,row,{now,thresholdHours});
  const code=status.state==='EVIDENCE_INCONSISTENT'?'PERIOD_CLOSE_EVIDENCE_INCONSISTENT':status.state==='FAILED'?'PERIOD_CLOSE_DEAD':status.state==='LEASE_EXPIRED'?'PERIOD_CLOSE_LEASE_EXPIRED':status.overdue?'PERIOD_CLOSE_OVERDUE':null;
  if(!code)continue;
  const detail={kind:row.kind,periodStart:row.periodStart.toISOString(),periodEnd:row.periodEnd.toISOString(),ruleVersionCode:row.ruleVersionCode,state:status.state,waiting:status.waiting,eligibleAt:status.eligibleAt,thresholdHours:status.thresholdHours,attemptCount:row.outbox.attemptCount};
  candidates.push({code,severity:code==='PERIOD_CLOSE_EVIDENCE_INCONSISTENT'?'CRITICAL':'HIGH',sourceType:'PERIOD_CLOSE_JOB',reference:status.jobReference,evidenceHash:createHash('sha256').update(JSON.stringify({code,reference:status.jobReference,...detail})).digest('hex'),detail});
 }
 return candidates;
}
