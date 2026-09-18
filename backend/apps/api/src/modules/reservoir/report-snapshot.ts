import {ConflictException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
import {TreePrincipal} from '../binary-tree/tree-authorization';
type SnapshotEvidence={status:'CURRENT'|'STALE';pendingReturns:string;pendingReplays:string};
export async function reportSnapshot(tx:Prisma.TransactionClient,p:TreePrincipal,query:Prisma.InputJsonValue,token?:string,capture?:()=>Promise<SnapshotEvidence>){
 if(token){
  const row=await tx.reportReadSnapshot.findUnique({where:{snapshotId:token}});
  if(!row||row.actorId!==p.personId||row.role!==p.role)throw new ConflictException({code:'REPORT_SNAPSHOT_CONTEXT_CHANGED'});
  if(row.expiresAt<=new Date())throw new ConflictException({code:'REPORT_SNAPSHOT_EXPIRED'});
  const canonical=(x:any):string=>x&&typeof x==='object'&&!Array.isArray(x)?JSON.stringify(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):JSON.stringify(x);
  const stored=row.query as any;
  // Old snapshots lack completeness evidence and must be refreshed.
  if(!stored.request||!stored.evidence)throw new ConflictException({code:'REPORT_SNAPSHOT_EVIDENCE_REQUIRED'});
  if(canonical(stored.request)!==canonical(query))throw new ConflictException({code:'REPORT_SNAPSHOT_CONTEXT_CHANGED'});
  return {...row,sourceEvidence:stored.evidence as SnapshotEvidence};
 }
 const [visibility]=await tx.$queryRaw<Array<{snapshot:string}>>`SELECT txid_current_snapshot()::text AS snapshot`;
 const evidence=capture?await capture():{status:'STALE' as const,pendingReturns:'UNKNOWN',pendingReplays:'UNKNOWN'};
 const row=await tx.reportReadSnapshot.create({data:{actorId:p.personId!,role:p.role,query:{request:query,evidence},databaseSnapshot:visibility.snapshot,expiresAt:new Date(Date.now()+3600000)}});
 return {...row,sourceEvidence:evidence};
}
