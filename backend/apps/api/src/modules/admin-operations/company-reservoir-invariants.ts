import {Prisma} from '@ucell/database';
import {createHash} from 'node:crypto';

// The caller supplies one repeatable-read snapshot. This is a bounded integrity
// read, never a replacement for the transactional economic writers.
export async function companyReservoirCandidates(tx:Prisma.TransactionClient,take:number){
  const [bonuses,rpvs,globals,destinations]=await Promise.all([
    tx.bonusAward.findMany({include:{economicDestination:{select:{destinationId:true}}},orderBy:[{createdAt:'desc'},{bonusAwardId:'asc'}],take}),
    tx.rpvUplineAwardEvent.findMany({include:{economicDestination:{select:{destinationId:true}}},orderBy:[{createdAt:'desc'},{rpvAwardEventId:'asc'}],take}),
    tx.globalPoolAward.findMany({include:{settlement:{select:{periodEnd:true}},economicDestination:{select:{destinationId:true}}},orderBy:[{createdAt:'desc'},{globalPoolAwardId:'asc'}],take}),
    tx.awardEconomicDestination.findMany({include:{qualification:{select:{qualificationNo:true}},effects:true},orderBy:[{recordedAt:'desc'},{destinationId:'asc'}],take}),
  ]);
  const sources=[
    ...bonuses.map(a=>({id:a.bonusAwardId,qid:a.recipientQualificationId,at:a.occurredAt,type:a.awardType,sourceType:'BONUS_AWARD',amount:a.payableAmount,destination:a.economicDestination})),
    ...rpvs.map(a=>({id:a.rpvAwardEventId,qid:a.recipientQualificationId,at:a.occurredAt,type:'RPV',sourceType:'RPV_AWARD',amount:a.payableAmount,destination:a.economicDestination})),
    ...globals.map(a=>({id:a.globalPoolAwardId,qid:a.qualificationId,at:a.settlement.periodEnd,type:'GLOBAL',sourceType:'GLOBAL_AWARD',amount:a.payableAmount,destination:a.economicDestination})),
  ];
  const qualifications=await tx.qualification.findMany({where:{qualificationId:{in:[...new Set(sources.map(s=>s.qid))]}},include:{ownerIntervals:true}});
  const byQualification=new Map(qualifications.map(q=>[q.qualificationId,q]));
  const ids=destinations.map(d=>(d.sourceBonusAwardId??d.sourceRpvAwardId??d.sourceGlobalAwardId)!);
  const [postings,payables]=await Promise.all([
    tx.entitlementReplayPosting.findMany({where:{entitlementKey:{in:ids}}}),
    tx.payableEntry.findMany({where:{sourceId:{in:ids}}}),
  ]);
  const candidates:Array<{code:string;severity:string;sourceType:string;reference:string;evidenceHash:string;detail:Record<string,unknown>}>=[];
  const add=(code:string,sourceType:string,id:string,reference:string,detail:Record<string,unknown>)=>candidates.push({code,severity:'CRITICAL',sourceType,reference,
    evidenceHash:createHash('sha256').update(JSON.stringify({code,source:id,reference,...detail})).digest('hex'),detail});
  for(const source of sources){
    const q=byQualification.get(source.qid);
    const company=q?.kind==='COMPANY_BOOTSTRAP'||q?.ownerIntervals.some(o=>o.ownerType==='COMPANY'&&o.effectiveFrom<=source.at&&(!o.effectiveTo||o.effectiveTo>source.at));
    if(company&&!source.destination) add('COMPANY_AWARD_DESTINATION_MISSING',source.sourceType,source.id,`QUALIFICATION:${q!.qualificationNo}:${source.type}:${source.at.toISOString()}`,
      {awardType:source.type,amount:source.amount.toString()});
  }
  for(const row of destinations){
    const sourceId=(row.sourceBonusAwardId??row.sourceRpvAwardId??row.sourceGlobalAwardId)!;
    const reference=`QUALIFICATION:${row.qualification.qualificationNo}:RESERVOIR_B:${row.awardType}:${row.periodStart.toISOString()}`;
    const originals=row.effects.filter(e=>e.effectType==='ENTITLEMENT');
    const originalTotal=originals.reduce((sum,e)=>sum.add(e.amountDelta),new Prisma.Decimal(0));
    if(originals.length!==1||!originalTotal.eq(row.finalAmount)) add('RESERVOIR_B_ENTITLEMENT_MISMATCH','AWARD_ECONOMIC_DESTINATION',row.destinationId,reference,
      {awardType:row.awardType,expectedAmount:row.finalAmount.toString(),originalAmount:originalTotal.toString(),originalEffectCount:originals.length});
    const expected=postings.filter(p=>p.entitlementKey===sourceId);
    const adjustments=row.effects.filter(e=>e.effectType==='REPLAY_ADJUSTMENT');
    const mismatched=expected.filter(p=>p.recipientQualificationId!==row.qualificationId||p.recoveryId!==null||p.correctionAwardId!==null||!adjustments.some(e=>e.replayPostingId===p.postingId&&e.amountDelta.eq(p.delta)));
    const unmatched=adjustments.filter(e=>!expected.some(p=>p.postingId===e.replayPostingId));
    if(mismatched.length||unmatched.length) add('RESERVOIR_B_REPLAY_MISMATCH','AWARD_ECONOMIC_DESTINATION',row.destinationId,reference,
      {postingCount:expected.length,adjustmentCount:adjustments.length,mismatchedPostingCount:mismatched.length,unmatchedEffectCount:unmatched.length});
    const memberPayables=payables.filter(p=>p.sourceId===sourceId);
    if(memberPayables.length) add('RESERVOIR_B_MEMBER_PAYABLE_CONFLICT','AWARD_ECONOMIC_DESTINATION',row.destinationId,reference,
      {payableCount:memberPayables.length,payableGross:memberPayables.reduce((sum,p)=>sum.add(p.grossAmount),new Prisma.Decimal(0)).toString()});
  }
  return candidates.sort((a,b)=>a.code.localeCompare(b.code)||a.reference.localeCompare(b.reference)||a.evidenceHash.localeCompare(b.evidenceHash));
}
