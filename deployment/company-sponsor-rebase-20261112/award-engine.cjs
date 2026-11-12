'use strict';
// One-off transactional rebase for the six designated bootstrap sponsor edges.
// The runner controls Serializable isolation, final tree writes and transaction commit.
function createAwardEngine(prisma, lib) {
 const D=prisma.Decimal;
 const zero=new D(0), one=new D(1);
 const amount=n=>new D(n).toDecimalPlaces(4,D.ROUND_HALF_UP);
 const sum=values=>values.reduce((a,b)=>a.plus(b),zero);
 const clean=value=>JSON.parse(JSON.stringify(value));
 const hash=value=>lib.replayHash(clean(value));
 const assert=(test,message)=>{if(!test) throw Error('AWARD_REBASE: '+message)};
 const edgeWindow=at=>({effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]});
 const names=Array.from({length:6},(_,i)=>'TW8888888888-0'+(i+2));
 const key=row=>[row.awardType,row.sourceAwardId||row.sourceEventId||'',row.generationNo||0,row.recipientQualificationId].join('/');
 const inPeriod=(row,qid,at,from='effectiveFrom',to='effectiveTo')=>row.qualificationId===qid&&row[from]<=at&&(!row[to]||row[to]>at);
 function uniqueParents(edges,parent,other){
   const map=new Map(),positions=new Set();
   for(const e of edges){
     assert(!map.has(e.childQualificationId),'overlapping '+parent);
     if(other){const pos=e[parent]+'/'+e[other];assert(!positions.has(pos),'duplicate binary side');positions.add(pos);}
     map.set(e.childQualificationId,e);
   }
   for(const id of map.keys()){
     const seen=new Set();let child=id;
     while(map.has(child)){assert(!seen.has(child),'cycle in '+parent);seen.add(child);child=map.get(child)[parent];}
   }
   return map;
 }
 async function inspectAwards(tx,{asOf=new Date(),simulate=false}={}) {
   const [balls,sponsorRows,binaryRows,plans,statuses,actives,owners,holders,bindings,batches]=await Promise.all([
     tx.qualification.findMany({select:{qualificationId:true,ballNo:true,kind:true,effectiveAt:true}}),
     tx.sponsorRelationship.findMany({where:edgeWindow(asOf),select:{sponsorQualificationId:true,childQualificationId:true}}),
     tx.binaryPlacement.findMany({where:edgeWindow(asOf),select:{parentQualificationId:true,childQualificationId:true,side:true}}),
     tx.qualificationPlanHistory.findMany(),tx.qualificationStatusHistory.findMany(),tx.activePeriod.findMany(),
     tx.qualificationOwnerInterval.findMany(),tx.qualificationHolderHistory.findMany(),tx.companyBootstrapProfileBinding.findMany(),
     tx.settlementBatch.findMany({where:{status:'FINALIZED'},orderBy:[{periodEnd:'asc'},{settlementType:'asc'}]})]);
   const byId=new Map(balls.map(q=>[q.qualificationId,q])),byBall=new Map(balls.map(q=>[q.ballNo,q]));
   const bp=uniqueParents(binaryRows,'parentQualificationId','side');
   const origins=uniqueParents(sponsorRows,'sponsorQualificationId');
   for(const ball of names){
     const q=byBall.get(ball);assert(q?.kind==='COMPANY_BOOTSTRAP','missing bootstrap '+ball);
     const id=q.qualificationId,binaryParent=bp.get(id)?.parentQualificationId;
     assert(binaryParent&&byId.get(binaryParent),'missing binary parent '+ball);
     if(simulate)origins.set(id,{childQualificationId:id,sponsorQualificationId:binaryParent});
     else assert(origins.get(id)?.sponsorQualificationId===binaryParent,'tree change missing '+ball);
   }
   const sponsor=[...origins.values()].sort((a,b)=>a.childQualificationId.localeCompare(b.childQualificationId));
   const binary=binaryRows.sort((a,b)=>a.childQualificationId.localeCompare(b.childQualificationId));
   const sp=uniqueParents(sponsor,'sponsorQualificationId');
   for(const e of sponsor)assert(byId.has(e.childQualificationId)&&byId.has(e.sponsorQualificationId),'sponsor endpoint absent');
   for(const e of binary)assert(byId.has(e.childQualificationId)&&byId.has(e.parentQualificationId),'binary endpoint absent');
   const topology={sponsor,binary,hash:require('node:crypto').createHash('sha256').update(JSON.stringify([...sponsor.map(e=>['S',e.childQualificationId,e.sponsorQualificationId]),...binary.map(e=>['B',e.childQualificationId,e.parentQualificationId,e.side])].sort())).digest('hex')};
   const enabled=(id,at)=>{
     const q=byId.get(id);assert(q,'missing qualification '+id);
     if(q.kind==='COMPANY_BOOTSTRAP')return !!q.effectiveAt&&q.effectiveAt<=at;
     const rows=statuses.filter(r=>inPeriod(r,id,at));assert(rows.length<=1,'overlapping qualification status '+id);
     return rows[0]?.status==='EFFECTIVE';
   };
   function facts(id,at) {
     const q=byId.get(id);assert(q,'unknown qualification');
     const os=owners.filter(r=>inPeriod(r,id,at)),hs=holders.filter(r=>inPeriod(r,id,at));
     assert(os.length<=1&&hs.length<=1,'ambiguous historical owner/holder '+id);
     const owner=os[0],holder=hs[0];
     if(owner&&holder&&owner.ownerType!=='COMPANY')assert(owner.personId===holder.holderPersonId&&owner.legalEntityId===holder.holderLegalEntityId,'holder/owner disagree '+id);
     const company=owner?.ownerType==='COMPANY';
     const bootstrap=q.kind==='COMPANY_BOOTSTRAP';
     const planRows=(bootstrap?bindings:plans).filter(r=>inPeriod(r,id,at));
     // Multiple event-specific parameter snapshots can bind the same immutable company plan.
     assert(bootstrap?company&&planRows.length&&planRows.every(r=>r.planCode==='LEADER'&&r.profileVersion==='COMPANY_BOOTSTRAP_PROFILE_V1'):
       planRows.length===1,'missing/ambiguous source-date plan '+q.ballNo+' '+at.toISOString());
     const plan=planRows[0].planCode;
     const active=company||actives.some(r=>inPeriod(r,id,at,'activeFrom','activeTo'));
     const direct=sponsor.filter(e=>e.sponsorQualificationId===id&&enabled(e.childQualificationId,at)).length;
     const ownerId=owner?.companyPrincipalId||owner?.legalEntityId||owner?.personId||holder?.holderLegalEntityId||holder?.holderPersonId;
     assert(ownerId,'missing historical award recipient '+q.ballNo+' '+at.toISOString());
     const planEvidence=bootstrap?{planCode:plan,profileVersion:planRows[0].profileVersion,bindingIds:planRows.map(p=>p.bindingId).sort()}:planRows[0];
     const historicalStatus=bootstrap&&q.effectiveAt<=at?{status:'EFFECTIVE',effectiveFrom:q.effectiveAt,sourceType:'IMMUTABLE_COMPANY_BOOTSTRAP'}:statuses.find(r=>inPeriod(r,id,at));
     assert(historicalStatus,'missing status history '+q.ballNo);
     const activeIntervals=company?[{activeFrom:owner.effectiveFrom,activeTo:owner.effectiveTo,sourceType:'COMPANY_OWNER_INTERVAL',sourceId:owner.ownerIntervalId}]:
       actives.filter(r=>r.qualificationId===id&&r.activeFrom<=at);
     const qualification=clean({qualificationId:id,at,plan:planEvidence,status:historicalStatus,activeIntervals,
       ...(company?{economicOwner:{ownerType:'COMPANY',ownerIntervalId:owner.ownerIntervalId,companyPrincipalId:ownerId}}:{})});
     return {plan,qualification,active,direct,ownerId,ownerIntervalId:owner?.ownerIntervalId||null,ownerType:company?'COMPANY':owner?.ownerType||(holder?.holderLegalEntityId?'LEGAL_ENTITY':'PERSON')};
   }
   function ancestors(id,max) {const list=[];while(list.length<max&&sp.has(id)){id=sp.get(id).sponsorQualificationId;list.push(id);}return list;}
   const factsCache=new Map();
   const state=(id,t)=>{const k=id+'/'+t.toISOString();if(!factsCache.has(k))factsCache.set(k,facts(id,t));return factsCache.get(k)};
   function graph(sourceQid,t,depth,old={}) {
     const qualifications={...old.qualifications},effectiveDirectCounts={...old.effectiveDirectCounts};
     for(const id of [sourceQid,...ancestors(sourceQid,depth)]){
       const f=state(id,t);
       qualifications[id]=f.qualification;effectiveDirectCounts[id]=f.direct;
     }
     return {...old,at:t.toISOString(),sponsor,binary,qualifications,effectiveDirectCounts,sourceQualification:qualifications[sourceQid]};
   }
   const batchTypeOrder={BINARY_K1:0,MATCHING_K2:1,REFERRAL_K0:2};
   batches.sort((a,b)=>a.periodEnd-b.periodEnd||batchTypeOrder[a.settlementType]-batchTypeOrder[b.settlementType]||a.settlementBatchId.localeCompare(b.settlementBatchId));
   const previousCarry=new Map(),bins=new Map(),periods=[],work=[];
   for(const b of batches){
     const id=b.settlementBatchId,type=b.settlementType,rule=b.ruleVersionCode,t=b.periodEnd;
     assert(Object.hasOwn(batchTypeOrder,type),'unsupported finalized settlement '+type);
     const snap=await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:type,sourceId:id}}});
     const env=lib.verifyReplayEnvelope(snap),params=lib.verifySnapshot(b.parameterSnapshot);
     assert(params.hash===env.parameters.hash,'batch parameters mismatch');
     const [originals,actual,projections]=await Promise.all([
       tx.pvLedger.findMany({where:{pvType:'GPV',eventType:'GPV_CREATED',occurredAt:{gte:b.periodStart,lt:t},ruleVersionCode:rule}}),
       tx.bonusAward.findMany({where:{settlementBatchId:id},include:{economicDestination:{include:{effects:true}}},orderBy:{bonusAwardId:'asc'}}),
       type==='BINARY_K1'?tx.replayCarryProjection.findMany({where:{settlementBatchId:id},orderBy:{sequence:'desc'},take:1}):[]]);
     const sources=env.evidence.sources,sourceById=new Map(sources.map(s=>[s.sourceId,s]));
     assert(sources.length===originals.length&&sourceById.size===originals.length,'period GPV source count mismatch');
     for(const pv of originals){const s=sourceById.get(pv.eventId);assert(s&&pv.amount.eq(s.inputs.volume)&&pv.qualificationId===s.inputs.qualificationId&&pv.sourceId===s.inputs.orderId&&pv.sourceLineId===s.inputs.lineId,'source evidence mismatch '+pv.eventId);}
     const raw=await lib.effectiveGpv(tx,sources),volume=sum([...raw.values()]);
     const rows=[];let carry=null,carryChanged=[],pool;
     const periodKey=[rule,b.periodStart.toISOString(),t.toISOString()].join('/');
     if(type==='BINARY_K1'){
       pool='pool.binary.rate';
       const carryInput=previousCarry.get(rule)||new Map(),basis={...env,evidence:{...env.evidence,sources:sources.map(s=>({...s,evidence:{...s.evidence,binary}}))}};
       const result=lib.periodBinary(basis,raw,carryInput);
       const stored=await tx.binaryCarry.findMany({where:{ruleVersionCode:rule,periodEnd:t}});
       const historical=new Map(stored.map(c=>[c.qualificationId,c]));
       const incoming=projections[0]?.carry;
       const covered=b => b.length===stored.length&&b.every(qid=>historical.has(qid));
       assert(covered([...result.carryOut.keys()])&&(!incoming||covered(Object.keys(incoming))),'incomplete carry roster');
       const eligible=balls.filter(q=>q.effectiveAt&&q.effectiveAt<t&&enabled(q.qualificationId,t)).map(q=>q.qualificationId);
       assert(covered(eligible),'eligible binary roster differs from sealed carries');
       carry={};
       for(const [qid,out] of result.carryOut){
         const base=historical.get(qid),prior=incoming?.[qid]||{left:base.leftCarryOut,right:base.rightCarryOut,pairedPv:base.pairedPv};
         const next={left:out.left.toString(),right:out.right.toString(),pairedPv:result.pairedPv.get(qid).toString()};carry[qid]=next;
         if(Object.keys(next).some(k=>!new D(next[k]).eq(prior[k])))carryChanged.push({ball:byId.get(qid).ballNo,qid,before:clean(prior),after:next});
       }
       previousCarry.set(rule,result.carryOut);
       for(const r of env.recipients){
         const entitlement=result.payables.get(r.key);assert(entitlement!==undefined,'missing sealed binary award');
         const details={awardType:'BINARY',recipientQualificationId:r.qualificationId,generationNo:null,
           sourceQualificationId:null,sourceAwardId:null,sourceEventId:null,occurredAt:t,
           theory:r.active?result.pairedPv.get(r.qualificationId).mul(lib.snapshotDecimal(params,'binary.pair.rate')):zero,parameters:params};
         rows.push(details);
       }
     } else if(type==='REFERRAL_K0'){
       pool='pool.referral.rate';
       for(const s of sources){
         const at=new Date(s.at),qid=s.inputs.qualificationId,up=ancestors(qid,7);
         if(!up.length)continue;
         const params=s.parameters,base=raw.get(s.sourceId).mul(lib.snapshotDecimal(params,'referral.g1.rate',state(up[0],at).plan));
         for(const [index,recipient] of up.entries()){
           const generation=index+1, f=state(recipient,at);if(!f.active)continue;
           const unlocks={STARTER:[0,3,4,4,4],ELITE:[0,3,4,5,6],LEADER:[0,3,4,5,7]};
           assert(f.plan in unlocks,'unknown recipient plan');
           const unlock=unlocks[f.plan][Math.min(f.direct,4)];if(index&&generation>unlock)continue;
           const rate=index?lib.snapshotDecimal(params,'equalization.rate',f.plan+':G'+generation):lib.snapshotDecimal(params,'referral.g1.rate',f.plan);
           const theory=index?base.mul(rate):base;if(!theory.gt(0))continue;
           rows.push({awardType:index?'EQUALIZATION':'REFERRAL',recipientQualificationId:recipient,sourceQualificationId:qid,
             sourceEventId:s.sourceId,sourceAwardId:null,generationNo:generation,occurredAt:at,theory,parameters:params,
             extra:{sourceGpv:raw.get(s.sourceId).toString(),originalCalculationSourceVolume:raw.get(s.sourceId).toString(),
               baseG1ReferralTheory:base.toString(),effectiveDirectCount:f.direct,unlockDepth:unlock,rate:rate.toString(),generation}});
         }
       }
     } else {
       pool='pool.matching.rate';
       const pair=bins.get(periodKey);assert(pair,'missing paired K1');
       for(const origin of pair) for(const [i,recipient] of ancestors(origin.qid,5).entries()){
         const f=state(recipient,t),generation=i+1,unlock=f.direct?Math.min(5,f.direct+1):0;
         if(!f.active||generation>unlock)continue;
         const rate=lib.snapshotDecimal(params,'matching.rate',String(generation));
         rows.push({awardType:'MATCHING',recipientQualificationId:recipient,sourceQualificationId:origin.qid,
           sourceEventId:null,sourceAwardId:origin.awardId,generationNo:generation,occurredAt:t,theory:origin.value.mul(rate),parameters:params,
           extra:{sourceBinaryPaid:origin.value.toString(),rate:rate.toString(),generation,unlockDepth:unlock,effectiveDirectCount:f.direct}});
       }
     }
     const theory=sum(rows.map(r=>r.theory)),poolAmount=volume.mul(lib.snapshotDecimal(params,pool)),k=theory.gt(0)?D.min(one,poolAmount.div(theory)):one;
     const map=new Map(rows.map(r=>[key(r),r]));assert(map.size===rows.length,'duplicate calculated keys');
     const existing=new Map(actual.map(a=>[key(a),a]));assert(existing.size===actual.length,'duplicate stored keys');
     const postings=await tx.entitlementReplayPosting.findMany({where:{entitlementKey:{in:actual.map(a=>a.bonusAwardId)}},orderBy:{sequence:'asc'}});
     const anchor=new Map(env.recipients.map(r=>[r.awardId,r]));
     const lines=[],operations=[];
     for(const lineKey of [...new Set([...map.keys(),...existing.keys()])].sort()){
       const r=map.get(lineKey),a=existing.get(lineKey),basis=r||a,qid=basis.recipientQualificationId;
       const f=state(qid,basis.occurredAt),awardId=a?.bonusAwardId;
       if(a){assert(!!a.economicDestination===(f.ownerType==='COMPANY'),'award beneficiary/destination mismatch '+awardId);}
       const prior=postings.filter(p=>p.entitlementKey===awardId);
       const before=new D(a?.payableAmount||0).plus(sum(prior.map(p=>p.delta))),after=r?amount(r.theory.mul(k)):zero,delta=after.minus(before);
       if(a?.economicDestination)assert(sum(a.economicDestination.effects.map(e=>e.amountDelta)).eq(before),'company net differs '+awardId);
       const line={key:lineKey,awardId:awardId||null,awardType:basis.awardType,qid,ball:byId.get(qid).ballNo,
         sourceAwardId:basis.sourceAwardId||null,sourceEventId:basis.sourceEventId||null,sourceQid:basis.sourceQualificationId||null,
         sourceBall:basis.sourceQualificationId?byId.get(basis.sourceQualificationId)?.ballNo:null,
         generation:basis.generationNo||0,at:basis.occurredAt.toISOString(),owner:f.ownerType,ownerId:f.ownerId,ownerIntervalId:f.ownerIntervalId,
         original:a?.payableAmount.toString()||'0',previousDelta:sum(prior.map(p=>p.delta)).toString(),
         before:before.toString(),after:after.toString(),delta:delta.toString(),eligible:!!r,exists:!!a,
         theory:r?.theory.toString()||'0',priorPostings:prior.map(p=>p.postingId)};
       lines.push(line);
       if(!a||!delta.isZero())operations.push({line,award:a,calculation:r,owner:f,anchor:anchor.get(awardId)});
     }
     if(type==='BINARY_K1')bins.set(periodKey,lines.map(l=>({awardId:l.awardId,qid:l.qid,value:new D(l.after)})));
     const result={id,type,rule,start:b.periodStart.toISOString(),end:t.toISOString(),baseSnapshotId:snap.snapshotId,baseHash:snap.hash,
       gpv:volume.toString(),k:k.toString(),theory:theory.toString(),pool:poolAmount.toString(),
       before:sum(lines.map(l=>new D(l.before))).toString(),after:sum(lines.map(l=>new D(l.after))).toString(),
       byType:[...new Set(lines.map(l=>l.awardType))].map(awardType=>{const a=lines.filter(l=>l.awardType===awardType);return{awardType,
         before:sum(a.map(x=>new D(x.before))).toString(),after:sum(a.map(x=>new D(x.after))).toString()}}),
       carryChanged,carry,lines};
     let revisedEvidence;
     if(type!=='BINARY_K1'){
       const revisedSources=sources.map(s=>({...s,evidence:graph(s.inputs.qualificationId,new Date(s.at),7,s.evidence)}));
       const matchingSources=type==='MATCHING_K2'?bins.get(periodKey).map(origin=>({
         sourceAwardId:origin.awardId,sourceQualificationId:origin.qid,
         evidence:graph(origin.qid,t,5,env.evidence.matchingSources.find(s=>s.sourceAwardId===origin.awardId)?.evidence)
       })):[];
       revisedEvidence={...env.evidence,sources:revisedSources,matchingSources};
     }
     periods.push(result);work.push({b,env,snap,operations,actual,rows,k,result,revisedEvidence,factsAt:state});
   }
   const receipt={topology,periods};return{receipt,hash:hash(receipt),work,makeGraph:graph,topology};
 }
 function stableUuid(identity) {
   const bytes=require('node:crypto').createHash('sha256').update(identity).digest().subarray(0,16);
   bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
   const hex=bytes.toString('hex');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
 }
 async function applyAwards(tx,plan,{actionKey,expectedHash,correlationId,asOf=new Date()}={}) {
   assert(typeof actionKey==='string'&&actionKey.length>0&&correlationId,'auditable action and correlation required');
   const replayActionKey=actionKey+':finalized-awards';
   const done=await tx.replayAction.findUnique({where:{actionKey:replayActionKey}});
   if(done){
     assert(done.stateHash===expectedHash&&done.result.topologyHash===plan.topology.hash,'reused action has different basis');
     return {...done.result,alreadyApplied:true};
   }
   assert(plan.hash===expectedHash&&hash(plan.receipt)===expectedHash,'preflight receipt changed');
   // The caller must pass a plan read after the sponsor edges have been written within this transaction.
   const check=await inspectAwards(tx,{asOf});
   assert(check.hash===expectedHash,'financial inputs or the target topology have changed');
   const final=[];
   for(const period of check.work){
     const {b,env,snap,result,revisedEvidence,k}=period,id=b.settlementBatchId;
     const idsByKey=new Map(period.actual.map(a=>[key(a),a.bonusAwardId]));
     // K1 uses the already deployed binary replay mechanism. This sponsor-only correction
     // must preserve the independent binary entitlement and the latest corrected carry.
     if(b.settlementType==='BINARY_K1'){
       assert(!period.operations.length&&!result.carryChanged.length,'independent K1 projection changed unexpectedly');
       final.push({id,type:b.settlementType,before:result.before,after:result.after,changed:0,carryChanged:0});
       continue;
     }
     const previous=await tx.auditEvent.findFirst({where:{action:'AWARD_REBASE_BASELINE',entityType:'SETTLEMENT_BATCH',entityId:id},orderBy:{occurredAt:'desc'}});
     let activeSnap=snap,activeEnvelope=env;
     if(previous){
       const data=previous.afterData;
       assert(data.version===1&&data.originalSnapshotId===snap.snapshotId&&data.originalHash===snap.hash&&previous.afterHash===data.snapshotHash,'prior baseline mismatch');
       activeSnap=await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:data.snapshotId}});
       activeEnvelope=lib.verifyReplayEnvelope(activeSnap);assert(activeSnap.hash===data.snapshotHash&&activeEnvelope.sourceId===id&&activeEnvelope.kind===b.settlementType,'invalid prior baseline');
     }
     for(const item of period.operations) {
       const {line,award,calculation:r,owner}=item;
       if(award){
         const sealed=activeEnvelope.recipients.find(r=>r.key===award.bonusAwardId);
         assert(sealed,'current calculation anchor missing for '+award.bonusAwardId);
         const postings=await tx.entitlementReplayPosting.aggregate({where:{snapshotId:activeSnap.snapshotId,entitlementKey:sealed.key},_sum:{delta:true}});
         assert(new D(sealed.posted).plus(postings._sum.delta||0).eq(line.before),'existing anchor net mismatch');
         const posting=await lib.appendEntitlementDelta(tx,activeSnap,sealed,new D(line.after),actionKey,check.hash);
         assert(posting.delta.eq(line.delta),'posted difference mismatch');
       }else{
         assert(r&&r.awardType!=='BINARY','new settlement line lacks basis');
         const pendingDays=lib.snapshotDecimal(env.parameters,'award.pending.days');
         assert(pendingDays.isInteger()&&pendingDays.gte(0),'invalid award pending days');
         const basis={...r.extra,parameterSnapshot:r.parameters,attributionActionKey:actionKey,attributionStateHash:check.hash,
           originalSnapshotId:snap.snapshotId,sourceQualificationId:r.sourceQualificationId};
         const added=await tx.bonusAward.create({data:{
           bonusAwardId:stableUuid(actionKey+'|'+id+'|'+line.key),settlementBatchId:id,
           awardType:r.awardType,recipientQualificationId:r.recipientQualificationId,
           sourceQualificationId:r.sourceQualificationId,sourceEventId:r.sourceEventId,sourceAwardId:r.sourceAwardId,generationNo:r.generationNo,
           theoryAmount:amount(r.theory),kFactor:k.toDecimalPlaces(8),payableAmount:new D(line.after),
           activeSnapshot:owner.active,effectiveDirectCountSnapshot:r.awardType==='REFERRAL'?null:owner.direct,planLevelSnapshot:owner.plan,
           ruleVersionCode:b.ruleVersionCode,parameterSnapshotHash:r.parameters.hash,
           occurredAt:r.occurredAt,pendingUntil:new Date(r.occurredAt.getTime()+pendingDays.toNumber()*86400000),calculationDetail:clean(basis)
         }});
         assert(!idsByKey.has(line.key),'duplicate new award key');idsByKey.set(line.key,added.bonusAwardId);
         const company=await lib.routeCompanyBonus(tx,added,r.parameters);
         assert(company===(line.owner==='COMPANY'),'new award destination mismatch');
         if(!company){
           const mature=added.pendingUntil<=asOf;
           await tx.bonusAwardLifecycleEvent.createMany({data:[
             {bonusAwardId:added.bonusAwardId,status:'CALCULATED',occurredAt:asOf,reasonCode:'CURRENT_TREE_AWARD_REBASE'},
             {bonusAwardId:added.bonusAwardId,status:mature?'EFFECTIVE':'PENDING_45D',occurredAt:new Date(+asOf+1),reasonCode:'CURRENT_TREE_AWARD_REBASE'}
           ]});
         }
       }
     }
     const all=await tx.bonusAward.findMany({where:{settlementBatchId:id}}),awardById=new Map(all.map(r=>[r.bonusAwardId,r]));
     const planned=new Map(result.lines.map(l=>[l.key,l]));
     assert(planned.size===all.length,'partial period award coverage');
     const recipients=period.rows.map(r=>{
       const awardId=idsByKey.get(key(r)),award=awardById.get(awardId),line=planned.get(key(r)),f=period.factsAt(r.recipientQualificationId,r.occurredAt);
       assert(award&&line,'qualified award is missing');
       return clean({key:awardId,awardId,awardType:r.awardType,qualificationId:r.recipientQualificationId,
         sourceEventId:r.sourceEventId||undefined,sourceAwardId:r.sourceAwardId||undefined,generation:r.generationNo||0,
         posted:line.after,theory:r.theory.toString(),rate:r.extra?.rate,active:f.active,eligible:true,pendingUntil:award.pendingUntil.toISOString(),
         detail:{...r.extra,parameterSnapshot:r.parameters},qualification:f.qualification});
     }).sort((a,b)=>a.key.localeCompare(b.key));
     const keep=new Set(recipients.map(r=>r.awardId)),retiredAwardIds=all.filter(a=>!keep.has(a.bonusAwardId)).map(a=>a.bonusAwardId).sort();
     const content=clean({...env,recipients,evidence:revisedEvidence,inputs:{...env.inputs,totalGpv:result.gpv,k:result.k}});
     const sourceId=stableUuid(actionKey+'|'+id+'|snapshot'),snapshotId=stableUuid(actionKey+'|'+id+'|row');
     const snapshotHash=hash(content);
     const sealed=await tx.historicalReplaySnapshot.create({data:{snapshotId,kind:'AWARD_REBASE_V1_'+b.settlementType,sourceId,
       ruleVersionCode:b.ruleVersionCode,hash:snapshotHash,content}});
     lib.verifyReplayEnvelope(sealed);
     const afterData={version:1,originalSnapshotId:snap.snapshotId,originalHash:snap.hash,snapshotId,snapshotHash,topologyHash:check.topology.hash,retiredAwardIds};
     await tx.auditEvent.create({data:{
       action:'AWARD_REBASE_BASELINE',actorType:'SYSTEM',environment:'PRODUCTION',entityType:'SETTLEMENT_BATCH',entityId:id,
       requestId:actionKey,correlationId,beforeHash:activeSnap.hash,afterHash:snapshotHash,afterData,
       reasonCode:'CURRENT_SPONSOR_AND_BINARY_TREE_RECALCULATION'
     }});
     final.push({id,type:b.settlementType,before:result.before,after:result.after,
       changed:period.operations.filter(o=>o.line.delta!=='0').length,created:period.operations.filter(o=>!o.award).length,
       zeroAdded:period.operations.filter(o=>!o.award&&o.line.after==='0').length,snapshotId,snapshotHash,retiredAwardIds});
   }
   const verify=await inspectAwards(tx,{asOf});
   for(const p of verify.work)assert(p.operations.length===0&&p.result.carryChanged.length===0&&new D(p.result.after).eq(p.result.before),'post-apply net difference '+p.b.settlementBatchId);
   const receipt={actionKey,hash:check.hash,topologyHash:check.topology.hash,periods:final,verificationHash:verify.hash};
   await tx.replayAction.create({data:{actionKey:replayActionKey,stateHash:check.hash,result:receipt}});
   return receipt;
 }
 return {inspectAwards,applyAwards};
}
module.exports={createAwardEngine};
