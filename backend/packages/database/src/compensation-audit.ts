import {auditOtherAwards} from './compensation-secondary-audit';
import {auditOrderVolume} from './compensation-audit-orders';
import { Prisma, SettlementBatch } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { binaryCalculationEnvelope } from './award-rebase-topology';
import { effectiveGpv, historicalRecipientState, historicalSponsorAncestors, periodBinary, replayHash, ReplayEnvelope, verifyReplayEnvelope } from './historical-replay';
import { snapshotDecimal } from './parameter-snapshot';
import { effectiveSponsorDirectCount } from './reservoir-b';

type Tx = Prisma.TransactionClient;
type Decimal = Prisma.Decimal;
const zero = new Prisma.Decimal(0);
const total = (rows: Decimal[]) => rows.reduce((a,b) => a.add(b), zero);
type Line = {kind:string; source:string; qid:string; generation:number; value:Decimal; order?:string};
type Finding = {key:string; reason:string; qid?:string; order?:string; expected?:Decimal; actual?:Decimal; evidence:object};
const lineKey = (r:Line) => [r.kind,r.source,r.generation,r.qid].join('/');
const range = (at:Date) => ({effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]});

function referralLines(sources:ReplayEnvelope[], volumes:Map<string,Decimal>) {
  const rows:Line[]=[];
  for(const s of sources) {
    const ancestors=historicalSponsorAncestors(s.evidence,s.inputs.qualificationId,7);
    if(!ancestors.length) continue;
    const g1=historicalRecipientState(s.evidence,ancestors[0].qualification_id);
    const base=volumes.get(s.sourceId)!.mul(snapshotDecimal(s.parameters,'referral.g1.rate',g1.plan));
    for(const ancestor of ancestors) {
      const qid=ancestor.qualification_id, generation=ancestor.generation;
      const state=historicalRecipientState(s.evidence,qid);
      if(!state.active) continue;
      let value=base;
      if(generation>1) {
        const depths:Record<string,number[]>={STARTER:[0,3,4,4,4],ELITE:[0,3,4,5,6],LEADER:[0,3,4,5,7]};
        if(!depths[state.plan]) throw Error('UNKNOWN_HISTORICAL_PLAN');
        if(generation>depths[state.plan][Math.min(4,state.directs)]) continue;
        value=base.mul(snapshotDecimal(s.parameters,'equalization.rate',state.plan+':G'+generation));
      }
      if(value.gt(0)) rows.push({kind:generation===1?'REFERRAL':'EQUALIZATION',qid,generation,source:s.sourceId,order:s.inputs.orderId,value});
    }
  }
  return rows;
}

async function binaryResult(tx:Tx, batch:SettlementBatch, envelope:ReplayEnvelope, volumes:Map<string,Decimal>) {
  const basis=await binaryCalculationEnvelope(tx,envelope);
  const incoming=new Map<string,{left:Decimal;right:Decimal}>();
  for(const carry of basis.evidence.carryRecipients) {
    const previous=await tx.binaryCarry.findFirst({where:{qualificationId:carry.qualificationId,ruleVersionCode:batch.ruleVersionCode,periodEnd:{lt:batch.periodEnd}},orderBy:{periodEnd:'desc'}});
    if(!previous) continue;
    const projection=await tx.replayCarryProjection.findFirst({where:{ruleVersionCode:batch.ruleVersionCode,periodEnd:previous.periodEnd},orderBy:{sequence:'desc'}});
    const corrected=(projection?.carry as Record<string,{left:string;right:string}> | undefined)?.[carry.qualificationId];
    if(projection&&!corrected)throw Error('INCOMPLETE_PRIOR_CARRY');
    incoming.set(carry.qualificationId,{left:new Prisma.Decimal(corrected?.left??previous.leftCarryOut),right:new Prisma.Decimal(corrected?.right??previous.rightCarryOut)});
  }
  return periodBinary(basis,volumes,incoming);
}

