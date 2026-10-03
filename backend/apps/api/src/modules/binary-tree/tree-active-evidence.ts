import {Prisma} from '@ucell/database';
import {AsOfContext} from '@ucell/shared';
export async function readBallActiveEvidence(tx:Prisma.TransactionClient,id:string,time:AsOfContext):Promise<{state:'ACTIVE'|'INACTIVE'|'UNKNOWN';lastUpdated:Date|null}>{
 const at=new Date(time.asOf),known=new Date(time.knowledgeCutoff);
 const [r]=await tx.$queryRaw<any[]>`SELECT ai.active_from,ai.active_to,ac.cumulative_after,ac.active_threshold,ai.created_at active_recorded_at,ac.recorded_at accumulator_recorded_at
 FROM(SELECT 1) seed LEFT JOIN LATERAL(SELECT active_from,active_to,created_at FROM ledger.active_interval_evidence
  WHERE qualification_id=${id}::uuid AND calendar_month=date_trunc('month',${at}::timestamptz AT TIME ZONE 'Asia/Taipei')::date AND created_at<=${known}
  ORDER BY created_at DESC,active_interval_evidence_id DESC LIMIT 1)ai ON true
 LEFT JOIN LATERAL(SELECT cumulative_after,active_threshold,recorded_at FROM ledger.qualification_month_accumulator_evidence
  WHERE qualification_id=${id}::uuid AND calendar_month=date_trunc('month',${at}::timestamptz AT TIME ZONE 'Asia/Taipei')::date AND recorded_at<=${known}
  ORDER BY sequence_no DESC LIMIT 1)ac ON true`;
 const lastUpdated=[r.active_recorded_at,r.accumulator_recorded_at].filter((d):d is Date=>d instanceof Date).sort((a,b)=>b.getTime()-a.getTime())[0]??null;
 const state=r.active_from?(r.active_from<=at&&r.active_to>at?'ACTIVE':'INACTIVE'):r.cumulative_after!=null&&new Prisma.Decimal(r.cumulative_after).lt(r.active_threshold)?'INACTIVE':'UNKNOWN';
 return {state,lastUpdated};
}

export async function readBallActive(tx:Prisma.TransactionClient,id:string,time:AsOfContext){return (await readBallActiveEvidence(tx,id,time)).state;}

/** Same historical evidence semantics as the single-ball reader, in one database round trip. */
export async function readBallsActiveEvidence(tx:Prisma.TransactionClient,ids:string[],time:AsOfContext){
 const result=new Map<string,{state:'ACTIVE'|'INACTIVE'|'UNKNOWN';lastUpdated:Date|null}>();
 if(!ids.length)return result;
 const at=new Date(time.asOf),known=new Date(time.knowledgeCutoff);
 const rows=await tx.$queryRaw<any[]>`SELECT seed.qualification_id,ai.active_from,ai.active_to,ac.cumulative_after,ac.active_threshold,ai.created_at active_recorded_at,ac.recorded_at accumulator_recorded_at
 FROM unnest(ARRAY[${Prisma.join(ids)}]::uuid[]) AS seed(qualification_id)
 LEFT JOIN LATERAL(SELECT active_from,active_to,created_at FROM ledger.active_interval_evidence
 WHERE qualification_id=seed.qualification_id AND calendar_month=date_trunc('month',${at}::timestamptz AT TIME ZONE 'Asia/Taipei')::date AND created_at<=${known}
 ORDER BY created_at DESC,active_interval_evidence_id DESC LIMIT 1)ai ON true
 LEFT JOIN LATERAL(SELECT cumulative_after,active_threshold,recorded_at FROM ledger.qualification_month_accumulator_evidence
 WHERE qualification_id=seed.qualification_id AND calendar_month=date_trunc('month',${at}::timestamptz AT TIME ZONE 'Asia/Taipei')::date AND recorded_at<=${known}
 ORDER BY sequence_no DESC LIMIT 1)ac ON true`;
 for(const r of rows){
  const lastUpdated=[r.active_recorded_at,r.accumulator_recorded_at].filter((d):d is Date=>d instanceof Date).sort((a,b)=>b.getTime()-a.getTime())[0]??null;
  const state=r.active_from?(r.active_from<=at&&r.active_to>at?'ACTIVE':'INACTIVE'):r.cumulative_after!=null&&new Prisma.Decimal(r.cumulative_after).lt(r.active_threshold)?'INACTIVE':'UNKNOWN';
  result.set(r.qualification_id,{state,lastUpdated});
 }
 return result;
}
