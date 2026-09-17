import {Prisma,verifyReplayEnvelope,historicalSponsorAncestors,historicalBinaryAncestors,ReplayEnvelope} from '@ucell/database';
import {createHash} from 'crypto';
import {DAY} from './analytics.policy';

export const VOLUME_TYPES=['GPV','RPV','EPV'] as const;
type VolumeType=typeof VOLUME_TYPES[number];
export type VolumeFact={id:string;qualificationId:string;type:VolumeType;original:string;adjustment:string;envelope:ReplayEnvelope};
// Fixed-point accumulation retains all four ledger decimals, including large totals.
export function units(value:string):bigint{if(!/^-?\d+(\.\d{1,4})?$/.test(value))throw Error('INVALID_VOLUME_DECIMAL');const negative=value.startsWith('-'),[whole,fraction='']=value.replace('-','').split('.');return (BigInt(whole)*10000n+BigInt(fraction.padEnd(4,'0')))*(negative?-1n:1n);}
export function decimal(value:bigint){const sign=value<0n?'-':'';const n=value<0n?-value:value;return `${sign}${n/10000n}.${(n%10000n).toString().padStart(4,'0')}`;}
const bucket=()=>({original:0n,adjustment:0n,events:0});
const serialized=(b:ReturnType<typeof bucket>)=>({original:decimal(b.original),adjustment:decimal(b.adjustment),net:decimal(b.original+b.adjustment),events:b.events});
/** Attribute adjustments to the original event's captured path, never today's tree. */
export function aggregateVolumes(root:string,tree:'sponsor'|'binary',facts:VolumeFact[]){
 const result=Object.fromEntries(VOLUME_TYPES.map(type=>[type,{total:bucket(),left:bucket(),right:bucket(),generations:Array.from({length:12},bucket)}])) as Record<VolumeType,{total:ReturnType<typeof bucket>;left:ReturnType<typeof bucket>;right:ReturnType<typeof bucket>;generations:ReturnType<typeof bucket>[]} >;
 for(const fact of facts){
  const graph=fact.envelope.evidence;
  const path=tree==='sponsor'?historicalSponsorAncestors(graph,fact.qualificationId,12):historicalBinaryAncestors(graph,fact.qualificationId,12);
  const ancestor=path.find(a=>a.qualification_id===root);if(!ancestor)continue;
  const row=result[fact.type],targets=[row.total,row.generations[ancestor.generation-1]];
  if(tree==='binary'){
   const child=ancestor.generation===1?fact.qualificationId:path[ancestor.generation-2].qualification_id;
   const edge=graph.binary.find((e:any)=>e.childQualificationId===child&&e.parentQualificationId===root);
   if(!edge||!['LEFT','RIGHT'].includes(edge.side))throw Error('INVALID_BINARY_SIDE');targets.push(edge.side==='LEFT'?row.left:row.right);
  }
  const original=units(fact.original),adjustment=units(fact.adjustment);if(original<0n||original+adjustment<0n)throw Error('INVALID_EFFECTIVE_VOLUME');
  for(const target of targets){target.original+=original;target.adjustment+=adjustment;target.events++;}
 }
 return VOLUME_TYPES.map(type=>({type,unit:`${type}_POINT`,total:serialized(result[type].total),left:tree==='binary'?serialized(result[type].left):null,right:tree==='binary'?serialized(result[type].right):null,generations:result[type].generations.map((b,i)=>({generation:i+1,...serialized(b)}))}));
}
const LIMIT=2000,ADJUSTMENT_LIMIT=20000;
function bounded<T>(rows:T[],limit:number){if(rows.length>limit)throw Error('VOLUME_SOURCE_LIMIT');return rows;}
function verifySource(event:any,row:any){
 const envelope=verifyReplayEnvelope(row),sourceId=event.pvType==='RPV'?event.sourceLineId:event.eventId;
 if(envelope.kind!==event.pvType||envelope.sourceId!==sourceId||envelope.ruleVersionCode!==event.ruleVersionCode||envelope.at!==event.occurredAt.toISOString()
  ||envelope.evidence.at!==envelope.at||envelope.evidence.sourceQualification?.qualificationId!==event.qualificationId
  ||!new Prisma.Decimal(envelope.inputs.volume).eq(event.amount)||!Array.isArray(envelope.evidence.sponsor)||!Array.isArray(envelope.evidence.binary))throw Error('VOLUME_SOURCE_MISMATCH');
 if(event.pvType==='RPV'&&envelope.inputs.eventId!==event.eventId)throw Error('VOLUME_SOURCE_MISMATCH');
 return envelope;
}
export async function captureVolumeProjection(tx:Prisma.TransactionClient,root:string,at:Date){
 const from=new Date(at.getTime()-30*DAY),ruleVersionCode='R1.0B';
 const meta={metricVersion:'HISTORICAL_VOLUME_30D_V1',ruleVersionCode,from:from.toISOString(),toExclusive:at.toISOString(),asOf:at.toISOString(),basis:'ORIGINAL_EVENT_WINDOW_WITH_ADJUSTMENTS_KNOWN_AT_CAPTURE',genericPV:{status:'UNAVAILABLE',reason:'PV_IS_A_CLASS_NOT_AN_ADDITIVE_TOTAL'}};
 // Data-quality errors isolate this optional report. DB failures still abort the transaction.
 const events=await tx.pvLedger.findMany({where:{ruleVersionCode,occurredAt:{gte:from,lt:at},recordedAt:{lte:at},reversalOfEventId:null,OR:VOLUME_TYPES.map(pvType=>({pvType,eventType:`${pvType}_CREATED`}))},orderBy:{eventId:'asc'},take:LIMIT+1});
 if(events.length>LIMIT)return {...meta,status:'UNAVAILABLE',reason:'VOLUME_SOURCE_LIMIT',sponsor:null,binary:null,carry:null};
 const ids=events.map(e=>e.eventId),snapshotIds=events.map(e=>e.pvType==='RPV'?e.sourceLineId:e.eventId).filter((id):id is string=>!!id);
 const adjustments=await tx.pvLedger.findMany({where:{reversalOfEventId:{in:ids},recordedAt:{lte:at},occurredAt:{lte:at}},take:ADJUSTMENT_LIMIT+1,orderBy:{eventId:'asc'}});
 const snapshots=await tx.historicalReplaySnapshot.findMany({where:{sourceId:{in:snapshotIds},kind:{in:[...VOLUME_TYPES]},createdAt:{lte:at}},take:LIMIT*3+1});
 const carry=await captureCarry(tx,root,at,ruleVersionCode);
 try{
  bounded(adjustments,ADJUSTMENT_LIMIT);bounded(snapshots,LIMIT*3);
  const rows=new Map(snapshots.map(row=>[`${row.kind}:${row.sourceId}`,row])),sums=new Map<string,bigint>();
  const byId=new Map(events.map(e=>[e.eventId,e]));
  for(const row of adjustments){const original=byId.get(row.reversalOfEventId!)!;if(row.pvType!==original.pvType||row.qualificationId!==original.qualificationId||row.ruleVersionCode!==original.ruleVersionCode)throw Error('VOLUME_ADJUSTMENT_MISMATCH');sums.set(original.eventId,(sums.get(original.eventId)??0n)+units(row.amount.toFixed(4)));}
  const facts:VolumeFact[]=events.map(event=>({id:event.eventId,qualificationId:event.qualificationId,type:event.pvType as VolumeType,original:event.amount.toFixed(4),adjustment:decimal(sums.get(event.eventId)??0n),envelope:verifySource(event,rows.get(`${event.pvType}:${event.pvType==='RPV'?event.sourceLineId:event.eventId}`))}));
  const sponsor=aggregateVolumes(root,'sponsor',facts),binary=aggregateVolumes(root,'binary',facts);
  const evidenceHash=createHash('sha256').update(JSON.stringify({events,adjustments,snapshotHashes:snapshots.map(s=>s.hash).sort()})).digest('hex');
  return {...meta,status:'AVAILABLE',reason:null,sponsor,binary,carry,evidenceHash,sourceEvents:events.length};
 }catch(error){return {...meta,status:'UNAVAILABLE',reason:error instanceof Error&&error.message==='VOLUME_SOURCE_LIMIT'?'VOLUME_SOURCE_LIMIT':'HISTORICAL_VOLUME_EVIDENCE_INCOMPLETE',sponsor:null,binary:null,carry};}
}
export async function captureCarry(tx:Prisma.TransactionClient,root:string,at:Date,ruleVersionCode:string){
 const rows=await tx.binaryCarry.findMany({where:{qualificationId:root,ruleVersionCode,periodEnd:{lte:at},createdAt:{lte:at}},orderBy:{periodEnd:'desc'},take:1});
 if(!rows.length)return {status:'UNAVAILABLE',reason:'NO_SETTLED_CARRY'};
 const row=rows[0],batch=await tx.settlementBatch.findFirst({where:{settlementType:'BINARY_K1',periodEnd:row.periodEnd,ruleVersionCode,status:'FINALIZED',finalizedAt:{lte:at}}});
 if(!batch)return {status:'UNAVAILABLE',reason:'CARRY_PERIOD_NOT_FINALIZED'};
 const correction=await tx.replayCarryProjection.findFirst({where:{settlementBatchId:batch.settlementBatchId,periodEnd:row.periodEnd,ruleVersionCode,createdAt:{lte:at}},orderBy:{sequence:'desc'}});
 try{
  const revised=(correction?.carry as any)?.[root];if(correction&&!revised)throw Error('MISSING_CORRECTION');
  const left=correction?String(revised.left):row.leftCarryOut.toFixed(4),right=correction?String(revised.right):row.rightCarryOut.toFixed(4);
  if(units(left)<0n||units(right)<0n)throw Error('NEGATIVE_CARRY');
  return {status:'AVAILABLE',unit:'GPV_POINT',periodEnd:row.periodEnd.toISOString(),basis:correction?'LATEST_REPLAY_CORRECTION':'FINALIZED_ORIGINAL',correctionSequence:correction?.sequence.toString()??null,
   originalLeft:row.leftCarryOut.toFixed(4),originalRight:row.rightCarryOut.toFixed(4),left:decimal(units(left)),right:decimal(units(right))};
 }catch{return {status:'UNAVAILABLE',reason:'CARRY_CORRECTION_INCOMPLETE',periodEnd:row.periodEnd.toISOString()};}
}
