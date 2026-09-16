import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { captureParameters, ParameterSnapshot, pending, snapshotDecimal, verifySnapshot } from './parameter-snapshot';

const dec=(value:string|number|Prisma.Decimal)=>new Prisma.Decimal(value);
const money=(value:Prisma.Decimal)=>value.toDecimalPlaces(4,Prisma.Decimal.ROUND_HALF_UP);
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function canonical(value:any):string {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object') return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
export const replayHash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
function historicalAccountingTimezone(parameters:ParameterSnapshot){
  const rows=parameters.parameters.filter(p=>p.code==='accounting.timezone'&&p.scope==='*');
  if(rows.length!==1||typeof rows[0].value!=='string') pending('HISTORICAL_SNAPSHOT_MISSING','Original accounting timezone Parameter evidence is required');
  try{new Intl.DateTimeFormat('en',{timeZone:rows[0].value});}catch{pending('HISTORICAL_SNAPSHOT_CORRUPT','Original accounting timezone is invalid');}
  return rows[0].value;
}
export interface HistoricalRecipient {
  key:string; awardId:string; awardType:'REFERRAL'|'EQUALIZATION'|'BINARY'|'MATCHING'|'EPV'|'RPV';
  qualificationId:string; sourceEventId?:string; sourceAwardId?:string; generation:number;
  active:boolean; eligible:boolean; theory:string; posted:string; pendingUntil:string;
  rate?:string; detail:any; qualification:any;
}
export interface ReplayEnvelope {
  format:'UCELL_HISTORICAL_REPLAY_V1'; kind:string; sourceId:string; ruleVersionCode:string;
  at:string; parameters:ParameterSnapshot; recipients:HistoricalRecipient[]; evidence:any; inputs:any;
}
async function qualificationEvidence(tx:Prisma.TransactionClient,qid:string,at:Date) {
  const plans=await tx.qualificationPlanHistory.findMany({where:{qualificationId:qid,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}});
  const statuses=await tx.qualificationStatusHistory.findMany({where:{qualificationId:qid,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}});
  if(plans.length!==1||statuses.length!==1) pending('HISTORICAL_SNAPSHOT_MISSING',`Historical Qualification evidence is incomplete or overlapping: ${qid}/${at.toISOString()}`);
  const active=await tx.activePeriod.findMany({where:{qualificationId:qid,activeFrom:{lte:at}},orderBy:{activeFrom:'asc'}});
  return json({qualificationId:qid,at:at.toISOString(),plan:plans[0],status:statuses[0],activeIntervals:active});
}
export async function captureHistoricalGraph(tx:Prisma.TransactionClient,sourceQualificationId:string,at:Date) {
  const where={effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]};
  const sponsor=await tx.sponsorRelationship.findMany({where,orderBy:{childQualificationId:'asc'}});
  const binary=await tx.binaryPlacement.findMany({where,orderBy:{childQualificationId:'asc'}});
  // Persist an explicit empty path for a root; replay never reconstructs from live tables.
  const ids=new Set([sourceQualificationId]);
  for(const edges of [sponsor,binary]) {
    let child=sourceQualificationId;const seen=new Set<string>();
    while(!seen.has(child)) {
      seen.add(child);
      const parents=edges.filter(edge=>edge.childQualificationId===child);
      if(parents.length>1) pending('HISTORICAL_SNAPSHOT_MISSING','Historical tree has overlapping parents');
      if(!parents.length) break;
      child='sponsorQualificationId' in parents[0]?parents[0].sponsorQualificationId:parents[0].parentQualificationId;
      ids.add(child);
    }
    if(seen.has(child)&&edges.some(edge=>edge.childQualificationId===child)) pending('HISTORICAL_SNAPSHOT_CORRUPT','Historical tree cycle');
  }
  const qualifications:Record<string,any>={},effectiveDirectCounts:Record<string,number>={};
  for(const id of [...ids].sort()) {
    qualifications[id]=await qualificationEvidence(tx,id,at);
    let count=0;
    for(const child of sponsor.filter(edge=>edge.sponsorQualificationId===id)) {
      const states=await tx.qualificationStatusHistory.findMany({where:{qualificationId:child.childQualificationId,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}});
      if(states.length!==1) pending('HISTORICAL_SNAPSHOT_MISSING','Historical direct Qualification status is missing or overlapping');
      if(states[0].status==='EFFECTIVE') count++;
    }
    effectiveDirectCounts[id]=count;
  }
  return json({at:at.toISOString(),sourceQualification:qualifications[sourceQualificationId],qualifications,effectiveDirectCounts,sponsor,binary});
}
export function historicalSponsorAncestors(graph:any,qualificationId:string,maxGeneration:number) {
  const result:Array<{qualification_id:string;generation:number}>=[];
  let child=qualificationId;const seen=new Set([child]);
  for(let generation=1;generation<=maxGeneration;generation++) {
    const parents=graph.sponsor.filter((edge:any)=>edge.childQualificationId===child);
    if(parents.length>1) pending('HISTORICAL_SNAPSHOT_CORRUPT','Overlapping Sponsor parents');
    if(!parents.length) break;
    child=parents[0].sponsorQualificationId;
    if(seen.has(child)) pending('HISTORICAL_SNAPSHOT_CORRUPT','Sponsor cycle');
    seen.add(child);result.push({qualification_id:child,generation});
  }
  return result;
}
export function historicalBinaryAncestors(graph:any,qualificationId:string,maxGeneration:number) {
  if(!Array.isArray(graph?.binary)||!qualificationId) pending('HISTORICAL_SNAPSHOT_MISSING','Original Binary path evidence is required');
  const result:Array<{qualification_id:string;generation:number}>=[];
  let child=qualificationId;const seen=new Set([child]);
  for(let generation=1;generation<=maxGeneration;generation++){
    const parents=graph.binary.filter((edge:any)=>edge.childQualificationId===child);
    if(parents.length>1) pending('HISTORICAL_SNAPSHOT_CORRUPT','Overlapping original Binary parents');
    if(!parents.length) break;
    child=parents[0].parentQualificationId;
    if(!child||seen.has(child)) pending('HISTORICAL_SNAPSHOT_CORRUPT','Original Binary path is invalid or cyclic');
    seen.add(child);result.push({qualification_id:child,generation});
  }
  return result;
}
export function historicalRecipientState(graph:any,qid:string) {
  const evidence=graph?.qualifications?.[qid];
  if(!evidence?.plan||!evidence?.status||!Array.isArray(evidence.activeIntervals)||graph.effectiveDirectCounts?.[qid]==null) pending('HISTORICAL_SNAPSHOT_MISSING','Original recipient evidence is missing');
  const at=new Date(graph.at).getTime();
  return {plan:evidence.plan.planCode,effective:evidence.status.status==='EFFECTIVE',directs:graph.effectiveDirectCounts[qid] as number,
    active:evidence.activeIntervals.some((interval:any)=>new Date(interval.activeFrom).getTime()<=at&&(!interval.activeTo||new Date(interval.activeTo).getTime()>at))};
}
export async function storeReplaySnapshot(tx:Prisma.TransactionClient,envelope:ReplayEnvelope) {
  const content=json(envelope),hash=replayHash(content);
  const existing=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:envelope.kind,sourceId:envelope.sourceId}}});
  if(existing) {
    if(existing.hash!==hash) pending('HISTORICAL_SNAPSHOT_CONFLICT','Original replay evidence cannot be replaced');
    return existing;
  }
  return tx.historicalReplaySnapshot.create({data:{kind:envelope.kind,sourceId:envelope.sourceId,ruleVersionCode:envelope.ruleVersionCode,content,hash}});
}
export function verifyReplayEnvelope(row:any):ReplayEnvelope {
  if(!row) pending('HISTORICAL_SNAPSHOT_MISSING','Original calculation evidence was not captured; current state cannot substitute');
  const envelope=row.content as ReplayEnvelope;
  if(envelope?.format!=='UCELL_HISTORICAL_REPLAY_V1'||!Array.isArray(envelope.recipients)||!envelope.evidence||!envelope.inputs)
    pending('HISTORICAL_SNAPSHOT_MISSING','Complete historical replay envelope is required');
  if(replayHash(envelope)!==row.hash) pending('HISTORICAL_SNAPSHOT_CORRUPT','Historical calculation evidence was modified');
  const parameters=verifySnapshot(envelope.parameters);
  if(parameters.ruleVersionCode!==envelope.ruleVersionCode||row.ruleVersionCode!==envelope.ruleVersionCode) pending('RULE_VERSION_MISMATCH','Historical evidence rule version mismatch');
  if(envelope.kind==='RPV'){
    const source=envelope.evidence.sourceQualification?.qualificationId;
    if(!source||!envelope.inputs.eventId||!envelope.inputs.subscriptionId||!envelope.inputs.recognitionMonth||!Number.isFinite(new Date(envelope.inputs.recognitionMonth).getTime())||envelope.inputs.recognizedAmount==null||envelope.inputs.volume==null)
      pending('HISTORICAL_SNAPSHOT_MISSING','RPV original event/recognition period/Qualification evidence is required');
    if(envelope.evidence.at!==envelope.at||parameters.effectiveAt!==envelope.at||envelope.evidence.sourceQualification.at!==envelope.at)
      pending('HISTORICAL_SNAPSHOT_CORRUPT','RPV evidence must use the original recognition timestamp');
    const period=envelope.inputs.recognitionPeriod;
    if(!period?.start||!period?.end||!period?.timezone||!Number.isFinite(new Date(period.start).getTime())||!Number.isFinite(new Date(period.end).getTime()))
      pending('HISTORICAL_SNAPSHOT_MISSING','RPV original business period and timezone evidence is required');
    if(period.timezone!==historicalAccountingTimezone(parameters)||new Date(envelope.at)<new Date(period.start)||new Date(envelope.at)>=new Date(period.end))
      pending('HISTORICAL_SNAPSHOT_CORRUPT','RPV recognition conflicts with original business period/Parameter evidence');
    const path=historicalBinaryAncestors(envelope.evidence,source,12);
    if(path.length!==envelope.recipients.length) pending('HISTORICAL_SNAPSHOT_MISSING','Complete original RPV recipient allocation is required');
    historicalRecipientState(envelope.evidence,source);
  }
  for(const recipient of envelope.recipients) {
    if(!recipient.qualification?.plan||!recipient.qualification?.status||!Array.isArray(recipient.qualification.activeIntervals))
      pending('HISTORICAL_SNAPSHOT_MISSING','Historical recipient Qualification/Active evidence is required');
    const at=new Date(recipient.qualification.at??envelope.at).getTime();
    if(!Number.isFinite(at)) pending('HISTORICAL_SNAPSHOT_MISSING','Historical recipient calculation timestamp is missing');
    const active=recipient.qualification.activeIntervals.some((interval:any)=>new Date(interval.activeFrom).getTime()<=at&&(!interval.activeTo||new Date(interval.activeTo).getTime()>at));
    if(active!==recipient.active) pending('HISTORICAL_SNAPSHOT_CORRUPT','Recipient Active flag conflicts with original evidence');
    if(!recipient.active&&dec(recipient.posted).gt(0)) pending('HISTORICAL_SNAPSHOT_CORRUPT','Inactive historical recipient cannot have positive entitlement');
    if(envelope.kind==='RPV'){
      const source=envelope.evidence.sourceQualification.qualificationId;
      const path=historicalBinaryAncestors(envelope.evidence,source,12);
      if(path.find(item=>item.generation===recipient.generation)?.qualification_id!==recipient.qualificationId)
        pending('HISTORICAL_SNAPSHOT_CORRUPT','RPV recipient conflicts with original Binary path');
      const state=historicalRecipientState(envelope.evidence,recipient.qualificationId);
      const directs=recipient.detail?.effectiveDirectCount,depth=recipient.detail?.unlockedDepth;
      if(directs==null||depth==null) pending('HISTORICAL_SNAPSHOT_MISSING','RPV original recipient eligibility evidence is required');
      if(path.find(item=>item.generation===recipient.generation)?.qualification_id!==recipient.qualificationId||state.active!==recipient.active||state.directs!==directs||recipient.eligible!==(recipient.active&&recipient.generation<=depth))
        pending('HISTORICAL_SNAPSHOT_CORRUPT','RPV recipient conflicts with original Binary/Active/Qualification evidence');
    }
    if(envelope.kind==='MATCHING_K2') {
      const source=envelope.evidence.matchingSources?.find((item:any)=>item.sourceAwardId===recipient.sourceAwardId);
      if(!source) pending('HISTORICAL_SNAPSHOT_MISSING','Original Matching Sponsor source evidence is missing');
      const ancestors=historicalSponsorAncestors(source.evidence,source.sourceQualificationId,7);
      if(ancestors.find(item=>item.generation===recipient.generation)?.qualification_id!==recipient.qualificationId||historicalRecipientState(source.evidence,recipient.qualificationId).active!==recipient.active)
        pending('HISTORICAL_SNAPSHOT_CORRUPT','Matching recipient conflicts with original Sponsor/Active evidence');
    }
    if(envelope.kind==='EPV') {
      const expectedRate=snapshotDecimal(parameters,recipient.generation===0?'epv.self.rate':'epv.upline.rate',recipient.generation===0?'*':String(recipient.generation));
      if(recipient.rate==null||!dec(recipient.rate).eq(expectedRate)) pending('HISTORICAL_SNAPSHOT_CORRUPT','EPV rate conflicts with original Parameter snapshot');
      const ancestors=historicalSponsorAncestors(envelope.evidence,envelope.inputs.qualificationId,5);
      const original=recipient.generation===0?envelope.inputs.qualificationId:ancestors.find(item=>item.generation===recipient.generation)?.qualification_id;
      if(original!==recipient.qualificationId||historicalRecipientState(envelope.evidence,recipient.qualificationId).active!==recipient.active) pending('HISTORICAL_SNAPSHOT_CORRUPT','EPV recipient conflicts with original Sponsor/Active evidence');
    }
  }
  return envelope;
}
export async function sealGpvEvent(tx:Prisma.TransactionClient,event:any) {
  const parameters=await captureParameters(tx,event.occurredAt,event.ruleVersionCode);
  const evidence=await captureHistoricalGraph(tx,event.qualificationId,event.occurredAt);
  return storeReplaySnapshot(tx,{format:'UCELL_HISTORICAL_REPLAY_V1',kind:'GPV',sourceId:event.eventId,ruleVersionCode:event.ruleVersionCode,at:event.occurredAt.toISOString(),parameters,recipients:[],evidence,
    inputs:{eventId:event.eventId,qualificationId:event.qualificationId,orderId:event.sourceType==='ORDER'?event.sourceId:null,lineId:event.sourceLineId,volume:event.amount.toString()}});
}
async function recipientFromAward(tx:Prisma.TransactionClient,award:any,rpv=false):Promise<HistoricalRecipient> {
  const at=award.occurredAt;
  const qualification=await qualificationEvidence(tx,award.recipientQualificationId,at);
  return {key:rpv?award.rpvAwardEventId:award.bonusAwardId,awardId:rpv?award.rpvAwardEventId:award.bonusAwardId,awardType:rpv?'RPV':award.awardType,
    qualificationId:award.recipientQualificationId,sourceEventId:award.sourceEventId??undefined,sourceAwardId:award.sourceAwardId??undefined,
    generation:rpv?award.binaryGeneration:(award.generationNo??0),active:award.activeSnapshot,
    eligible:rpv?(award.activeSnapshot&&award.binaryGeneration<=award.unlockedDepthSnapshot):(award.activeSnapshot&&(award.awardType!=='MATCHING'||award.generationNo<=award.calculationDetail?.unlockDepth)),
    theory:award.theoryAmount.toString(),posted:award.payableAmount.toString(),pendingUntil:(award.pendingUntil??at).toISOString(),
    rate:award.calculationDetail?.rate,detail:json(rpv?{unlockedDepth:award.unlockedDepthSnapshot,effectiveDirectCount:award.effectiveDirectCountSnapshot}:award.calculationDetail),qualification};
}
export async function sealEpvEvent(tx:Prisma.TransactionClient,event:any,parameters:ParameterSnapshot,month:any,order:any) {
  const awards=await tx.bonusAward.findMany({where:{sourceEventId:event.eventId,awardType:'EPV'},orderBy:{bonusAwardId:'asc'}});
  const recipients:HistoricalRecipient[]=[];
  for(const award of awards) recipients.push(await recipientFromAward(tx,award));
  return storeReplaySnapshot(tx,{format:'UCELL_HISTORICAL_REPLAY_V1',kind:'EPV',sourceId:event.eventId,at:event.occurredAt.toISOString(),ruleVersionCode:event.ruleVersionCode,parameters,recipients,
    evidence:await captureHistoricalGraph(tx,event.qualificationId,event.occurredAt),inputs:{orderId:order.orderId,qualificationId:order.qualificationId,consumption:order.netAmount.toString(),volume:event.amount.toString(),monthStart:month.start.toISOString(),monthEnd:month.end.toISOString(),timezone:month.timezone,base:month.base.toString(),rate:month.rate.toString()}});
}
export async function sealRpvEvent(tx:Prisma.TransactionClient,event:any,schedule:any) {
  const parameters=await captureParameters(tx,event.occurredAt,event.ruleVersionCode);
  const timezone=historicalAccountingTimezone(parameters);
  const [period]=await tx.$queryRaw<Array<{start:Date;end:Date}>>`
    SELECT (date_trunc('month',${schedule.recognitionMonth}::date)::timestamp AT TIME ZONE ${timezone}) AS start,
      ((date_trunc('month',${schedule.recognitionMonth}::date)+interval '1 month')::timestamp AT TIME ZONE ${timezone}) AS end`;
  if(!period||event.occurredAt<period.start||event.occurredAt>=period.end) pending('HISTORICAL_SNAPSHOT_MISSING','Original RPV event does not belong to its recorded business recognition period');
  const awards=await tx.rpvUplineAwardEvent.findMany({where:{recognitionId:schedule.recognitionId},orderBy:{rpvAwardEventId:'asc'}});
  const recipients:HistoricalRecipient[]=[];
  for(const award of awards) recipients.push(await recipientFromAward(tx,award,true));
  return storeReplaySnapshot(tx,{format:'UCELL_HISTORICAL_REPLAY_V1',kind:'RPV',sourceId:schedule.recognitionId,at:event.occurredAt.toISOString(),ruleVersionCode:event.ruleVersionCode,parameters,recipients,
    evidence:await captureHistoricalGraph(tx,event.qualificationId,event.occurredAt),inputs:{eventId:event.eventId,subscriptionId:schedule.subscriptionId,volume:event.amount.toString(),recognitionMonth:json(schedule.recognitionMonth),recognitionPeriod:{start:period.start.toISOString(),end:period.end.toISOString(),timezone},recognizedAmount:schedule.recognizedAmount.toString(),entitlementMethod:'ORIGINAL_FIXED_AWARD_ON_VALID_RECOGNITION'}});
}
export async function sealSettlement(tx:Prisma.TransactionClient,batch:any) {
  const parameters=verifySnapshot(batch.parameterSnapshot);
  const awards=await tx.bonusAward.findMany({where:{settlementBatchId:batch.settlementBatchId},orderBy:{bonusAwardId:'asc'}});
  const eligibilityEvidence=await tx.bonusCalculationEvidence.findMany({where:{settlementBatchId:batch.settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}});
  const recipients:HistoricalRecipient[]=[];
  for(const award of awards) recipients.push(await recipientFromAward(tx,award));
  const matchingSources:any[]=[];
  if(batch.settlementType==='MATCHING_K2')for(const sourceAwardId of [...new Set(awards.map(award=>award.sourceAwardId))]) {
    if(!sourceAwardId) pending('HISTORICAL_SNAPSHOT_MISSING','Matching original source award required');
    const source=await tx.bonusAward.findUnique({where:{bonusAwardId:sourceAwardId}});
    if(!source||source.awardType!=='BINARY') pending('HISTORICAL_SNAPSHOT_MISSING','Matching original Binary source is missing');
    matchingSources.push({sourceAwardId,evidence:await captureHistoricalGraph(tx,source.recipientQualificationId,batch.periodEnd),sourceQualificationId:source.recipientQualificationId});
  }
  const originals=await tx.pvLedger.findMany({where:{pvType:'GPV',eventType:'GPV_CREATED',ruleVersionCode:batch.ruleVersionCode,occurredAt:{gte:batch.periodStart,lt:batch.periodEnd}},orderBy:{eventId:'asc'}});
  const sources:any[]=[];
  for(const event of originals) {
    const row=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'GPV',sourceId:event.eventId}}});
    sources.push(verifyReplayEnvelope(row));
  }
  if(batch.settlementType==='REFERRAL_K0')for(const recipient of recipients) {
    const source=sources.find(item=>item.sourceId===recipient.sourceEventId);
    const qualification=source?.evidence.qualifications?.[recipient.qualificationId];
    if(!qualification) pending('HISTORICAL_SNAPSHOT_MISSING','K0 recipient original recognition Qualification evidence is missing');
    if(historicalSponsorAncestors(source.evidence,source.inputs.qualificationId,7).find(item=>item.generation===recipient.generation)?.qualification_id!==recipient.qualificationId)
      pending('HISTORICAL_SNAPSHOT_CORRUPT','K0 recipient conflicts with original recognition Sponsor path');
    recipient.qualification=qualification;
  }
  const carries=batch.settlementType==='BINARY_K1'?await tx.binaryCarry.findMany({where:{periodEnd:batch.periodEnd,ruleVersionCode:batch.ruleVersionCode},orderBy:{qualificationId:'asc'}}):[];
  const carryRecipients:any[]=[];
  for(const carry of carries) {
    const qualification=await qualificationEvidence(tx,carry.qualificationId,batch.periodEnd);
    const active=!!await tx.activePeriod.findFirst({where:{qualificationId:carry.qualificationId,activeFrom:{lte:batch.periodEnd},OR:[{activeTo:null},{activeTo:{gt:batch.periodEnd}}]}});
    carryRecipients.push({...json(carry) as object,qualification,active});
  }
  return storeReplaySnapshot(tx,{format:'UCELL_HISTORICAL_REPLAY_V1',kind:batch.settlementType,sourceId:batch.settlementBatchId,at:batch.periodEnd.toISOString(),ruleVersionCode:batch.ruleVersionCode,parameters,recipients,
    evidence:{sources,carryRecipients,matchingSources,eligibilityEvidence:json(eligibilityEvidence)},inputs:{periodStart:batch.periodStart.toISOString(),periodEnd:batch.periodEnd.toISOString(),totalGpv:batch.totalGpv.toString(),k:batch.kFactor.toString()}});
}

