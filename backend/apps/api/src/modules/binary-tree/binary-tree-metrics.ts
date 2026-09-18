import {Prisma,verifyReplayEnvelope} from '@ucell/database';
import {AsOfContext} from '@ucell/shared';
import {treeHash} from '../organization/tree-placement';
const LIMIT=2000;
const unavailable=(reason:string)=>({status:'UNAVAILABLE' as const,reason,value:null,unit:'GPV_POINT',basisVersion:'TREE_GPV_SOURCE_V1'});
/** Report stored GPV once per source; never run entitlement or settlement calculators. */
export async function readFoundingPerformance(tx:Prisma.TransactionClient,treeId:string,root:string,time:AsOfContext){
 const known=new Date(time.knowledgeCutoff),at=new Date(time.asOf);
 const ids=await tx.$queryRaw<Array<{event_id:string;first_side:string}>>`
  SELECT e.event_id,a.first_side FROM ledger.pv_ledger e
  JOIN organization.binary_tree_ancestry a ON a.descendant_qualification_id=e.qualification_id AND a.binary_tree_id=${treeId}::uuid AND a.ancestor_qualification_id=${root}::uuid
  WHERE a.depth>0 AND a.effective_from<=e.occurred_at AND a.recorded_at<=${known}
   AND e.pv_type='GPV' AND e.event_type='GPV_CREATED' AND e.reversal_of_event_id IS NULL AND e.occurred_at<${at} AND e.recorded_at<=${known}
  ORDER BY e.event_id LIMIT 2001`;
 if(ids.length>LIMIT)return unavailable('SOURCE_LIMIT_REQUIRES_PROJECTION');
 const rows=await tx.pvLedger.findMany({where:{eventId:{in:ids.map(x=>x.event_id)}}});
 const snapshots=await tx.historicalReplaySnapshot.findMany({where:{kind:'GPV',sourceId:{in:ids.map(x=>x.event_id)},createdAt:{lte:known}}});
 const corrections=await tx.pvLedger.findMany({where:{reversalOfEventId:{in:ids.map(x=>x.event_id)},recordedAt:{lte:known}},take:20001});
 if(corrections.length>20000)return unavailable('SOURCE_LIMIT_REQUIRES_PROJECTION');
 const totals={cumulative:new Prisma.Decimal(0),month:new Prisma.Decimal(0),leftMonth:new Prisma.Decimal(0),rightMonth:new Prisma.Decimal(0)};
 const refs:Array<{type:string;id:string;revision:string}>=[];
 for(const row of rows){
  const stored=snapshots.find(s=>s.sourceId===row.eventId);if(!stored)return unavailable('HISTORICAL_GPV_EVIDENCE_MISSING');
  let envelope:ReturnType<typeof verifyReplayEnvelope>;try{envelope=verifyReplayEnvelope(stored);}catch{return unavailable('HISTORICAL_GPV_EVIDENCE_INVALID');}
  if(envelope.kind!=='GPV'||envelope.sourceId!==row.eventId||envelope.ruleVersionCode!==row.ruleVersionCode||envelope.at!==row.occurredAt.toISOString()||envelope.evidence.sourceQualification?.qualificationId!==row.qualificationId
   ||!new Prisma.Decimal(envelope.inputs.volume).eq(row.amount)||!Array.isArray(envelope.evidence.binary))return unavailable('HISTORICAL_GPV_EVIDENCE_MISMATCH');
  let child=row.qualificationId,capturedSide:string|null=null;const visited=new Set<string>();
  while(!visited.has(child)){
   visited.add(child);const edges=envelope.evidence.binary.filter((e:any)=>e.childQualificationId===child);if(edges.length!==1)break;
   const edge=edges[0];if(edge.parentQualificationId===root){capturedSide=edge.side;break;}child=edge.parentQualificationId;
  }
  if(capturedSide!==ids.find(x=>x.event_id===row.eventId)!.first_side)return unavailable('HISTORICAL_TREE_PATH_MISMATCH');
  let net=row.amount;
  const postedLines=row.sourceLineId?await tx.returnLine.findMany({where:{orderLineId:row.sourceLineId,returnCase:{status:'POSTED',postedAt:{lte:known}}},include:{returnCase:true},take:2001}):[];
  if(postedLines.length>LIMIT)return unavailable('SOURCE_LIMIT_REQUIRES_PROJECTION');
  const adjustments=corrections.filter(c=>c.reversalOfEventId===row.eventId);
  if(postedLines.length!==adjustments.length)return unavailable('RETURN_REPLAY_NOT_CONVERGED');
  for(const correction of adjustments){
   const line=postedLines.find(l=>l.returnLineId===correction.sourceLineId&&l.returnCaseId===correction.sourceId);
   if(!line||correction.eventType!=='GPV_REVERSAL'||correction.sourceType!=='RETURN'||correction.qualificationId!==row.qualificationId||correction.ruleVersionCode!==row.ruleVersionCode||!correction.amount.eq(line.gpvReversalAmount.negated()))return unavailable('RETURN_REPLAY_EVIDENCE_MISMATCH');
   const audits=await tx.auditEvent.findMany({where:{action:'RETURN_REVERSAL_PROCESSED',entityId:line.returnCaseId,occurredAt:{lte:known}},take:2});
   if(audits.length!==1)return unavailable('RETURN_REPLAY_NOT_CONVERGED');
   net=net.add(correction.amount);refs.push({type:'PvLedger',id:correction.eventId,revision:correction.recordedAt.toISOString()});
  }
  if(net.isNegative())return unavailable('NEGATIVE_EFFECTIVE_GPV');
  totals.cumulative=totals.cumulative.add(net);
  if(row.occurredAt>=new Date(time.periodStart)&&row.occurredAt<new Date(time.periodEnd)){
   totals.month=totals.month.add(net);if(capturedSide==='LEFT')totals.leftMonth=totals.leftMonth.add(net);else totals.rightMonth=totals.rightMonth.add(net);
  }
  refs.push({type:'HistoricalReplaySnapshot',id:stored.snapshotId,revision:stored.hash});
 }
 return {status:'AVAILABLE' as const,reason:null,unit:'GPV_POINT',basisVersion:'TREE_GPV_SOURCE_V1',value:{cumulative:totals.cumulative.toFixed(4),month:totals.month.toFixed(4),leftMonth:totals.leftMonth.toFixed(4),rightMonth:totals.rightMonth.toFixed(4)},sourceEvents:rows.length,sourceHash:treeHash(refs),sourceWatermark:time.knowledgeCutoff,evidenceRefs:refs};
}
export async function readFoundingCarry(tx:Prisma.TransactionClient,root:string,time:AsOfContext){
 const at=new Date(time.asOf),known=new Date(time.knowledgeCutoff);
 const rows=await tx.binaryCarry.findMany({where:{qualificationId:root,periodEnd:{lte:at},createdAt:{lte:known}},orderBy:{periodEnd:'desc'},take:2});
 if(!rows.length)return unavailable('NO_SETTLED_CARRY');
 const row=rows[0];if(rows[1]?.periodEnd.getTime()===row.periodEnd.getTime())return unavailable('AMBIGUOUS_CARRY_RULE_VERSION');
 const batches=await tx.settlementBatch.findMany({where:{settlementType:'BINARY_K1',periodEnd:row.periodEnd,ruleVersionCode:row.ruleVersionCode,status:'FINALIZED',finalizedAt:{lte:new Date(Math.min(at.getTime(),known.getTime()))}},take:2});
 if(batches.length!==1)return unavailable('CARRY_PERIOD_NOT_FINALIZED');
 const batch=batches[0],snapshot=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:batch.settlementBatchId}}});
 if(!snapshot||snapshot.createdAt>known)return unavailable('CARRY_SEAL_MISSING');
 try{const seal=verifyReplayEnvelope(snapshot);if(seal.ruleVersionCode!==batch.ruleVersionCode||!Array.isArray(seal.evidence.carryRecipients)||!seal.evidence.carryRecipients.some((r:any)=>r.qualificationId===root&&new Prisma.Decimal(r.leftCarryOut).eq(row.leftCarryOut)&&new Prisma.Decimal(r.rightCarryOut).eq(row.rightCarryOut)))return unavailable('CARRY_SEAL_MISMATCH');}catch{return unavailable('CARRY_SEAL_INVALID');}
 if(await tx.settlementRecalculationRequest.findFirst({where:{periodEnd:row.periodEnd,createdAt:{lte:known},OR:[{impactedQualificationId:root},{impactedQualificationId:null}],AND:[{OR:[{processedAt:null},{processedAt:{gt:known}}]}]}}))return unavailable('CARRY_REPLAY_PENDING');
 const correction=await tx.replayCarryProjection.findFirst({where:{settlementBatchId:batch.settlementBatchId,createdAt:{lte:known}},orderBy:{sequence:'desc'}});
 const revised=(correction?.carry as any)?.[root];
 if(correction&&!revised)return unavailable('CARRY_CORRECTION_INCOMPLETE');
 try{
  const left=new Prisma.Decimal(correction?revised.left:row.leftCarryOut),right=new Prisma.Decimal(correction?revised.right:row.rightCarryOut);
  if(left.isNegative()||right.isNegative())return unavailable('CARRY_CORRECTION_INVALID');
  return {status:'AVAILABLE' as const,reason:null,unit:'GPV_POINT',basisVersion:'SEALED_BINARY_CARRY_V1',value:{left:left.toFixed(4),right:right.toFixed(4)},settlementId:batch.settlementBatchId,periodEnd:row.periodEnd.toISOString(),ruleVersion:row.ruleVersionCode,replaySequence:correction?.sequence.toString()??null,sourceWatermark:time.knowledgeCutoff,evidenceRefs:[{type:'HistoricalReplaySnapshot',id:snapshot.snapshotId,revision:snapshot.hash},...(correction?[{type:'ReplayCarryProjection',id:correction.sequence.toString(),revision:correction.stateHash}]:[])]};
 }catch{return unavailable('CARRY_CORRECTION_INVALID');}
}
