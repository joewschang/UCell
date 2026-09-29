import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {appendEntitlementDelta,captureParameters,storeReplaySnapshot} from '@ucell/database';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('ORDER_ECONOMIC_EVIDENCE_REAL_DB',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());
  async function fixture(ruleVersionCode='R1'){
    const person=await db.person.create({data:{legalName:'Private lineage holder'}});
    const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
    const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode}});
    const pv=await db.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,eventType:'GPV_CREATED',ruleVersionCode,occurredAt:new Date(),correlationId:randomUUID()}});
    const award=async(sourceEventId:string,sourceAwardId?:string)=>db.bonusAward.create({data:{recipientQualificationId:q.qualificationId,sourceEventId,sourceAwardId,awardType:'REFERRAL',theoryAmount:10,payableAmount:10,activeSnapshot:true,ruleVersionCode:'R1',occurredAt:new Date(),pendingUntil:new Date(),calculationDetail:{privateNote:'do not expose'}}});
    const service=new AdminOperationsService(db as any,new AuditService());
    return {person,q,order,pv,award,read:()=>service.economicLineageByOrderNo(order.orderNo.toString())};
  }
  it('joins direct and derived awards to exact payables while excluding unrelated recipient awards',async()=>{
    const f=await fixture(),direct=await f.award(f.pv.eventId),child=await f.award(randomUUID(),direct.bonusAwardId),unrelated=await f.award(randomUUID());
    const payable=await db.payableEntry.create({data:{qualificationId:f.q.qualificationId,sourceType:'BONUS_AWARD',sourceId:child.bonusAwardId,awardType:'REFERRAL',grossAmount:10,availableAt:new Date(),ruleVersionCode:'R1'}});
    const first=await f.read(),second=await f.read();
    expect(first).toEqual(second);
    const evidence=first.economicEvidence;
    expect(evidence.awards).toHaveLength(2);
    expect(evidence.awards[0].sourcePvReference).toBe(evidence.pvEvents[0].reference);
    expect(evidence.awards[1].sourceAwardReference).toBe(evidence.awards[0].reference);
    expect(evidence.payables).toEqual([expect.objectContaining({awardReference:evidence.awards[1].reference,grossAmount:'10',status:'OPEN',payout:null})]);
    const json=JSON.stringify(first);
    for(const secret of [f.person.personId,f.q.qualificationId,f.order.orderId,direct.bonusAwardId,child.bonusAwardId,unrelated.bonusAwardId,payable.payableEntryId,'Private lineage holder','privateNote']) expect(json).not.toContain(secret);
    expect(await db.payableEntry.findUniqueOrThrow({where:{payableEntryId:payable.payableEntryId}})).toEqual(payable);
  });
  async function periodFixture(kind:string){
    const f=await fixture('R1.0B'),at=f.pv.occurredAt;
    const parameters=await db.$transaction(tx=>captureParameters(tx,at,'R1.0B'));
    const source={format:'UCELL_HISTORICAL_REPLAY_V1' as const,kind:'GPV',sourceId:f.pv.eventId,ruleVersionCode:'R1.0B',at:at.toISOString(),parameters,recipients:[],evidence:{privateIdentity:f.person.personId},inputs:{eventId:f.pv.eventId,orderId:f.order.orderId,volume:'100'}};
    const envelope={format:'UCELL_HISTORICAL_REPLAY_V1' as const,kind,sourceId:String(randomUUID()),ruleVersionCode:'R1.0B',at:new Date(at.getTime()+1000).toISOString(),parameters,recipients:[],evidence:{sources:[source]},inputs:{periodStart:at.toISOString(),periodEnd:new Date(at.getTime()+1000).toISOString(),totalGpv:'900000'}};
    return {f,envelope,source};
  }
  it.each([3,-2,-6])('reports recorded EPV adjustment %s without recomputing monthly eligibility',async delta=>{
    const f=await fixture();
    const event=await db.pvLedger.create({data:{qualificationId:f.q.qualificationId,pvType:'EPV',amount:5,sourceType:'ORDER',sourceId:f.order.orderId,eventType:'EPV_CREATED',ruleVersionCode:'R1',occurredAt:new Date(),correlationId:randomUUID()}});
    const snapshot=await db.historicalReplaySnapshot.create({data:{kind:'EPV',sourceId:event.eventId,ruleVersionCode:'R1',content:{recipients:[{key:'self',qualificationId:f.q.qualificationId,posted:'10',eligible:true}]},hash:'a'.repeat(64)}});
    await db.entitlementReplayPosting.create({data:{actionKey:randomUUID(),snapshotId:snapshot.snapshotId,entitlementKey:'self',recipientQualificationId:f.q.qualificationId,originallyPosted:10,recalculatedEntitlement:10+delta,delta,stateHash:'b'.repeat(64)}});
    await db.pvLedger.create({data:{qualificationId:f.q.qualificationId,pvType:'EPV',amount:delta,sourceType:'RETURN',sourceId:randomUUID(),sourceLineId:event.eventId,eventType:'EPV_REPLAY_ADJUSTMENT',reversalOfEventId:event.eventId,ruleVersionCode:'R1',occurredAt:new Date(),correlationId:randomUUID()}});
    if(delta===-6){await expect(f.read()).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_CORRUPT'}});return;}
    const first=(await f.read()).economicEvidence;
    expect(first.epvRetentions).toEqual([expect.objectContaining({basis:'RECORDED_PV_AND_ENTITLEMENT_STATE',originalVolume:'5',recordedDelta:String(delta),recordedRetainedVolume:String(5+delta),replayedEntitlements:[expect.objectContaining({originallyPosted:'10',recordedDelta:String(delta),recordedEntitlement:String(10+delta)})]})]);
    expect((await f.read()).economicEvidence).toEqual(first);
    for(const secret of [event.eventId,snapshot.snapshotId,f.q.qualificationId])expect(JSON.stringify(first.epvRetentions)).not.toContain(secret);
    expect(await db.pvLedger.findUniqueOrThrow({where:{eventId:event.eventId}})).toEqual(event);
  });
  it.each(['none','partial','full','excess'])('explains current retained GPV from exact posted return lines: %s',async mode=>{
    const f=await fixture();
    const product=await db.productReference.create({data:{sku:randomUUID(),displayName:'Retention fixture',currentPrice:100}});
    const line=await db.orderLine.create({data:{orderId:f.order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'Retention fixture',quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
    const pv=await db.pvLedger.create({data:{qualificationId:f.q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:f.order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode:'R1',occurredAt:new Date(),correlationId:randomUUID()}});
    for(const value of [999,...(mode==='none'?[]:mode==='partial'?[30,20]:mode==='full'?[30,70]:[101])]){
      const ret=await db.returnCase.create({data:{orderId:f.order.orderId,status:value===999?'DRAFT':'POSTED',reasonCode:'TEST',occurredAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID()}});
      await db.returnLine.create({data:{returnCaseId:ret.returnCaseId,orderLineId:line.orderLineId,quantity:0.1,returnAmount:1,gpvReversalAmount:value}});
    }
    if(mode==='excess'){await expect(f.read()).rejects.toMatchObject({response:{code:'RETURN_AMOUNT_EXCEEDED'}});return;}
    const first=(await f.read()).economicEvidence;
    expect(first.gpvRetention).toEqual(expect.arrayContaining([expect.objectContaining({status:'SOURCE_LINE_UNAVAILABLE',retainedGpv:null}),expect.objectContaining({status:'CALCULATED_FROM_POSTED_RETURNS',basis:'CURRENT_POSTED_RETURN_STATE',originalGpv:'100',reversedGpv:mode==='none'?'0':mode==='partial'?'50':'100',retainedGpv:mode==='none'?'100':mode==='partial'?'50':'0'})]));
    expect(first.gpvRetention.find(row=>row.status==='CALCULATED_FROM_POSTED_RETURNS')!.returns).toHaveLength(mode==='none'?0:2);
    expect((await f.read()).economicEvidence).toEqual(first);
    for(const internal of [f.order.orderId,line.orderLineId,pv.eventId,f.q.qualificationId])expect(JSON.stringify(first.gpvRetention)).not.toContain(internal);
    expect(await db.pvLedger.findUniqueOrThrow({where:{eventId:pv.eventId}})).toEqual(pv);
  });
  it.each(['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'])('reports exact sealed %s period membership without allocating period awards',async kind=>{
    const {f,envelope,source}=await periodFixture(kind);
    const unrelated={...source,sourceId:randomUUID(),inputs:{eventId:randomUUID(),orderId:randomUUID(),volume:'899900'}};
    envelope.evidence.sources.push(unrelated);
    const snapshot=await db.$transaction(tx=>storeReplaySnapshot(tx,envelope));
    const evidence=(await f.read()).economicEvidence;
    expect(evidence.periodContributions).toEqual([expect.objectContaining({kind,attribution:'SEALED_PERIOD_INPUT_ONLY',orderOriginalGpv:'100',snapshotHash:snapshot.hash,periodStart:envelope.inputs.periodStart,periodEnd:envelope.inputs.periodEnd,sources:[{sourcePvReference:evidence.pvEvents[0].reference,originalGpv:'100'}]})]);
    expect(evidence.awards).toEqual([]);
    expect(evidence.payables).toEqual([]);
    expect((await f.read()).economicEvidence).toEqual(evidence);
    const json=JSON.stringify(evidence.periodContributions);
    for(const internal of [snapshot.snapshotId,envelope.sourceId,f.pv.eventId,f.order.orderId,f.person.personId,unrelated.sourceId,'900000','899900','privateIdentity'])expect(json).not.toContain(internal);
    expect(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:snapshot.snapshotId}})).toEqual(snapshot);
    const other=await fixture('R1.0B');
    expect((await other.read()).economicEvidence.periodContributions).toEqual([]);
  });
  it.each(['order','volume','duplicate','endBoundary','hash'])('rejects inconsistent sealed period evidence: %s',async fault=>{
    const {f,envelope,source}=await periodFixture('BINARY_K1');
    if(fault==='order')source.inputs.orderId=randomUUID();
    if(fault==='volume')source.inputs.volume='101';
    if(fault==='duplicate')envelope.evidence.sources.push(source);
    if(fault==='endBoundary'){
      envelope.inputs.periodStart=new Date(f.pv.occurredAt.getTime()-1000).toISOString();
      envelope.inputs.periodEnd=f.pv.occurredAt.toISOString();
    }
    if(fault==='hash')await db.historicalReplaySnapshot.create({data:{kind:envelope.kind,sourceId:envelope.sourceId,ruleVersionCode:envelope.ruleVersionCode,content:JSON.parse(JSON.stringify(envelope)),hash:'invalid'}});
    else await db.$transaction(tx=>storeReplaySnapshot(tx,envelope));
    await expect(f.read()).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_CORRUPT'}});
  });
  it.each(['BINARY_K1','GLOBAL'])('explains %s sealed recipients and exact postings as whole-period context',async kind=>{
    const {f,envelope}=await periodFixture(kind),key=randomUUID(),awardId=randomUUID();
    const recipient={key,awardId,awardType:kind==='GLOBAL'?'GLOBAL' as const:'BINARY' as const,qualificationId:f.q.qualificationId,generation:0,active:true,eligible:true,theory:'120',posted:'100',pendingUntil:envelope.at,detail:{privateNote:'secret recipient detail'},qualification:{at:envelope.at,plan:{planCode:'STARTER'},status:{status:'EFFECTIVE'},activeIntervals:[{activeFrom:envelope.inputs.periodStart}]}};
    const snapshot=await db.$transaction(tx=>storeReplaySnapshot(tx,{...envelope,recipients:[recipient]}));
    const posting=await db.entitlementReplayPosting.create({data:{actionKey:randomUUID(),snapshotId:snapshot.snapshotId,entitlementKey:key,recipientQualificationId:f.q.qualificationId,originallyPosted:100,recalculatedEntitlement:80,delta:-20,stateHash:'b'.repeat(64)}});
    const first=(await f.read()).economicEvidence;
    const context=first.periodContributions[0].periodContext;
    expect(context.attribution).toBe('WHOLE_PERIOD_NOT_ORDER_ALLOCATION');
    expect(context.recipients).toEqual([expect.objectContaining({awardType:recipient.awardType,active:true,eligible:true,theoryAmount:'120',originallyPosted:'100'})]);
    expect(context.corrections).toEqual([expect.objectContaining({entitlementReference:context.recipients[0].reference,originallyPosted:'100',recalculatedEntitlement:'80',delta:'-20'})]);
    expect(first.awards).toEqual([]);
    expect(first.payables).toEqual([]);
    expect((await f.read()).economicEvidence).toEqual(first);
    for(const secret of [key,awardId,f.q.qualificationId,f.person.personId,snapshot.snapshotId,posting.postingId,'privateNote','secret recipient detail'])expect(JSON.stringify(context)).not.toContain(secret);
    expect(await db.entitlementReplayPosting.findUniqueOrThrow({where:{postingId:posting.postingId}})).toEqual(posting);
  });
  it.each(['MAX_HORIZON','CONVERGED'] as const)('shows return-linked downstream carry checkpoints without inferring payment for %s',async status=>{
    const f=await fixture(),other=await fixture();
    let ownRun:any;
    for(const current of [f,other]){
      const ret=await db.returnCase.create({data:{orderId:current.order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID()}});
      const run=await db.settlementReplayRun.create({data:{sourceReturnCaseId:ret.returnCaseId,initialPeriodStart:new Date('2026-01-01'),initialPeriodEnd:new Date('2026-01-08'),ruleVersionCode:'R1',status,maxWeeks:2,processedWeeks:2,calculationSnapshot:{privateIdentity:current.person.personId}}});
      for(const periodNo of [2,1])await db.settlementReplayPeriod.create({data:{settlementReplayRunId:run.settlementReplayRunId,periodNo,periodStart:new Date(`2026-01-${periodNo===1?'01':'08'}`),periodEnd:new Date(`2026-01-${periodNo===1?'08':'15'}`),originalK1:1,recomputedK1:0.9,impactedQualifications:[current.q.qualificationId],awardDeltaSnapshot:{binary:[{entitlementKey:randomUUID(),qualificationId:current.q.qualificationId,original:'10',recomputed:'8',privateNote:'unprojected award detail'}],matching:[]},carryDeltaSnapshot:{[current.q.qualificationId]:{original:{left:'100',right:'0'},recomputed:{left:'80',right:'0'},privateNote:'unprojected carry detail'}}}});
      if(current===f)ownRun=run;
    }
    const first=(await f.read()).economicEvidence;
    expect(first.returnReplays).toHaveLength(1);
    expect(first.returnReplays[0]).toMatchObject({status,evidenceType:'CALCULATION_CHECKPOINT_NOT_PAYMENT',processedWeeks:2,maxWeeks:2});
    expect(first.returnReplays[0].periods.map(period=>period.periodNo)).toEqual([1,2]);
    expect(first.returnReplays[0].periods[1].carryChanges).toEqual([expect.objectContaining({original:{left:'100',right:'0'},recomputed:{left:'80',right:'0'}})]);
    expect(first.returnReplays[0].periods[1].awardChanges).toEqual([expect.objectContaining({kind:'binary',original:'10',recomputed:'8',recipientReference:first.returnReplays[0].periods[1].carryChanges[0].recipientReference})]);
    expect(first.periodContributions).toEqual([]);
    expect(first.payables).toEqual([]);
    expect((await f.read()).economicEvidence).toEqual(first);
    for(const secret of [ownRun.settlementReplayRunId,ownRun.sourceReturnCaseId,f.q.qualificationId,f.person.personId,other.q.qualificationId,'privateNote','privateIdentity'])expect(JSON.stringify(first.returnReplays)).not.toContain(secret);
    expect(await db.settlementReplayRun.findUniqueOrThrow({where:{settlementReplayRunId:ownRun.settlementReplayRunId}})).toEqual(ownRun);
  });
  it.each(['positive','negative','wrongState','wrongCarry','noEffects'])('joins exact replay posting/carry evidence: %s',async mode=>{
    const {f,envelope}=await periodFixture('BINARY_K1');
    const start=new Date(envelope.inputs.periodStart),end=new Date(envelope.inputs.periodEnd),stateHash='c'.repeat(64);
    const batch=await db.settlementBatch.create({data:{settlementType:'BINARY_K1',periodStart:start,periodEnd:end,ruleVersionCode:'R1.0B'}});
    envelope.sourceId=batch.settlementBatchId;
    const original=await db.bonusAward.create({data:{recipientQualificationId:f.q.qualificationId,awardType:'BINARY',sourceEventId:randomUUID(),theoryAmount:10,payableAmount:10,activeSnapshot:true,ruleVersionCode:'R1.0B',occurredAt:start,pendingUntil:start,calculationDetail:{}}});
    const recipient={key:original.bonusAwardId,awardId:original.bonusAwardId,awardType:'BINARY' as const,qualificationId:f.q.qualificationId,generation:0,active:true,eligible:true,theory:'10',posted:'10',pendingUntil:start.toISOString(),detail:{},qualification:{at:envelope.at,plan:{planCode:'STARTER'},status:{status:'EFFECTIVE'},activeIntervals:[{activeFrom:start.toISOString()}]}};
    const snapshot=await db.$transaction(tx=>storeReplaySnapshot(tx,{...envelope,recipients:[recipient]}));
    const ret=await db.returnCase.create({data:{orderId:f.order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:start,idempotencyKey:randomUUID(),correlationId:randomUUID()}});
    const actionKey=`RETURN:${ret.returnCaseId}`;
    const run=await db.settlementReplayRun.create({data:{sourceReturnCaseId:ret.returnCaseId,initialPeriodStart:start,initialPeriodEnd:end,ruleVersionCode:'R1.0B',status:mode==='noEffects'?'MAX_HORIZON':'CONVERGED',processedWeeks:1,calculationSnapshot:{format:'UCELL_SETTLEMENT_REPLAY_RUN_V1',actionKey,stateHash,ruleVersionCode:'R1.0B'}}});
    const target=mode==='positive'?'12':'8';
    await db.settlementReplayPeriod.create({data:{settlementReplayRunId:run.settlementReplayRunId,periodNo:1,periodStart:start,periodEnd:end,originalK1:1,recomputedK1:1,impactedQualifications:[f.q.qualificationId],awardDeltaSnapshot:{binary:[{entitlementKey:recipient.key,qualificationId:f.q.qualificationId,original:'10',recomputed:target}],matching:[]},carryDeltaSnapshot:{[f.q.qualificationId]:{original:{left:'100',right:'0'},recomputed:{left:'80',right:'0'}}}}});
    if(mode!=='noEffects'){
      await db.$transaction(tx=>appendEntitlementDelta(tx,snapshot,recipient,new Prisma.Decimal(target),actionKey,mode==='wrongState'?'d'.repeat(64):stateHash,ret.returnCaseId));
      await db.replayCarryProjection.create({data:{actionKey,settlementBatchId:batch.settlementBatchId,periodEnd:end,ruleVersionCode:'R1.0B',stateHash,carry:{[f.q.qualificationId]:{left:mode==='wrongCarry'?'81':'80',right:'0',pairedPv:'20'}}}});
      await db.replayAction.create({data:{actionKey,stateHash,result:{returnCaseId:ret.returnCaseId,replayRunId:run.settlementReplayRunId,status:'REPLAYED',stateHash}}});
    }
    // Same batch, different action must never be attributed to this return.
    await db.replayCarryProjection.create({data:{actionKey:randomUUID(),settlementBatchId:batch.settlementBatchId,periodEnd:end,ruleVersionCode:'R1.0B',stateHash,carry:{[f.q.qualificationId]:{left:'999',right:'0',pairedPv:'0'}}}});
    if(mode==='wrongState'||mode==='wrongCarry'){
      await expect(f.read()).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_CORRUPT'}});
      return;
    }
    const before=await db.entitlementReplayPosting.findMany({where:{actionKey}});
    if(mode==='negative'){
      const payout=await db.payoutBatch.create({data:{periodStart:start,periodEnd:end,status:'READY',totalGross:1,totalRecovery:1,totalNet:0}});
      const line=await db.payoutLine.create({data:{payoutBatchId:payout.payoutBatchId,recipientQualificationId:f.q.qualificationId,grossAmount:1,recoveryOffset:1,netAmount:0,detailJson:{privateNote:'hidden offset detail'}}});
      await db.$transaction(tx=>new RecoveryBalanceService(db as any).apply(tx,{qualificationId:f.q.qualificationId,payoutLineId:line.payoutLineId,maxAmount:new Prisma.Decimal(1)}));
    }
    if(mode==='positive'){
      const initial=(await f.read()).economicEvidence.returnReplays[0].recordedEffects.periods[0].postings[0].correctionAward as any;
      expect(initial.payables).toEqual([]);
      const payout=await db.payoutBatch.create({data:{periodStart:start,periodEnd:end,status:'READY',totalGross:12,totalRecovery:0,totalNet:12}});
      const payoutLine=await db.payoutLine.create({data:{payoutBatchId:payout.payoutBatchId,recipientQualificationId:f.q.qualificationId,grossAmount:12,netAmount:12,detailJson:{privateBankDetail:'hidden'}}});
      await db.payableEntry.create({data:{qualificationId:f.q.qualificationId,sourceType:'BONUS_AWARD',sourceId:before[0].correctionAwardId!,awardType:'BINARY',grossAmount:2,availableAt:start,status:'ALLOCATED',payoutLineId:payoutLine.payoutLineId,ruleVersionCode:'R1.0B'}});
      await db.payableEntry.create({data:{qualificationId:f.q.qualificationId,sourceType:'MANUAL_TEST',sourceId:randomUUID(),awardType:'BINARY',grossAmount:10,availableAt:start,status:'ALLOCATED',payoutLineId:payoutLine.payoutLineId,ruleVersionCode:'R1.0B'}});
      const service=new AdminOperationsService(db as any,new AuditService()),actor=randomUUID();
      await service.approvePayout(payout.payoutBatchId,'FINANCE_REVIEW',actor,'FINANCE',undefined,randomUUID(),randomUUID());
      await service.approvePayout(payout.payoutBatchId,'COMPLIANCE_REVIEW',randomUUID(),'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());
      await service.exportPayout(payout.payoutBatchId,randomUUID(),actor,'FINANCE',randomUUID(),randomUUID());
      for(const paidAmount of ['5','12'])await service.recordPayoutResults(payout.payoutBatchId,{results:[{payoutLineId:payoutLine.payoutLineId,status:'PAID',paidAmount,paymentReference:`PRIVATE-BANK-${paidAmount}`}]},actor,'FINANCE',randomUUID(),randomUUID());
    }
    const first=(await f.read()).economicEvidence;
    const evidence=first.returnReplays[0].recordedEffects;
    expect(evidence.status).toBe(mode==='noEffects'?'NO_RECORDED_EFFECTS':'RECORDED_EFFECTS');
    expect(evidence.actionCompleted).toBe(mode!=='noEffects');
    expect(evidence.periods[0].checkpointReference).toBe(first.returnReplays[0].periods[0].reference);
    if(mode==='noEffects'){
      expect(evidence.periods[0].postings).toEqual([]);
      expect(evidence.periods[0].carryProjections).toEqual([]);
    }else{
      expect(evidence.periods[0].postings).toHaveLength(1);
      expect(evidence.periods[0].postings[0]).toMatchObject({entitlementReference:first.returnReplays[0].periods[0].awardChanges[0].entitlementReference,delta:mode==='positive'?'2':'-2',correctionAward:mode==='positive'?expect.objectContaining({amount:'2'}):null,recovery:mode==='negative'?expect.objectContaining({amount:'2',outstandingAmount:'1',recoveredAmount:'1',status:'OFFSETTING'}):null});
      expect(evidence.periods[0].carryProjections).toEqual([expect.objectContaining({recipients:[expect.objectContaining({left:'80',right:'0',pairedPv:'20'})]})]);
      if(mode==='negative'){
        const recovery=evidence.periods[0].postings[0].recovery as any;
        expect(recovery.applications).toEqual([expect.objectContaining({amount:'1',payoutBatchStatus:'READY',basis:'RECOVERY_OFFSET_NOT_CASH_PAYMENT'})]);
        expect(first.recoveries.find(row=>row.reference===recovery.reference)!.applications).toEqual(recovery.applications);
        expect(JSON.stringify(recovery)).not.toContain('privateNote');
      }
      if(mode==='positive'){
        const correction=evidence.periods[0].postings[0].correctionAward as any;
        expect(correction.payables).toHaveLength(1);
        expect(correction.payables[0]).toMatchObject({grossAmount:'2',status:'PAID',payout:{attribution:'WHOLE_PAYOUT_LINE_NOT_CORRECTION_ALLOCATION',paymentAmountBasis:'CUMULATIVE_LINE_REPORTS_NOT_ADDITIVE',netAmount:'12',batchStatus:'PAID',paymentResults:[expect.objectContaining({reportedPaidAmount:'5'}),expect.objectContaining({reportedPaidAmount:'12'})]}});
        expect(JSON.stringify(evidence)).not.toMatch(/PRIVATE-BANK|privateBankDetail/);
      }
    }
    expect((await f.read()).economicEvidence).toEqual(first);
    expect(await db.entitlementReplayPosting.findMany({where:{actionKey}})).toEqual(before);
    for(const secret of [actionKey,ret.returnCaseId,run.settlementReplayRunId,original.bonusAwardId,f.q.qualificationId,batch.settlementBatchId,snapshot.snapshotId,...before.map(row=>row.postingId)])expect(JSON.stringify(evidence)).not.toContain(secret);
  });
  it('includes return-linked recovery without attributing its whole period award to the order',async()=>{
    const f=await fixture(),periodAward=await f.award(randomUUID());
    const ret=await db.returnCase.create({data:{orderId:f.order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID()}});
    await db.bonusRecoveryEvent.create({data:{bonusAwardId:periodAward.bonusAwardId,returnCaseId:ret.returnCaseId,recoveryAmount:3,outstandingAmount:3,reasonCode:'RETURN_TEST',occurredAt:new Date()}});
    const evidence=(await f.read()).economicEvidence;
    expect(evidence.awards).toEqual([]);
    expect(evidence.recoveries).toEqual([expect.objectContaining({awardIncluded:false,linkedToOrderReturn:true,recoveryAmount:'3',outstandingAmount:'3',recoveredAmount:'0'})]);
  });
  it('includes award recovery once when both award and return edges match',async()=>{
    const f=await fixture(),award=await f.award(f.pv.eventId);
    const ret=await db.returnCase.create({data:{orderId:f.order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID()}});
    await db.bonusRecoveryEvent.create({data:{bonusAwardId:award.bonusAwardId,returnCaseId:ret.returnCaseId,recoveryAmount:2,outstandingAmount:2,reasonCode:'RETURN_TEST',occurredAt:new Date()}});
    const evidence=(await f.read()).economicEvidence;
    expect(evidence.recoveries).toHaveLength(1);
    expect(evidence.recoveries[0]).toMatchObject({awardReference:evidence.awards[0].reference,awardIncluded:true,linkedToOrderReturn:true});
  });
  it('joins only subscription recognition, RPV awards and replay postings explicitly linked to the order',async()=>{
    const f=await fixture();
    const plan=await db.subscriptionPlan.create({data:{planCode:`LINEAGE-${randomUUID()}`,displayName:'Lineage plan',durationMonths:1,prepaidAmount:100,productBoxQty:1,monthlyRecognizedAmount:100,monthlyRpv:10}});
    const subscription=await db.subscription.create({data:{qualificationId:f.q.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,orderId:f.order.orderId,status:'ACTIVE',startMonth:new Date('2026-09-01'),endMonth:new Date('2026-09-01'),ruleVersionCode:'R1'}});
    const schedule=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:new Date('2026-09-01'),recognizedAmount:100,rpvAmount:10,status:'RECOGNIZED',dueAt:new Date('2026-09-01'),recognizedAt:new Date('2026-09-02'),ruleVersionCode:'R1'}});
    const pv=await db.pvLedger.create({data:{qualificationId:f.q.qualificationId,pvType:'RPV',amount:10,sourceType:'SUBSCRIPTION',sourceId:subscription.subscriptionId,sourceLineId:schedule.recognitionId,eventType:'RPV_CREATED',ruleVersionCode:'R1',occurredAt:new Date('2026-09-02'),correlationId:randomUUID()}});
    const award=await db.rpvUplineAwardEvent.create({data:{recognitionId:schedule.recognitionId,sourceQualificationId:f.q.qualificationId,recipientQualificationId:f.q.qualificationId,binaryGeneration:1,effectiveDirectCountSnapshot:1,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:10,payableAmount:10,ruleVersionCode:'R1',occurredAt:new Date('2026-09-02')}});
    const snapshot=await db.historicalReplaySnapshot.create({data:{kind:'RPV',sourceId:schedule.recognitionId,ruleVersionCode:'R1',content:{sealed:true,recipients:[{key:'RPV:G1',qualificationId:f.q.qualificationId,posted:'10',eligible:true}]},hash:'a'.repeat(64)}});
    const posting=await db.entitlementReplayPosting.create({data:{actionKey:`TEST:${randomUUID()}`,snapshotId:snapshot.snapshotId,entitlementKey:'RPV:G1',recipientQualificationId:f.q.qualificationId,originallyPosted:10,recalculatedEntitlement:8,delta:-2,stateHash:'b'.repeat(64)}});
    const cancellation=await db.subscriptionCancellation.create({data:{subscriptionId:subscription.subscriptionId,requestedAt:new Date(),effectiveAt:new Date(),reasonCode:'PARTIAL_RETURN',refundAmount:20,correlationId:randomUUID()}});
    await db.pvLedger.create({data:{qualificationId:f.q.qualificationId,pvType:'RPV',amount:-2,sourceType:'MONTHLY_RECOGNITION_REVERSAL',sourceId:cancellation.subscriptionCancellationId,sourceLineId:schedule.recognitionId,eventType:'RPV_REVERSAL',reversalOfEventId:pv.eventId,ruleVersionCode:'R1',occurredAt:new Date(),correlationId:randomUUID()}});
    const evidence=(await f.read()).economicEvidence;
    expect(evidence.subscriptionRecognitions).toEqual([expect.objectContaining({planCode:plan.planCode,installmentNo:1,status:'RECOGNIZED',pvEvent:expect.objectContaining({amount:'10'}),awards:[expect.objectContaining({generation:1,theoryAmount:'10',payableAmount:'10'})],replay:expect.objectContaining({hash:'a'.repeat(64),corrections:[expect.objectContaining({delta:'-2'})]})})]);
    expect(evidence.subscriptionRecognitions[0]).toMatchObject({scheduleRetainedEntitlementRatio:'1',postedCancellations:[expect.objectContaining({refundAmount:'20',fullCancellation:false})],recordedRetention:{originalVolume:'10',recordedDelta:'-2',recordedRetainedVolume:'8',replayedEntitlements:[expect.objectContaining({originallyPosted:'10',recordedEntitlement:'8'})]}});
    const json=JSON.stringify(evidence.subscriptionRecognitions);
    for(const internal of [subscription.subscriptionId,schedule.recognitionId,pv.eventId,award.rpvAwardEventId,snapshot.snapshotId,posting.postingId,f.q.qualificationId])expect(json).not.toContain(internal);
  });
});