export function historicalMonthlyEntitlements(events:ReplayEnvelope[],remaining:Map<string,Prisma.Decimal>) {
  const sorted=[...events].sort((a,b)=>a.at.localeCompare(b.at)||a.inputs.orderId.localeCompare(b.inputs.orderId));
  let cumulative=dec(0);const results=new Map<string,Prisma.Decimal>();
  for(const event of sorted) {
    const base=dec(event.inputs.base),rate=dec(event.inputs.rate);
    if(event.inputs.base!==sorted[0].inputs.base||event.inputs.rate!==sorted[0].inputs.rate||event.inputs.timezone!==sorted[0].inputs.timezone||event.ruleVersionCode!==sorted[0].ruleVersionCode)
      pending('EPV_MONTH_PARAMETER_DECISION_PENDING','Incompatible historical monthly parameters require SA support');
    const amount=remaining.get(event.inputs.orderId);
    if(amount===undefined||amount.lt(0)||amount.gt(event.inputs.consumption)) pending('RETURN_AMOUNT_EXCEEDED','Effective consumption is outside its original amount');
    const before=Prisma.Decimal.max(dec(0),cumulative.sub(base)).mul(rate);
    cumulative=cumulative.add(amount);
    results.set(event.sourceId,Prisma.Decimal.max(dec(0),cumulative.sub(base)).mul(rate).sub(before));
  }
  return results;
}
export function periodK0(envelope:ReplayEnvelope,effective:Map<string,Prisma.Decimal>) {
  const sources=envelope.evidence.sources as ReplayEnvelope[];
  const sourceMap=new Map(sources.map(source=>[source.sourceId,source]));
  const total=sources.reduce((sum,source)=>sum.add(effective.get(source.sourceId)??pending('HISTORICAL_SNAPSHOT_MISSING','Source effective volume is absent')),dec(0));
  const theories=envelope.recipients.map(recipient=>{
    const source=sourceMap.get(recipient.sourceEventId!);
    if(!source) pending('HISTORICAL_SNAPSHOT_MISSING','K0 exact source event evidence is absent');
    const original=dec(recipient.detail.originalCalculationSourceVolume??source.inputs.volume);
    return recipient.eligible&&original.gt(0)?dec(recipient.theory).mul(effective.get(source.sourceId)!).div(original):dec(0);
  });
  const theory=theories.reduce((sum,value)=>sum.add(value),dec(0));
  const pool=total.mul(snapshotDecimal(envelope.parameters,'pool.referral.rate'));
  const k=theory.gt(0)?Prisma.Decimal.min(dec(1),pool.div(theory)):dec(1);
  return {k,total,payables:new Map(envelope.recipients.map((recipient,index)=>[recipient.key,money(theories[index].mul(k))]))};
}
export function sourceSide(source:ReplayEnvelope,root:string):'LEFT'|'RIGHT'|null {
  let child=source.inputs.qualificationId;
  const edges=source.evidence.binary as any[];const seen=new Set<string>();
  while(!seen.has(child)) {
    seen.add(child);const parents=edges.filter(edge=>edge.childQualificationId===child);
    if(parents.length>1) pending('HISTORICAL_SNAPSHOT_CORRUPT','Overlapping historical Binary parent');
    const edge=parents[0];if(!edge) return null;
    if(edge.parentQualificationId===root) return edge.side;
    child=edge.parentQualificationId;
  }
  pending('HISTORICAL_SNAPSHOT_CORRUPT','Historical Binary cycle');
}
export function periodBinary(envelope:ReplayEnvelope,effective:Map<string,Prisma.Decimal>,carryIn:Map<string,{left:Prisma.Decimal;right:Prisma.Decimal}>) {
  const sources=envelope.evidence.sources as ReplayEnvelope[];
  const carryOut=new Map<string,{left:Prisma.Decimal;right:Prisma.Decimal}>();
  const theories=new Map<string,Prisma.Decimal>();
  for(const [qid,incoming] of carryIn) if((incoming.left.gt(0)||incoming.right.gt(0))&&!envelope.evidence.carryRecipients.some((carry:any)=>carry.qualificationId===qid)) pending('HISTORICAL_SNAPSHOT_MISSING','Historical carry continuation recipient is missing');
  for(const carry of envelope.evidence.carryRecipients) {
    if(!carry.qualification?.plan||!carry.qualification?.status||typeof carry.active!=='boolean') pending('HISTORICAL_SNAPSHOT_MISSING','Complete historical carry recipient is required');
    const incoming=carryIn.get(carry.qualificationId)??{left:dec(carry.leftCarryIn),right:dec(carry.rightCarryIn)};
    let left=incoming.left,right=incoming.right;
    for(const source of sources) {
      const volume=effective.get(source.sourceId);
      if(volume===undefined) pending('HISTORICAL_SNAPSHOT_MISSING','Effective source volume is absent');
      const side=sourceSide(source,carry.qualificationId);
      if(side==='LEFT') left=left.add(volume);if(side==='RIGHT') right=right.add(volume);
    }
    if(left.lt(0)||right.lt(0)) pending('NEGATIVE_ECONOMIC_GPV','Effective historical carry cannot be negative');
    const paired=Prisma.Decimal.min(left,right,dec(carry.weeklyCapSnapshot));
    theories.set(carry.qualificationId,carry.active?paired.mul(snapshotDecimal(envelope.parameters,'binary.pair.rate')):dec(0));
    carryOut.set(carry.qualificationId,{left:left.sub(paired),right:right.sub(paired)});
  }
  const total=sources.reduce((sum,source)=>sum.add(effective.get(source.sourceId)!),dec(0));
  const theory=[...theories.values()].reduce((sum,value)=>sum.add(value),dec(0));
  const pool=total.mul(snapshotDecimal(envelope.parameters,'pool.binary.rate'));
  const k=theory.gt(0)?Prisma.Decimal.min(dec(1),pool.div(theory)):dec(1);
  const payables=new Map<string,Prisma.Decimal>();
  for(const recipient of envelope.recipients) {
    if(!theories.has(recipient.qualificationId)) pending('HISTORICAL_SNAPSHOT_MISSING','Binary entitlement missing original carry inputs');
    payables.set(recipient.key,money(theories.get(recipient.qualificationId)!.mul(k)));
  }
  // Zero original awards must be captured so a later historical carry correction can create entitlement.
  for(const [qid,theoryAmount] of theories) if(theoryAmount.gt(0)&&!envelope.recipients.some(r=>r.qualificationId===qid)) pending('HISTORICAL_SNAPSHOT_MISSING','Historical zero entitlement recipient was not captured');
  return {k,total,payables,carryOut};
}
export function periodMatching(envelope:ReplayEnvelope,binaryPaid:Map<string,Prisma.Decimal>,effectiveTotal:Prisma.Decimal) {
  const theories=envelope.recipients.map(recipient=>{
    if(!recipient.sourceAwardId||!binaryPaid.has(recipient.sourceAwardId)||recipient.rate==null) pending('HISTORICAL_SNAPSHOT_MISSING','Matching exact original source/rate required');
    return recipient.eligible?binaryPaid.get(recipient.sourceAwardId)!.mul(dec(recipient.rate)):dec(0);
  });
  const theory=theories.reduce((sum,value)=>sum.add(value),dec(0));
  const pool=effectiveTotal.mul(snapshotDecimal(envelope.parameters,'pool.matching.rate'));
  const k=theory.gt(0)?Prisma.Decimal.min(dec(1),pool.div(theory)):dec(1);
  return {k,payables:new Map(envelope.recipients.map((recipient,index)=>[recipient.key,money(theories[index].mul(k))]))};
}