async function expectedLines(tx:Tx,batch:SettlementBatch,envelope:ReplayEnvelope,volumes:Map<string,Decimal>,findings:Finding[]) {
  const volume=total([...volumes.values()]);
  if(batch.settlementType==='BINARY_K1') {
    // A missing carry and a missing award can agree with each other. Start with the eligible balls.
    const eligible=await tx.qualification.findMany({
      where:{effectiveAt:{lt:batch.periodEnd},OR:[
        {kind:'COMPANY_BOOTSTRAP'},
        {qualificationStatusHistory:{some:{status:'EFFECTIVE',...range(batch.periodEnd)}}},
      ]},select:{qualificationId:true},
    });
    const expectedIds=new Set(eligible.map(q=>q.qualificationId));
    const carryIds=new Set<string>(envelope.evidence.carryRecipients.map((c:{qualificationId:string})=>c.qualificationId));
    const awardIds=new Set(envelope.recipients.map(r=>r.qualificationId));
    for(const qid of expectedIds) {
      if(!carryIds.has(qid)||!awardIds.has(qid))findings.push({key:'binary-roster/'+qid,reason:'MISSING',qid,
        evidence:{awardType:'BINARY',expectedCarry:true,hasCarry:carryIds.has(qid),hasAward:awardIds.has(qid),earnedAt:batch.periodEnd}});
    }
    for(const qid of carryIds) {
      if(!expectedIds.has(qid))findings.push({key:'extra-binary/'+qid,reason:'UNEXPECTED',qid,evidence:{awardType:'BINARY',earnedAt:batch.periodEnd}});
    }
    const result=await binaryResult(tx,batch,envelope,volumes);
    const rows=await tx.binaryCarry.findMany({where:{periodEnd:batch.periodEnd,ruleVersionCode:batch.ruleVersionCode}});
    const latest=await tx.replayCarryProjection.findFirst({where:{settlementBatchId:batch.settlementBatchId},orderBy:{sequence:'desc'}});
    const projection=latest?.carry as Record<string,{left:string;right:string;pairedPv:string}> | undefined;
    for(const [qid,out] of result.carryOut) {
      const saved=rows.find(r=>r.qualificationId===qid), entry=projection?.[qid];
      if(!saved||projection&&!entry||!out.left.eq(entry?.left??saved.leftCarryOut)||!out.right.eq(entry?.right??saved.rightCarryOut)||!result.pairedPv.get(qid)!.eq(entry?.pairedPv??saved.pairedPv))
        findings.push({key:'carry/'+qid,reason:'CARRY',qid,evidence:{expectedLeft:String(out.left),expectedRight:String(out.right),recordedLeft:String(entry?.left??saved?.leftCarryOut??''),recordedRight:String(entry?.right??saved?.rightCarryOut??'')}});
    }
    return envelope.recipients.map(r=>({kind:'BINARY',qid:r.qualificationId,source:'',generation:0,value:result.payables.get(r.key)!}));
  }
  let rows:Line[];
  let pool:string;
  if(batch.settlementType==='REFERRAL_K0') {
    rows=referralLines(envelope.evidence.sources,volumes);
    pool='pool.referral.rate';
  } else if(batch.settlementType==='MATCHING_K2') {
    const binary=await tx.settlementBatch.findFirstOrThrow({where:{settlementType:'BINARY_K1',periodStart:batch.periodStart,periodEnd:batch.periodEnd,ruleVersionCode:batch.ruleVersionCode,status:'FINALIZED'}});
    const prior=verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:binary.settlementBatchId}}}));
    const computed=await binaryResult(tx,binary,prior,volumes);
    const sponsor=await tx.sponsorRelationship.findMany({where:range(batch.periodEnd)});
    rows=[];pool='pool.matching.rate';
    for(const source of prior.recipients) {
      const sealed=envelope.evidence.matchingSources?.find((s:{sourceAwardId:string})=>s.sourceAwardId===source.awardId)?.evidence;
      const ancestors=historicalSponsorAncestors(sealed??{sponsor},source.qualificationId,5);
      for(const a of ancestors) {
        const qid=a.qualification_id;
        const state=sealed?historicalRecipientState(sealed,qid):null;
        const n=state?.directs??await effectiveSponsorDirectCount(tx,qid,batch.periodEnd);
        if(!n||a.generation>Math.min(5,n+1))continue;
        const company=await tx.qualificationOwnerInterval.findFirst({where:{qualificationId:qid,ownerType:'COMPANY',...range(batch.periodEnd)}});
        const active=state?.active??(company||await tx.activePeriod.findFirst({where:{qualificationId:qid,activeFrom:{lte:batch.periodEnd},OR:[{activeTo:null},{activeTo:{gt:batch.periodEnd}}]}}));
        if(active)rows.push({kind:'MATCHING',source:source.awardId,generation:a.generation,qid,value:computed.payables.get(source.key)!.mul(snapshotDecimal(envelope.parameters,'matching.rate',String(a.generation)))});
      }
    }
  } else throw Error('UNSUPPORTED_SETTLEMENT_TYPE');
  const theory=total(rows.map(r=>r.value));
  const k=theory.gt(0)?Prisma.Decimal.min(1,volume.mul(snapshotDecimal(envelope.parameters,pool)).div(theory)):new Prisma.Decimal(1);
  return rows.map(r=>({...r,value:r.value.mul(k).toDecimalPlaces(4)}));
}

