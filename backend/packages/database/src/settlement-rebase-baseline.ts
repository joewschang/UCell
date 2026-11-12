import { HistoricalReplaySnapshot, Prisma } from '@prisma/client';
import { replayHash, verifyReplayEnvelope, type ReplayEnvelope } from './historical-replay';
import { pending } from './parameter-snapshot';

type Pointer = {
  version:number; originalSnapshotId:string; originalHash:string; snapshotId:string;
  snapshotHash:string; topologyHash:string; retiredAwardIds:string[];
};

function invalid():never {
  return pending('SETTLEMENT_REBASE_INVALID','Settlement reattribution does not match the original calculation evidence');
}

// The source's economic facts and parameter version stay bound to the original ledger event.
function sourceIdentity(envelope:ReplayEnvelope) {
  const sources=envelope.evidence.sources as ReplayEnvelope[];
  if(!Array.isArray(sources)) invalid();
  const facts=sources.map(s=>[s.sourceId,s.kind,s.at,s.ruleVersionCode,s.parameters.hash,replayHash(s.inputs)]);
  if(new Set(facts.map(f=>f[0])).size!==facts.length) invalid();
  return replayHash(facts.sort((a,b)=>a[0].localeCompare(b[0])));
}

export async function settlementRebaseBaseline(tx:Prisma.TransactionClient, original:HistoricalReplaySnapshot) {
  const initial=verifyReplayEnvelope(original);
  const originalResult={row:original,envelope:initial,postingSnapshotIds:[original.snapshotId],retiredAwardIds:new Set<string>()};
  if(!['REFERRAL_K0','MATCHING_K2'].includes(original.kind)) return originalResult;
  if(initial.sourceId!==original.sourceId || initial.kind!==original.kind) invalid();
  const receipts=await tx.auditEvent.findMany({where:{action:'AWARD_REBASE_BASELINE',entityType:'SETTLEMENT_BATCH',entityId:original.sourceId},
    orderBy:[{occurredAt:'asc'},{auditEventId:'asc'}],select:{afterHash:true,afterData:true}});
  if(!receipts.length) return originalResult;

  const pointers=receipts.map(record=>{
    const p=record.afterData as unknown as Pointer|null;
    if(!p || p.version!==1 || p.originalHash!==original.hash || p.originalSnapshotId!==original.snapshotId ||
       !p.snapshotId || !p.snapshotHash || record.afterHash!==p.snapshotHash || !/^[0-9a-f]{64}$/.test(p.topologyHash) ||
       !Array.isArray(p.retiredAwardIds) || p.retiredAwardIds.some(id=>typeof id!=='string') ||
       new Set(p.retiredAwardIds).size!==p.retiredAwardIds.length) invalid();
    return p;
  });
  const ids=pointers.map(p=>p.snapshotId);
  if(new Set(ids).size!==ids.length || ids.includes(original.snapshotId)) invalid();
  const revisions=await tx.historicalReplaySnapshot.findMany({where:{snapshotId:{in:ids}}});
  const rows=new Map(revisions.map(row=>[row.snapshotId,row]));
  const originalSources=sourceIdentity(initial);
  let current=originalResult;
  for(const p of pointers) {
    const row=rows.get(p.snapshotId);
    if(!row || row.kind!=='AWARD_REBASE_V1_'+initial.kind || row.hash!==p.snapshotHash || row.ruleVersionCode!==original.ruleVersionCode) invalid();
    const envelope=verifyReplayEnvelope(row);
    if(envelope.sourceId!==initial.sourceId || envelope.kind!==initial.kind || envelope.at!==initial.at ||
       envelope.parameters.hash!==initial.parameters.hash || sourceIdentity(envelope)!==originalSources) invalid();
    const activeIds=new Set(envelope.recipients.map(r=>r.awardId));
    if(activeIds.size!==envelope.recipients.length || envelope.recipients.some(r=>r.key!==r.awardId) || p.retiredAwardIds.some(id=>activeIds.has(id))) invalid();
    current={row,envelope,postingSnapshotIds:[original.snapshotId,...ids],retiredAwardIds:new Set(p.retiredAwardIds)};
  }
  return current;
}