export async function appendEntitlementDelta(tx:Prisma.TransactionClient,row:any,recipient:HistoricalRecipient,recalculated:Prisma.Decimal,actionKey:string,stateHash:string,returnCaseId?:string) {
  const existing=await tx.entitlementReplayPosting.findUnique({where:{actionKey_snapshotId_entitlementKey:{actionKey,snapshotId:row.snapshotId,entitlementKey:recipient.key}}});
  if(existing) return existing;
  const envelope=verifyReplayEnvelope(row);
  const sealed=envelope.recipients.find(item=>item.key===recipient.key);
  if(!sealed||replayHash(sealed)!==replayHash(recipient)) pending('HISTORICAL_SNAPSHOT_CORRUPT','Recipient must exactly match original sealed entitlement');
  if(recalculated.lt(0)||(!recipient.eligible&&recalculated.gt(0))) pending('HISTORICAL_SNAPSHOT_CORRUPT','Recalculated entitlement violates original eligibility');
  const original=dec(recipient.posted),entitlement=money(recalculated);
  const posted=await tx.entitlementReplayPosting.aggregate({where:{snapshotId:row.snapshotId,entitlementKey:recipient.key},_sum:{delta:true}});
  const delta=entitlement.sub(original).sub(posted._sum.delta??dec(0));
  let correctionAwardId:string|undefined,recoveryId:string|undefined;
  if(delta.gt(0)) {
    const award=await tx.bonusAward.create({data:{awardType:recipient.awardType,recipientQualificationId:recipient.qualificationId,
      sourceAwardId:recipient.awardType==='RPV'?undefined:recipient.awardId,sourceEventId:randomUUID(),generationNo:recipient.generation,
      theoryAmount:delta,payableAmount:delta,kFactor:dec(1),activeSnapshot:recipient.active,
      planLevelSnapshot:recipient.qualification.plan.planCode,ruleVersionCode:envelope.ruleVersionCode,parameterSnapshotHash:envelope.parameters.hash,
      occurredAt:new Date(),pendingUntil:new Date(recipient.pendingUntil),calculationDetail:{subtype:'HISTORICAL_ENTITLEMENT_DELTA',actionKey,snapshotId:row.snapshotId,entitlementKey:recipient.key,stateHash}}});
    correctionAwardId=award.bonusAwardId;
    await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:correctionAwardId,status:new Date(recipient.pendingUntil)<=new Date()?'EFFECTIVE':'PENDING_45D',occurredAt:new Date(),reasonCode:'HISTORICAL_REPLAY'}});
  } else if(delta.lt(0)) {
    const latest=await tx.bonusAwardLifecycleEvent.findFirst({where:{bonusAwardId:recipient.awardId},orderBy:[{occurredAt:'desc'},{createdAt:'desc'},{lifecycleEventId:'desc'}]});
    if(entitlement.eq(0)&&latest&&['CALCULATED','PENDING_45D'].includes(latest.status)) {
      await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:recipient.awardId,status:'REVERSED',occurredAt:new Date(),reasonCode:'HISTORICAL_REPLAY'}});
    } else {
    let anchorId=recipient.awardId;
    if(recipient.awardType==='RPV') {
      const anchor=await tx.bonusAward.create({data:{awardType:'RPV',recipientQualificationId:recipient.qualificationId,sourceEventId:randomUUID(),generationNo:recipient.generation,
        theoryAmount:dec(0),payableAmount:dec(0),activeSnapshot:recipient.active,ruleVersionCode:envelope.ruleVersionCode,parameterSnapshotHash:envelope.parameters.hash,
        occurredAt:new Date(),pendingUntil:new Date(recipient.pendingUntil),calculationDetail:{subtype:'HISTORICAL_RPV_RECOVERY_ANCHOR',originalRpvAwardId:recipient.awardId,actionKey}}});
      anchorId=anchor.bonusAwardId;
    }
    const recovery=await tx.bonusRecoveryEvent.create({data:{bonusAwardId:anchorId,returnCaseId,recoveryAmount:delta.abs(),outstandingAmount:delta.abs(),status:'OPEN',
      reasonCode:'HISTORICAL_REPLAY:'+actionKey,occurredAt:new Date()}});
    recoveryId=recovery.bonusRecoveryEventId;
      if(latest&&['EFFECTIVE','PAYABLE','PAID'].includes(latest.status)) await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:recipient.awardId,status:'CLAWBACK',occurredAt:new Date(),reasonCode:'HISTORICAL_REPLAY'}});
    }
  }
  return tx.entitlementReplayPosting.create({data:{actionKey,snapshotId:row.snapshotId,entitlementKey:recipient.key,recipientQualificationId:recipient.qualificationId,
    originallyPosted:original,recalculatedEntitlement:entitlement,delta,stateHash,correctionAwardId,recoveryId}});
}