export async function inspectCompensationBatch(tx:Tx,batch:SettlementBatch) {
  const id=batch.settlementBatchId;
  const snap=await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:batch.settlementType,sourceId:id}}});
  const envelope=verifyReplayEnvelope(snap);
  const sources:ReplayEnvelope[]=envelope.evidence.sources;
  const volumes=await effectiveGpv(tx,sources);
  const orders=await auditOrderVolume(tx,batch);
  const findings:Finding[]=[...orders.issues,...await auditOtherAwards(tx,batch)];
  const originals=await tx.pvLedger.findMany({where:{pvType:'GPV',eventType:'GPV_CREATED',ruleVersionCode:batch.ruleVersionCode,occurredAt:{gte:batch.periodStart,lt:batch.periodEnd}}});
  const sourceById=new Map(sources.map(s=>[s.sourceId,s]));
  for(const event of originals) {
    const s=sourceById.get(event.eventId);
    if(!s||!event.amount.eq(s.inputs.volume)||s.inputs.qualificationId!==event.qualificationId||s.inputs.lineId!==event.sourceLineId||s.inputs.orderId!==event.sourceId)
      findings.push({key:'volume/'+event.eventId,reason:'SOURCE',order:event.sourceId,qid:event.qualificationId,evidence:{source:event.eventId}});
  }
  if(sources.length!==originals.length||sourceById.size!==sources.length)findings.push({key:'cohort',reason:'SOURCE',evidence:{snapshot:sources.length,ledger:originals.length}});
  const expected:Line[]=await expectedLines(tx,batch,envelope,volumes,findings);
  const awards=await tx.bonusAward.findMany({where:{settlementBatchId:id},include:{economicDestination:true}});
  const postings=await tx.entitlementReplayPosting.findMany({where:{snapshotId:snap.snapshotId}});
  const actual=new Map<string,Line>();
  for(const a of awards) {
    const source=a.sourceAwardId??a.sourceEventId??'',qid=a.recipientQualificationId;
    const delta=total(postings.filter(p=>p.entitlementKey===a.bonusAwardId).map(p=>p.delta));
    const value=a.payableAmount.add(delta);
    const line={kind:a.awardType,source,qid,generation:a.generationNo??0,value,order:sourceById.get(source)?.inputs.orderId};
    const key=lineKey(line);
    if(actual.has(key))findings.push({key:'duplicate/'+a.bonusAwardId,reason:'DUPLICATE',qid,order:line.order,actual:value,evidence:{award:a.bonusAwardId,source}});
    const owners=await tx.qualificationOwnerInterval.findMany({where:{qualificationId:qid,...range(a.occurredAt)}});
    const holders=await tx.qualificationHolderHistory.findMany({where:{qualificationId:qid,...range(a.occurredAt)}});
    const company=owners.find(o=>o.ownerType==='COMPANY'),d=a.economicDestination;
    if(owners.length>1||!owners.length&&holders.length!==1||!!company!==!!d||d&&(company?.ownerIntervalId!==d.ownerIntervalId||d.qualificationId!==qid)||owners.length===1&&owners[0].ownerType!=='COMPANY'&&holders.length===1&&(owners[0].personId!==holders[0].holderPersonId||owners[0].legalEntityId!==holders[0].holderLegalEntityId))
      findings.push({key:'owner/'+a.bonusAwardId,reason:'OWNER',qid,order:line.order,evidence:{award:a.bonusAwardId,earnedAt:a.occurredAt,owners:owners.length,holders:holders.length}});
    if(d) {
      const effects=await tx.reservoirBEffect.aggregate({where:{destinationId:d.destinationId},_sum:{amountDelta:true}});
      if(!effects._sum.amountDelta?.eq(value))findings.push({key:'reservoir/'+a.bonusAwardId,reason:'COMPANY_BALANCE',qid,expected:value,actual:effects._sum.amountDelta??zero,evidence:{award:a.bonusAwardId}});
    }
    actual.set(key,{...line,value:value.add(actual.get(key)?.value??zero)});
  }
  const expectedTotal=total(expected.map(r=>r.value)),recordedTotal=total([...actual.values()].map(r=>r.value));
  for(const r of expected) {
    const key=lineKey(r),a=actual.get(key);
    if(!a||!a.value.eq(r.value))findings.push({key,reason:!a?'MISSING':r.value.gt(a.value)?'UNDER':'OVER',qid:r.qid,order:r.order,expected:r.value,actual:a?.value??zero,evidence:{awardType:r.kind,generation:r.generation,source:r.source,earnedAt:sourceById.get(r.source)?.at??batch.periodEnd}});
    actual.delete(key);
  }
  for(const [key,r] of actual)findings.push({key,reason:'UNEXPECTED',qid:r.qid,order:r.order,expected:zero,actual:r.value,evidence:{source:r.source,awardType:r.kind}});
  return {findings,checkedSources:sources.length,checkedAwards:awards.length,expectedTotal,recordedTotal,hash:replayHash(JSON.parse(JSON.stringify({input:snap.hash,expected,postings:postings.map(p=>p.postingId).sort(),findings})))};
}
