import {ConflictException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {AsOfContext} from '@ucell/shared';
import {TreePrincipal} from './tree-authorization';
/** Retain transaction visibility, not an approximation of commit order with timestamps. */
export async function readTreeNodeSnapshot(db:PrismaService,p:TreePrincipal,id:string,time:AsOfContext,after?:string,token?:string,parentQualificationId?:string){
 if(after&&!token)throw new ConflictException({code:'TREE_SNAPSHOT_REQUIRED'});
 return db.$transaction(async tx=>{
  let snapshot=token?await tx.treeReadSnapshot.findUnique({where:{snapshotToken:token}}):null;
  if(token&&(!snapshot||snapshot.binaryTreeId!==id||snapshot.actorId!==p.personId||snapshot.role!==p.role))throw new ConflictException({code:'TREE_SNAPSHOT_CONTEXT_CHANGED'});
  if(snapshot&&snapshot.expiresAt<=new Date())throw new ConflictException({code:'TREE_SNAPSHOT_EXPIRED'});
  if(snapshot){const saved=snapshot.time as Record<string,unknown>;if(Object.keys(time).some(key=>saved[key]!==time[key as keyof AsOfContext]))throw new ConflictException({code:'TREE_SNAPSHOT_CONTEXT_CHANGED'});}
  const at=new Date(time.asOf),known=new Date(time.knowledgeCutoff);
  const root=await tx.companySponsorDesignation.findUnique({where:{binaryTreeId:id}});
  if(!root||root.effectiveAt>at||root.recordedAt>known)return {status:'UNAVAILABLE',time,items:[],nextCursor:null,total:null,snapshotToken:token??null};
  if(!snapshot){
   const [visibility]=await tx.$queryRaw<Array<{snapshot:string}>>`SELECT txid_current_snapshot()::text AS snapshot`;
   snapshot=await tx.treeReadSnapshot.create({data:{binaryTreeId:id,actorId:p.personId!,role:p.role,time:time as unknown as Prisma.InputJsonValue,databaseSnapshot:visibility.snapshot,expiresAt:new Date(Date.now()+3600000)}});
  }
  const visibility=snapshot.databaseSnapshot;
  const visible=Prisma.sql`m.binary_tree_id=${id}::uuid AND m.effective_from<=${at} AND m.recorded_at<=${known} AND txid_visible_in_snapshot(m.recorded_transaction,${visibility}::txid_snapshot)`;
  const parentScope=parentQualificationId?Prisma.sql`AND EXISTS(SELECT 1 FROM organization.placement_tree_evidence child WHERE child.placement_tree_evidence_id=m.placement_tree_evidence_id AND child.parent_qualification_id=${parentQualificationId}::uuid AND child.effective_at<=${at} AND child.recorded_at<=${known})`:Prisma.empty;
  const [count]=await tx.$queryRaw<Array<{total:bigint}>>(Prisma.sql`SELECT count(*) AS total FROM organization.binary_tree_membership m WHERE ${visible} ${parentScope}`);
  const rows=await tx.$queryRaw<Array<{qualificationId:string;parentQualificationId:string|null;side:string|null;evidenceId:string|null;depth:number|null;ownerType:string|null;owners:bigint}>>(Prisma.sql`
   SELECT e.placement_tree_evidence_id AS "evidenceId",m.qualification_id AS "qualificationId",e.parent_qualification_id AS "parentQualificationId",e.side::text AS side,a.depth,o.owner_type AS "ownerType",o.owners
   FROM organization.binary_tree_membership m
   LEFT JOIN organization.placement_tree_evidence e ON e.placement_tree_evidence_id=m.placement_tree_evidence_id AND e.effective_at<=${at} AND e.recorded_at<=${known}
   LEFT JOIN organization.binary_tree_ancestry a ON a.binary_tree_id=m.binary_tree_id AND a.ancestor_qualification_id=${root.qualificationId}::uuid AND a.descendant_qualification_id=m.qualification_id AND a.effective_from<=${at} AND a.recorded_at<=${known}
   LEFT JOIN LATERAL (
    SELECT min(owner_type::text) AS owner_type,count(*) AS owners FROM membership.qualification_owner_interval own
    WHERE own.qualification_id=m.qualification_id AND own.effective_from<=${at} AND own.recorded_at<=${known}
     AND txid_visible_in_snapshot(own.recorded_transaction,${visibility}::txid_snapshot)
     AND (own.effective_to IS NULL OR own.effective_to>${at} OR own.closed_recorded_at>${known}
      OR (own.closed_transaction IS NOT NULL AND NOT txid_visible_in_snapshot(own.closed_transaction,${visibility}::txid_snapshot)))
   ) o ON true
   WHERE ${visible} ${parentScope} ${after?Prisma.sql`AND m.qualification_id>${after}::uuid`:Prisma.empty}

   ORDER BY m.qualification_id LIMIT 101`);
  if(rows.some(row=>row.owners!==1n||row.depth===null||row.evidenceId===null))return {status:'UNAVAILABLE',time,items:[],nextCursor:null,total:null,snapshotToken:snapshot.snapshotToken};
  return {status:'AVAILABLE',time,parentQualificationId:parentQualificationId??null,total:Number(count.total),snapshotToken:snapshot.snapshotToken,snapshotExpiresAt:snapshot.expiresAt.toISOString(),
   items:rows.slice(0,100).map(({owners,evidenceId,...row})=>({...row,activeLabel:row.ownerType==='COMPANY'?'Always Active (Company Rule)':null})),nextCursor:rows.length>100?rows[99].qualificationId:null};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
}