export async function effectiveGpv(tx:Prisma.TransactionClient,sources:ReplayEnvelope[]) {
  const result=new Map<string,Prisma.Decimal>();
  for(const source of sources) {
    if(!source.inputs.orderId||!source.inputs.lineId) pending('HISTORICAL_SNAPSHOT_MISSING','Original GPV transaction/line mapping is required');
    const returns=await tx.returnLine.aggregate({where:{orderLineId:source.inputs.lineId,returnCase:{status:'POSTED'}},_sum:{gpvReversalAmount:true}});
    const amount=dec(source.inputs.volume).sub(returns._sum.gpvReversalAmount??dec(0));
    if(amount.lt(0)) pending('RETURN_AMOUNT_EXCEEDED','Cumulative reversal exceeds original GPV');
    result.set(source.sourceId,amount);
  }
  return result;
}
async function loadEnvelope(tx:Prisma.TransactionClient,kind:string,sourceId:string) {
  const row=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind,sourceId}}});
  return {row:row!,envelope:verifyReplayEnvelope(row)};
}
async function postPayables(tx:Prisma.TransactionClient,row:any,envelope:ReplayEnvelope,payables:Map<string,Prisma.Decimal>,actionKey:string,stateHash:string,returnId?:string) {
  for(const recipient of envelope.recipients) await appendEntitlementDelta(tx,row,recipient,payables.get(recipient.key)??pending('HISTORICAL_SNAPSHOT_MISSING','Historical entitlement result absent'),actionKey,stateHash,returnId);
}
export async function replayEpvMonth(tx:Prisma.TransactionClient,orderId:string,actionKey:string,returnCaseId?:string) {
  const marker=await tx.pvLedger.findFirst({where:{sourceType:'ORDER',sourceId:orderId,pvType:'EPV',eventType:'EPV_CREATED'}});
  if(!marker) pending('HISTORICAL_SNAPSHOT_MISSING','Original EPV event is missing');
  const original=await loadEnvelope(tx,'EPV',marker.eventId);
  const month=original.envelope.inputs;
  const events=await tx.pvLedger.findMany({where:{qualificationId:marker.qualificationId,pvType:'EPV',eventType:'EPV_CREATED',occurredAt:{gte:new Date(month.monthStart),lt:new Date(month.monthEnd)}},orderBy:{eventId:'asc'}});
  const rows:any[]=[];const envelopes:ReplayEnvelope[]=[];const remaining=new Map<string,Prisma.Decimal>();
  for(const event of events) {
    const loaded=await loadEnvelope(tx,'EPV',event.eventId);rows.push(loaded.row);envelopes.push(loaded.envelope);
    const returns=await tx.returnLine.aggregate({where:{returnCase:{orderId:loaded.envelope.inputs.orderId,status:'POSTED'}},_sum:{returnAmount:true}});
    remaining.set(loaded.envelope.inputs.orderId,dec(loaded.envelope.inputs.consumption).sub(returns._sum.returnAmount??dec(0)));
  }
  const increments=historicalMonthlyEntitlements(envelopes,remaining),stateHash=replayHash([...remaining].map(([id,amount])=>[id,amount.toString()]));
  for(let index=0;index<envelopes.length;index++) {
    const envelope=envelopes[index],volume=increments.get(envelope.sourceId)!;
    const payables=new Map(envelope.recipients.map(recipient=>{
      if(recipient.rate==null) pending('HISTORICAL_SNAPSHOT_MISSING','Original EPV recipient rate is required');
      return [recipient.key,recipient.eligible?money(volume.mul(dec(recipient.rate))):dec(0)] as const;
    }));
    await postPayables(tx,rows[index],envelope,payables,actionKey,stateHash,returnCaseId);
    const previous=await tx.pvLedger.aggregate({where:{reversalOfEventId:envelope.sourceId,pvType:'EPV'},_sum:{amount:true}});
    const delta=volume.sub(dec(envelope.inputs.volume)).sub(previous._sum.amount??dec(0));
    if(!delta.eq(0)) await tx.pvLedger.upsert({where:{eventType_sourceType_sourceId_sourceLineId_pvType:{eventType:'EPV_REPLAY_ADJUSTMENT',sourceType:'RETURN',sourceId:returnCaseId!,sourceLineId:envelope.sourceId,pvType:'EPV'}},update:{},create:{qualificationId:marker.qualificationId,pvType:'EPV',amount:delta,
      sourceType:'RETURN',sourceId:returnCaseId!,sourceLineId:envelope.sourceId,eventType:'EPV_REPLAY_ADJUSTMENT',ruleVersionCode:envelope.ruleVersionCode,parameterSnapshotHash:envelope.parameters.hash,occurredAt:new Date(),reversalOfEventId:envelope.sourceId,correlationId:returnCaseId!}});
  }
  return stateHash;
}
export async function replayRpvCancellation(tx:Prisma.TransactionClient,recognitionId:string,cancellationId:string,actionKey:string,correlationId:string) {
  const prior=await tx.replayAction.findUnique({where:{actionKey}});if(prior) return prior.result;
  const {row,envelope}=await loadEnvelope(tx,'RPV',recognitionId);
  const cancellation=await tx.subscriptionCancellation.findUnique({where:{subscriptionCancellationId:cancellationId}});
  if(!cancellation||cancellation.status!=='POSTED'||cancellation.subscriptionId!==envelope.inputs.subscriptionId||cancellation.effectiveAt>new Date(envelope.at)) pending('RPV_CANCELLATION_INVALID','Posted original recognition cancellation evidence is required');
  const stateHash=replayHash({recognitionId,valid:false});
  const original=await tx.pvLedger.findUnique({where:{eventId:envelope.inputs.eventId}});
  if(!original) pending('HISTORICAL_SNAPSHOT_MISSING','Original RPV event is missing');
  if(original.pvType!=='RPV'||original.eventType!=='RPV_CREATED'||original.sourceId!==envelope.inputs.subscriptionId||original.sourceLineId!==recognitionId||original.qualificationId!==envelope.evidence.sourceQualification.qualificationId||original.occurredAt.toISOString()!==envelope.at||original.ruleVersionCode!==envelope.ruleVersionCode||!original.amount.eq(envelope.inputs.volume))
    pending('HISTORICAL_SNAPSHOT_CORRUPT','RPV original event conflicts with sealed recognition evidence');
  const previous=await tx.pvLedger.aggregate({where:{reversalOfEventId:original.eventId,pvType:'RPV'},_sum:{amount:true}});
  const delta=original.amount.add(previous._sum.amount??dec(0)).negated();
  if(delta.gt(0)) pending('RETURN_AMOUNT_EXCEEDED','Original RPV was reversed beyond its effective volume');
  if(!delta.eq(0)) await tx.pvLedger.create({data:{qualificationId:original.qualificationId,pvType:'RPV',amount:delta,sourceType:'MONTHLY_RECOGNITION_REVERSAL',sourceId:envelope.inputs.subscriptionId,sourceLineId:recognitionId,eventType:'RPV_REVERSAL',
    ruleVersionCode:envelope.ruleVersionCode,parameterSnapshotHash:envelope.parameters.hash,occurredAt:cancellation.effectiveAt,reversalOfEventId:original.eventId,correlationId}});
  await postPayables(tx,row,envelope,new Map(envelope.recipients.map(recipient=>[recipient.key,dec(0)])),actionKey,stateHash);
  await tx.monthlyRecognitionSchedule.update({where:{recognitionId},data:{status:'REVERSED'}});
  const result={recognitionId,status:'REPLAYED',stateHash};
  await tx.replayAction.create({data:{actionKey,stateHash,result}});return result;
}
export async function replayReturnDependencies(tx:Prisma.TransactionClient,returnCaseId:string,maxPeriods=260) {
  const actionKey='RETURN:'+returnCaseId;
  const prior=await tx.replayAction.findUnique({where:{actionKey}});if(prior) return {...prior.result as object,replayed:true};
  const ret=await tx.returnCase.findUnique({where:{returnCaseId},include:{order:true,lines:true}});
  if(!ret||ret.status!=='POSTED') pending('RETURN_NOT_POSTED','Posted return required');
  const originalEvents=await tx.pvLedger.findMany({where:{sourceType:'ORDER',sourceId:ret.orderId,pvType:'GPV',eventType:'GPV_CREATED'}});
  if(!originalEvents.length) pending('HISTORICAL_SNAPSHOT_MISSING','Original transaction recognition evidence is missing');
  for(const event of originalEvents) await loadEnvelope(tx,'GPV',event.eventId);
  // Reconstruct the cumulative state from original transaction facts, independent of event delivery order.
  const facts=await tx.returnLine.findMany({where:{returnCase:{status:'POSTED',order:{ruleVersionCode:ret.order.ruleVersionCode}}},orderBy:{returnLineId:'asc'},select:{returnLineId:true,orderLineId:true,quantity:true,returnAmount:true,gpvReversalAmount:true}});
  const stateHash=replayHash(json(facts));
  const economicAt=originalEvents.reduce((at,event)=>at<event.occurredAt?at:event.occurredAt,originalEvents[0].occurredAt);
  const k0Batches=await tx.settlementBatch.findMany({where:{settlementType:'REFERRAL_K0',status:'FINALIZED',ruleVersionCode:ret.order.ruleVersionCode,periodStart:{lte:economicAt},periodEnd:{gt:economicAt}}});
  // Start with the original recognition period. Its sealed carry-in is the historical baseline;
  // earlier finalized periods are immutable inputs and cannot be reconstructed from current state.
  const binaries=await tx.settlementBatch.findMany({where:{settlementType:'BINARY_K1',status:'FINALIZED',ruleVersionCode:ret.order.ruleVersionCode,periodEnd:{gt:economicAt}},orderBy:{periodStart:'asc'}});
  const calculations:Array<{batch:any;row:any;envelope:ReplayEnvelope;binary:ReturnType<typeof periodBinary>;matching?:{row:any;envelope:ReplayEnvelope;result:ReturnType<typeof periodMatching>;batch:any};carry:Record<string,{left:string;right:string}>}>=[];
  let incoming=new Map<string,{left:Prisma.Decimal;right:Prisma.Decimal}>();let previousEnd:Date|undefined;
  let replayRun:any,complete=binaries.length===0,converged=false;
  if(binaries.length) {
    const calculationSnapshot=json({format:'UCELL_SETTLEMENT_REPLAY_RUN_V1',actionKey,stateHash,economicAt:economicAt.toISOString(),ruleVersionCode:ret.order.ruleVersionCode});
    replayRun=await tx.settlementReplayRun.findUnique({where:{sourceReturnCaseId:returnCaseId}});
    if(replayRun) {
      const existing=replayRun.calculationSnapshot as any;
      if(existing?.stateHash!==stateHash||existing?.economicAt!==economicAt.toISOString()||replayRun.ruleVersionCode!==ret.order.ruleVersionCode)
        pending('HISTORICAL_SNAPSHOT_CONFLICT','Replay run cannot be resumed from different historical facts');
      if(replayRun.status==='CONVERGED'&&!prior) pending('HISTORICAL_SNAPSHOT_CORRUPT','Converged replay run is missing its immutable replay action');
    } else replayRun=await tx.settlementReplayRun.create({data:{sourceReturnCaseId:returnCaseId,initialPeriodStart:binaries[0].periodStart,initialPeriodEnd:binaries[0].periodEnd,
      ruleVersionCode:ret.order.ruleVersionCode,status:'RUNNING',maxWeeks:maxPeriods,calculationSnapshot}});
  }
  for(const [index,batch] of binaries.entries()) {
    if(index>=maxPeriods) break;
    if(previousEnd&&previousEnd.getTime()!==batch.periodStart.getTime()) pending('HISTORICAL_SNAPSHOT_MISSING','Historical Binary continuation is not contiguous');
    const {row,envelope}=await loadEnvelope(tx,'BINARY_K1',batch.settlementBatchId);
    const result=periodBinary(envelope,await effectiveGpv(tx,envelope.evidence.sources),incoming);
    const matching=await tx.settlementBatch.findFirst({where:{settlementType:'MATCHING_K2',status:'FINALIZED',periodStart:batch.periodStart,periodEnd:batch.periodEnd,ruleVersionCode:batch.ruleVersionCode}});
    let matchingCalculation:typeof calculations[number]['matching'];
    if(matching) {
      const loaded=await loadEnvelope(tx,'MATCHING_K2',matching.settlementBatchId);
      const resultMatching=periodMatching(loaded.envelope,result.payables,result.total);
      matchingCalculation={...loaded,result:resultMatching,batch:matching};
    }
    const carry=Object.fromEntries([...result.carryOut].map(([qid,value])=>[qid,{left:value.left.toString(),right:value.right.toString()}]));
    calculations.push({batch,row,envelope,binary:result,matching:matchingCalculation,carry});
    const carryDelta=Object.fromEntries(envelope.evidence.carryRecipients.map((original:any)=>{
      const next=result.carryOut.get(original.qualificationId)??pending('HISTORICAL_SNAPSHOT_MISSING','Recomputed carry recipient is absent');
      return [original.qualificationId,{original:{left:String(original.leftCarryOut),right:String(original.rightCarryOut)},recomputed:{left:next.left.toString(),right:next.right.toString()}}];
    }));
    const binaryDeltas=envelope.recipients.map(recipient=>({entitlementKey:recipient.key,qualificationId:recipient.qualificationId,original:recipient.posted,recomputed:result.payables.get(recipient.key)!.toString()}));
    const matchingDeltas=matchingCalculation?.envelope.recipients.map(recipient=>({entitlementKey:recipient.key,qualificationId:recipient.qualificationId,original:recipient.posted,recomputed:matchingCalculation!.result.payables.get(recipient.key)!.toString()}))??[];
    const impacted=[...new Set([...Object.entries(carryDelta).filter(([,value]:any)=>value.original.left!==value.recomputed.left||value.original.right!==value.recomputed.right).map(([qid])=>qid),
      ...binaryDeltas.filter(item=>!dec(item.original).eq(item.recomputed)).map(item=>item.qualificationId),...matchingDeltas.filter(item=>!dec(item.original).eq(item.recomputed)).map(item=>item.qualificationId)])].sort();
    const periodData={settlementReplayRunId:replayRun.settlementReplayRunId,periodNo:index+1,periodStart:batch.periodStart,periodEnd:batch.periodEnd,
      originalK1:batch.kFactor,recomputedK1:result.k,originalK2:matchingCalculation?.batch.kFactor,recomputedK2:matchingCalculation?.result.k,
      impactedQualifications:json(impacted),carryDeltaSnapshot:json(carryDelta),awardDeltaSnapshot:json({binary:binaryDeltas,matching:matchingDeltas})};
    const saved=await tx.settlementReplayPeriod.findUnique({where:{settlementReplayRunId_periodEnd:{settlementReplayRunId:replayRun.settlementReplayRunId,periodEnd:batch.periodEnd}}});
    if(saved) {
      const savedEvidence={periodNo:saved.periodNo,periodStart:saved.periodStart.toISOString(),periodEnd:saved.periodEnd.toISOString(),originalK1:saved.originalK1.toString(),recomputedK1:saved.recomputedK1.toString(),
        originalK2:saved.originalK2?.toString()??null,recomputedK2:saved.recomputedK2?.toString()??null,impactedQualifications:saved.impactedQualifications,carryDeltaSnapshot:saved.carryDeltaSnapshot,awardDeltaSnapshot:saved.awardDeltaSnapshot};
      const nextEvidence={periodNo:index+1,periodStart:batch.periodStart.toISOString(),periodEnd:batch.periodEnd.toISOString(),originalK1:dec(batch.kFactor).toString(),recomputedK1:result.k.toString(),
        originalK2:matchingCalculation?.batch.kFactor?.toString()??null,recomputedK2:matchingCalculation?.result.k.toString()??null,impactedQualifications:impacted,carryDeltaSnapshot:carryDelta,awardDeltaSnapshot:{binary:binaryDeltas,matching:matchingDeltas}};
      if(replayHash(savedEvidence)!==replayHash(nextEvidence)) pending('HISTORICAL_SNAPSHOT_CONFLICT','Replay period checkpoint is not deterministic');
    } else await tx.settlementReplayPeriod.create({data:periodData});
    converged=impacted.length===0;
    incoming=result.carryOut;previousEnd=batch.periodEnd;
    if(converged) break;
  }
  complete=converged||calculations.length===binaries.length;
  if(replayRun) replayRun=await tx.settlementReplayRun.update({where:{settlementReplayRunId:replayRun.settlementReplayRunId},data:{status:complete?'CONVERGED':'MAX_HORIZON',maxWeeks:maxPeriods,processedWeeks:calculations.length,convergedAt:complete?new Date():null}});
  if(!complete) return {returnCaseId,status:'REPLAY_INCOMPLETE',code:'REPLAY_INCOMPLETE',stateHash,periods:calculations.length,maxWeeks:maxPeriods,replayRunId:replayRun.settlementReplayRunId};
  // Monetary effects are appended only after the complete chain has converged or reached the end
  // of all finalized periods. A horizon-limited run above commits evidence but no partial money.
  for(const batch of k0Batches) {
    const {row,envelope}=await loadEnvelope(tx,'REFERRAL_K0',batch.settlementBatchId);
    const result=periodK0(envelope,await effectiveGpv(tx,envelope.evidence.sources));
    await postPayables(tx,row,envelope,result.payables,actionKey,stateHash,returnCaseId);
  }
  for(const calculation of calculations) {
    await postPayables(tx,calculation.row,calculation.envelope,calculation.binary.payables,actionKey,stateHash,returnCaseId);
    if(calculation.matching) await postPayables(tx,calculation.matching.row,calculation.matching.envelope,calculation.matching.result.payables,actionKey,stateHash,returnCaseId);
    await tx.replayCarryProjection.create({data:{actionKey,settlementBatchId:calculation.batch.settlementBatchId,periodEnd:calculation.batch.periodEnd,ruleVersionCode:calculation.batch.ruleVersionCode,carry:calculation.carry,stateHash}});
  }
  let epvState:string|undefined;
  if(ret.order.purpose==='REPURCHASE') epvState=await replayEpvMonth(tx,ret.orderId,actionKey,returnCaseId);
  const subscriptions=await tx.subscription.findMany({where:{orderId:ret.orderId},include:{schedules:true}});
  for(const subscription of subscriptions) {
    const cancellations=await tx.subscriptionCancellation.findMany({where:{subscriptionId:subscription.subscriptionId,status:'POSTED'},orderBy:{effectiveAt:'asc'}});
    for(const schedule of subscription.schedules.filter(s=>['RECOGNIZED','REVERSED'].includes(s.status))) {
      const cancellation=cancellations.find(c=>c.effectiveAt<=schedule.dueAt);
      if(!cancellation) pending('HISTORICAL_SNAPSHOT_MISSING','Affected subscription recognition lacks an explicit historical cancellation/allocation fact');
      await replayRpvCancellation(tx,schedule.recognitionId,cancellation.subscriptionCancellationId,'RPV:'+schedule.recognitionId+':'+cancellation.subscriptionCancellationId,ret.correlationId);
    }
  }
  await tx.settlementRecalculationRequest.updateMany({where:{sourceReturnCaseId:returnCaseId,status:'PENDING'},data:{status:'PROCESSED',processedAt:new Date()}});
  const result={returnCaseId,status:'REPLAYED',stateHash,epvState:epvState??null,periods:calculations.length,k0Periods:k0Batches.length,replayRunId:replayRun?.settlementReplayRunId??null};
  await tx.replayAction.create({data:{actionKey,stateHash,result}});return result;
}

export async function consumeReplayOutbox(tx:Prisma.TransactionClient,outboxEventId:string) {
  const event=await tx.outboxEvent.findUnique({where:{outboxEventId}});
  if(!event||event.processStatus==='PROCESSED') return {replayed:true};
  if(!['RPV_REVERSAL_REQUIRED','RETURN_CONFIRMED','RETURN_DEPENDENCY_REPLAY_REQUIRED','EPV_MONTH_RECALCULATION_REQUIRED'].includes(event.eventType)) pending('UNSUPPORTED_REPLAY_EVENT','Replay consumer accepts only registered dependency events');
  const payload=event.payload as any;
  const result=event.eventType==='RPV_REVERSAL_REQUIRED'
    ?await replayRpvCancellation(tx,payload.recognitionId,payload.subscriptionCancellationId,'RPV:'+payload.recognitionId+':'+payload.subscriptionCancellationId,event.correlationId)
    :event.eventType==='RETURN_CONFIRMED'
      ?await processHistoricalReturn(tx,payload.returnCaseId??event.aggregateId)
      :await replayReturnDependencies(tx,payload.returnCaseId??event.aggregateId);
  if((result as any).status==='REPLAY_INCOMPLETE') pending('REPLAY_INCOMPLETE','Replay horizon reached before convergence; outbox remains retryable');
  await tx.outboxEvent.update({where:{outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date(),lastError:null}});
  return result;
}

export async function processHistoricalReturn(tx:Prisma.TransactionClient,returnCaseId:string) {
  // Validate and replay all dependencies before publishing a successful source-reversal marker.
  const result=await replayReturnDependencies(tx,returnCaseId);
  const ret=await tx.returnCase.findUniqueOrThrow({where:{returnCaseId},include:{lines:true,order:true}});
  const createdReversalEvents:string[]=[];
  for(const line of ret.lines) {
    const original=await tx.pvLedger.findFirst({where:{sourceType:'ORDER',sourceId:ret.orderId,sourceLineId:line.orderLineId,pvType:'GPV',eventType:'GPV_CREATED'}});
    if(!original) pending('HISTORICAL_SNAPSHOT_MISSING','Original GPV line evidence is missing');
    const source=await loadEnvelope(tx,'GPV',original.eventId);
    const reversal=await tx.pvLedger.upsert({where:{eventType_sourceType_sourceId_sourceLineId_pvType:{eventType:'GPV_REVERSAL',sourceType:'RETURN',sourceId:returnCaseId,sourceLineId:line.returnLineId,pvType:'GPV'}},update:{},create:{qualificationId:original.qualificationId,pvType:'GPV',amount:line.gpvReversalAmount.negated(),sourceType:'RETURN',sourceId:returnCaseId,sourceLineId:line.returnLineId,eventType:'GPV_REVERSAL',ruleVersionCode:original.ruleVersionCode,parameterSnapshotHash:source.envelope.parameters.hash,occurredAt:ret.occurredAt,reversalOfEventId:original.eventId,correlationId:ret.correlationId}});
    createdReversalEvents.push(reversal.eventId);
  }
  const processed=await tx.auditEvent.findFirst({where:{action:'RETURN_REVERSAL_PROCESSED',entityId:returnCaseId}});
  if(!processed) await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'RETURN_REVERSAL_PROCESSED',entityType:'RETURN',entityId:returnCaseId,requestId:returnCaseId,correlationId:ret.correlationId,afterData:json({...result,createdReversalEvents})}});
  return {...result,createdReversalEvents};
}

export async function capturedSideGpv(tx:Prisma.TransactionClient,root:string,side:'LEFT'|'RIGHT',start:Date,end:Date,ruleVersionCode:string) {
  const events=await tx.pvLedger.findMany({where:{pvType:'GPV',eventType:'GPV_CREATED',ruleVersionCode,occurredAt:{gte:start,lt:end}},orderBy:{eventId:'asc'}});
  const sources:ReplayEnvelope[]=[];
  for(const event of events) sources.push((await loadEnvelope(tx,'GPV',event.eventId)).envelope);
  const effective=await effectiveGpv(tx,sources);
  return sources.reduce((sum,source)=>sourceSide(source,root)===side?sum.add(effective.get(source.sourceId)!):sum,dec(0));
}
