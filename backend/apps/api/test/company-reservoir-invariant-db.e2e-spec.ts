import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {captureParameters,routeCompanyBonus,routeCompanyFinal,accountingMonth,storeReplaySnapshot,appendEntitlementDelta} from '@ucell/database';
import {companyReservoirCandidates} from '../src/modules/admin-operations/company-reservoir-invariants';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {orderEconomicEvidence} from '../src/modules/admin-operations/order-economic-evidence';
import {orderReplayPostingEvidence} from '../src/modules/admin-operations/order-replay-posting-evidence';
import {OperationsCompanyHealthService} from '../src/modules/admin-operations/operations-company-health.service';
import {OperationsWorkItemsService} from '../src/modules/admin-operations/operations-work-items.service';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
import {erpBusinessReference} from '@ucell/database';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('Company Reservoir B integrity candidates',()=>{
  let db:PrismaClient,qid:string;
  beforeAll(async()=>{
    db=new PrismaClient({datasources:{db:{url}}});
    const person=await db.person.create({data:{legalName:'Synthetic invariant operator'}}),subject=randomUUID();
    await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
    await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
    const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
    const principal:TreePrincipal={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
    const trees=new BinaryTreeService(db as any,new IdempotencyService(db as any),new OrganizationService(db as any));
    const tree=(await trees.create(principal,{treeName:'Reservoir invariant fixture',reason:'Synthetic test'},randomUUID())).value;
    qid=tree.companyQualificationIds[0];
  });
  afterAll(()=>db.$disconnect());
  // Corruption fixtures are inspected inside an uncommitted transaction and
  // rolled back. Deferred economic guards are never disabled or bypassed.
  async function rollback(work:(tx:Prisma.TransactionClient)=>Promise<void>){
    const stop=new Error('ROLLBACK_INVARIANT_FIXTURE');
    await expect(db.$transaction(async tx=>{await work(tx);throw stop;},{timeout:20000})).rejects.toBe(stop);
  }
  async function award(tx:Prisma.TransactionClient,amount=100){
    const at=new Date(),snapshot=await captureParameters(tx,at,'R1.0B');
    const source=await tx.bonusAward.create({data:{recipientQualificationId:qid,awardType:'REFERRAL',sourceEventId:randomUUID(),theoryAmount:amount,payableAmount:amount,activeSnapshot:true,planLevelSnapshot:'LEADER',ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,occurredAt:at,pendingUntil:at,calculationDetail:{}}});
    return {source,snapshot};
  }
  it('reports a missing company destination without leaking source IDs or writing facts',()=>rollback(async tx=>{
    const {source,snapshot}=await award(tx);
    const first=await companyReservoirCandidates(tx,200),second=await companyReservoirCandidates(tx,200);
    expect(first).toEqual(second);
    expect(first).toEqual([expect.objectContaining({code:'COMPANY_AWARD_DESTINATION_MISSING',sourceType:'BONUS_AWARD',detail:{awardType:'REFERRAL',amount:'100'}})]);
    expect(JSON.stringify(first)).not.toContain(source.bonusAwardId);
    expect(JSON.stringify(first)).not.toContain(qid);
    expect(await tx.bonusAward.findUniqueOrThrow({where:{bonusAwardId:source.bonusAwardId}})).toEqual(source);
    const proxy=new Proxy(tx,{get(target,key){return key==='$transaction'?(work:any)=>work(proxy):Reflect.get(target,key);}}) as any,monitor=new OperationsCompanyHealthService(proxy),work=new OperationsWorkItemsService(proxy,new AuditService(),new IdempotencyService(proxy)),reference=erpBusinessReference('COMPANY-BONUS',source.bonusAwardId),health=await monitor.list({scope:'COMPANY_BONUS',reference}),candidate=health.items[0].candidates[0],context={actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()};
    expect(health.items[0].evidence).toMatchObject({historicalCompany:true,sourceAmount:'100.0000',destination:null,originalCredit:'0.0000'});expect(candidate.code).toBe('COMPANY_AWARD_DESTINATION_MISSING');
    const task=(await work.createTask({stream:'COMPANY_BONUS',reference,code:candidate.code,evidenceHash:candidate.evidenceHash,assigneeRole:'FINANCE'},randomUUID(),context)).value.item;await work.transition('TASK',task.reference,{status:'COMPLETED',expectedStatus:'OPEN',noteReference:'COMPANY-CASE-01'},randomUUID(),context);expect(await tx.awardEconomicDestination.count({where:{sourceBonusAwardId:source.bonusAwardId}})).toBe(0);
    const exception=await tx.operationalException.create({data:{sourceType:'COMPANY_BONUS_AWARD',sourceId:reference,exceptionCode:candidate.code,severity:'CRITICAL',summary:'PRIVATE COMPANY'}}),exceptionRef=erpBusinessReference('OPS-EXCEPTION',exception.operationalExceptionId),resolve=()=>work.transition('EXCEPTION',exceptionRef,{status:'RESOLVED',expectedStatus:'OPEN',noteReference:'COMPANY-CASE-02'},randomUUID(),context);
    await expect(resolve()).rejects.toMatchObject({response:{code:'OPERATIONS_COMPANY_RECONCILIATION_REQUIRED'}});await expect(new AdminOperationsService(proxy,new AuditService()).transitionOperationalException(exception.operationalExceptionId,'RESOLVED',context.actorId,'COMPANY-CASE-02',context.requestId,context.correlationId)).rejects.toThrow();
    await routeCompanyBonus(tx,source,snapshot);expect((await monitor.list({scope:'COMPANY_BONUS',reference})).items[0].candidates).toEqual([]);expect((await resolve()).value.status).toBe('RESOLVED');
    for(const hidden of [source.bonusAwardId,qid,context.actorId,'PRIVATE COMPANY'])expect(JSON.stringify(await monitor.list({scope:'COMPANY_BONUS',reference}))).not.toContain(hidden);
  }));
  it.each([0,100])('detects a missing original credit for entitlement %s',amount=>rollback(async tx=>{
    const {source,snapshot}=await award(tx,amount);
    // Inject failure at the application writer boundary after a valid
    // destination insert, before its required original credit.
    await routeCompanyBonus({...tx,reservoirBEffect:{create:async()=>null}} as any,source,snapshot);
    const candidates=await companyReservoirCandidates(tx,200);
    expect(candidates).toEqual([expect.objectContaining({code:'RESERVOIR_B_ENTITLEMENT_MISMATCH',detail:{awardType:'REFERRAL',expectedAmount:String(amount),originalAmount:'0',originalEffectCount:0}})]);
  }));
  it('detects a missing replay effect and accepts its exact signed adjustment without rewriting the original',()=>rollback(async tx=>{
    const {source,snapshot}=await award(tx);await routeCompanyBonus(tx,source,snapshot);
    expect(await companyReservoirCandidates(tx,200)).toEqual([]);
    const destination=await tx.awardEconomicDestination.findUniqueOrThrow({where:{sourceBonusAwardId:source.bonusAwardId}});
    const original=await tx.reservoirBEffect.findFirstOrThrow({where:{destinationId:destination.destinationId,effectType:'ENTITLEMENT'}});
    const replaySnapshot=await tx.historicalReplaySnapshot.create({data:{kind:'INVARIANT_TEST',sourceId:randomUUID(),ruleVersionCode:'R1.0B',content:{recipients:[{key:source.bonusAwardId,qualificationId:qid,posted:'100',eligible:true}]},hash:'a'.repeat(64)}});
    const posting=await tx.entitlementReplayPosting.create({data:{actionKey:randomUUID(),snapshotId:replaySnapshot.snapshotId,entitlementKey:source.bonusAwardId,recipientQualificationId:qid,originallyPosted:100,recalculatedEntitlement:80,delta:-20,stateHash:'b'.repeat(64)}});
    expect(await companyReservoirCandidates(tx,200)).toEqual([expect.objectContaining({code:'RESERVOIR_B_REPLAY_MISMATCH',detail:expect.objectContaining({mismatchedPostingCount:1})})]);
    await tx.reservoirBEffect.create({data:{destinationId:destination.destinationId,effectType:'REPLAY_ADJUSTMENT',replayPostingId:posting.postingId,amountDelta:-20,effectiveAt:destination.effectiveAt,idempotencyKey:randomUUID()}});
    expect(await companyReservoirCandidates(tx,200)).toEqual([]);
    expect(await tx.reservoirBEffect.findUniqueOrThrow({where:{effectId:original.effectId}})).toEqual(original);
    const health=await new OperationsCompanyHealthService({$transaction:(work:any)=>work(tx)} as any).list({scope:'COMPANY_BONUS',reference:erpBusinessReference('COMPANY-BONUS',source.bonusAwardId)});expect(health.items[0].evidence).toMatchObject({originalEntitlement:'100.0000',originalCredit:'100.0000',replayAdjustment:'-20.0000',recordedBalance:'80.0000'});expect(health.items[0].candidates).toEqual([]);
  }));
  it('reports legacy member-payable read evidence without bypassing current database write guards',()=>rollback(async tx=>{
    const {source,snapshot}=await award(tx);
    await routeCompanyBonus(tx,source,snapshot);
    // Such a write is forbidden by current DB guards. Supply legacy query
    // evidence at the read boundary instead of disabling those protections.
    const legacy={...tx,payableEntry:{findMany:async()=>[{sourceId:source.bonusAwardId,grossAmount:new Prisma.Decimal(100)}]}};
    expect(await companyReservoirCandidates(legacy as any,200)).toEqual([expect.objectContaining({code:'RESERVOIR_B_MEMBER_PAYABLE_CONFLICT',detail:{payableCount:1,payableGross:'100'}})]);
    expect(await tx.payableEntry.count({where:{sourceId:source.bonusAwardId}})).toBe(0);
  }));
  it.each(['REFERRAL','EPV'] as const)('projects explicitly order-linked Company %s awards and Reservoir B effects without internal identifiers',awardType=>rollback(async tx=>{
    const at=new Date(),snapshot=await captureParameters(tx,at,'R1.0B');
    const order=await tx.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:100,netAmount:100,ruleVersionCode:'R1.0B'}});
    const pv=await tx.pvLedger.create({data:{qualificationId:qid,pvType:awardType==='EPV'?'EPV':'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,eventType:awardType==='EPV'?'EPV_CREATED':'GPV_CREATED',ruleVersionCode:'R1.0B',occurredAt:at,correlationId:randomUUID()}});
    const source=await tx.bonusAward.create({data:{recipientQualificationId:qid,awardType,sourceEventId:pv.eventId,theoryAmount:25,payableAmount:25,activeSnapshot:true,planLevelSnapshot:'LEADER',ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,occurredAt:at,pendingUntil:at,calculationDetail:{}}});
    await routeCompanyBonus(tx,source,snapshot);
    const unrelated=await award(tx,75);
    await routeCompanyBonus(tx,unrelated.source,unrelated.snapshot);
    const evidence=await orderEconomicEvidence(tx,order.orderId,[]);
    expect(await orderEconomicEvidence(tx,order.orderId,[])).toEqual(evidence);
    expect(evidence.reservoirBDestinations).toEqual([expect.objectContaining({sourceKind:'BONUS_AWARD',sourceReference:evidence.awards[0].reference,destination:'RESERVOIR_B',awardType,finalAmount:'25',effects:[expect.objectContaining({effectType:'ENTITLEMENT',amountDelta:'25'})]})]);
    const json=JSON.stringify(evidence.reservoirBDestinations);
    const destination=await tx.awardEconomicDestination.findUniqueOrThrow({where:{sourceBonusAwardId:source.bonusAwardId},include:{effects:true}});
    for(const internal of [qid,order.orderId,pv.eventId,source.bonusAwardId,destination.destinationId,destination.binaryTreeId,destination.ownerIntervalId,...destination.effects.map(effect=>effect.effectId)])expect(json).not.toContain(internal);
    expect(await tx.awardEconomicDestination.findUniqueOrThrow({where:{destinationId:destination.destinationId},include:{effects:true}})).toEqual(destination);
  }));
  it('joins subscription RPV destinations and signed replay effects only to their source order',()=>rollback(async tx=>{
    const at=new Date(),snapshot=await captureParameters(tx,at,'R1.0B'),period=await accountingMonth(tx,snapshot,at);
    const order=await tx.order.create({data:{qualificationId:qid,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:'R1.0B'}});
    const otherOrder=await tx.order.create({data:{qualificationId:qid,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:'R1.0B'}});
    const plan=await tx.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Lineage plan',durationMonths:1,prepaidAmount:100,productBoxQty:1,monthlyRecognizedAmount:100,monthlyRpv:10}});
    for(const orderId of [order.orderId,otherOrder.orderId]){
      const subscription=await tx.subscription.create({data:{orderId,qualificationId:qid,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:at,endMonth:at,ruleVersionCode:'R1.0B'}});
      const schedule=await tx.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:at,recognizedAmount:100,rpvAmount:10,dueAt:at,ruleVersionCode:'R1.0B'}});
      const source=await tx.rpvUplineAwardEvent.create({data:{recognitionId:schedule.recognitionId,sourceQualificationId:qid,recipientQualificationId:qid,binaryGeneration:1,effectiveDirectCountSnapshot:0,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:100,payableAmount:100,ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,occurredAt:at}});
      await routeCompanyFinal(tx,{sourceRpvAwardId:source.rpvAwardEventId,qualificationId:qid,awardType:'RPV',amount:source.payableAmount,at,periodStart:period.start,periodEnd:period.end},snapshot);
      const destination=await tx.awardEconomicDestination.findUniqueOrThrow({where:{sourceRpvAwardId:source.rpvAwardEventId}});
      const replay=await tx.historicalReplaySnapshot.create({data:{kind:'RPV',sourceId:schedule.recognitionId,ruleVersionCode:'R1.0B',content:{recipients:[{key:source.rpvAwardEventId,qualificationId:qid,posted:'100',eligible:true}]},hash:'a'.repeat(64)}});
      const posting=await tx.entitlementReplayPosting.create({data:{actionKey:randomUUID(),snapshotId:replay.snapshotId,entitlementKey:source.rpvAwardEventId,recipientQualificationId:qid,originallyPosted:100,recalculatedEntitlement:80,delta:-20,stateHash:'b'.repeat(64)}});
      await tx.reservoirBEffect.create({data:{destinationId:destination.destinationId,effectType:'REPLAY_ADJUSTMENT',replayPostingId:posting.postingId,amountDelta:-20,effectiveAt:at,idempotencyKey:randomUUID()}});
    }
    const before=await tx.awardEconomicDestination.findMany({include:{effects:true},orderBy:{destinationId:'asc'}});
    const evidence=await orderEconomicEvidence(tx,order.orderId,[]);
    expect(await orderEconomicEvidence(tx,order.orderId,[])).toEqual(evidence);
    expect(evidence.reservoirBDestinations).toHaveLength(1);
    const recognition=evidence.subscriptionRecognitions[0] as any;
    expect(evidence.reservoirBDestinations[0]).toMatchObject({sourceKind:'RPV_AWARD',sourceReference:recognition.awards[0].reference,finalAmount:'100'});
    expect(evidence.reservoirBDestinations[0].effects).toEqual(expect.arrayContaining([expect.objectContaining({effectType:'ENTITLEMENT',amountDelta:'100'}),expect.objectContaining({effectType:'REPLAY_ADJUSTMENT',amountDelta:'-20'})]));
    const json=JSON.stringify(evidence);
    for(const row of before)for(const internal of [row.destinationId,row.sourceRpvAwardId!,row.binaryTreeId,row.ownerIntervalId,...row.effects.flatMap(effect=>[effect.effectId,...(effect.replayPostingId?[effect.replayPostingId]:[])])])expect(json).not.toContain(internal);
    expect(await tx.awardEconomicDestination.findMany({include:{effects:true},orderBy:{destinationId:'asc'}})).toEqual(before);
  }));
  it('joins Company replay effects through their exact posting without member recovery',()=>rollback(async tx=>{
    const at=new Date(),end=new Date(at.getTime()+1000),parameters=await captureParameters(tx,at,'R1.0B');
    const source=await tx.bonusAward.create({data:{recipientQualificationId:qid,awardType:'BINARY',sourceEventId:randomUUID(),theoryAmount:100,payableAmount:100,activeSnapshot:true,ruleVersionCode:'R1.0B',parameterSnapshotHash:parameters.hash,occurredAt:at,pendingUntil:at,calculationDetail:{}}});
    await routeCompanyBonus(tx,source,parameters);
    const order=await tx.order.create({data:{qualificationId:qid,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:'R1.0B'}});
    const ret=await tx.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:at,idempotencyKey:randomUUID(),correlationId:randomUUID()}});
    const actionKey=`RETURN:${ret.returnCaseId}`,stateHash='a'.repeat(64);
    const run=await tx.settlementReplayRun.create({data:{sourceReturnCaseId:ret.returnCaseId,initialPeriodStart:at,initialPeriodEnd:end,ruleVersionCode:'R1.0B',status:'CONVERGED',calculationSnapshot:{format:'UCELL_SETTLEMENT_REPLAY_RUN_V1',actionKey,stateHash,ruleVersionCode:'R1.0B'}}});
    const period=await tx.settlementReplayPeriod.create({data:{settlementReplayRunId:run.settlementReplayRunId,periodNo:1,periodStart:at,periodEnd:end,originalK1:1,recomputedK1:1,impactedQualifications:[qid],carryDeltaSnapshot:{},awardDeltaSnapshot:{binary:[{entitlementKey:source.bonusAwardId,qualificationId:qid,original:'100',recomputed:'80'}],matching:[]}}});
    const recipient={key:source.bonusAwardId,awardId:source.bonusAwardId,awardType:'BINARY' as const,qualificationId:qid,generation:0,active:true,eligible:true,theory:'100',posted:'100',pendingUntil:at.toISOString(),detail:{},qualification:{at:at.toISOString(),plan:{planCode:'LEADER'},status:{status:'EFFECTIVE'},activeIntervals:[{activeFrom:at.toISOString()}],economicOwner:{ownerType:'COMPANY'}}};
    const snapshot=await storeReplaySnapshot(tx,{format:'UCELL_HISTORICAL_REPLAY_V1',kind:'BINARY_K1',sourceId:randomUUID(),ruleVersionCode:'R1.0B',at:end.toISOString(),parameters,recipients:[recipient],evidence:{},inputs:{periodStart:at.toISOString(),periodEnd:end.toISOString()}});
    const posting=await appendEntitlementDelta(tx,snapshot,recipient,new Prisma.Decimal(80),actionKey,stateHash,ret.returnCaseId);
    await tx.replayAction.create({data:{actionKey,stateHash,result:{status:'REPLAYED',returnCaseId:ret.returnCaseId,replayRunId:run.settlementReplayRunId,stateHash}}});
    const evidence=await orderReplayPostingEvidence(tx,run,[period]);
    expect(evidence.actionCompleted).toBe(true);
    expect(evidence.periods[0].postings).toEqual([expect.objectContaining({delta:'-20',correctionAward:null,recovery:null,reservoirBEffect:expect.objectContaining({amountDelta:'-20'})})]);
    expect(await orderReplayPostingEvidence(tx,run,[period])).toEqual(evidence);
    for(const internal of [qid,actionKey,source.bonusAwardId,posting.postingId,run.settlementReplayRunId])expect(JSON.stringify(evidence)).not.toContain(internal);
  }));
  it('also inspects RPV and Global award destinations',()=>rollback(async tx=>{
    const at=new Date();
    const plan=await tx.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Invariant plan',durationMonths:1,prepaidAmount:100,productBoxQty:1,monthlyRecognizedAmount:100,monthlyRpv:10}});
    const subscription=await tx.subscription.create({data:{qualificationId:qid,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:at,endMonth:at,ruleVersionCode:'R1.0B'}});
    const schedule=await tx.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:at,recognizedAmount:100,rpvAmount:10,dueAt:at,ruleVersionCode:'R1.0B'}});
    await tx.rpvUplineAwardEvent.create({data:{recognitionId:schedule.recognitionId,sourceQualificationId:qid,recipientQualificationId:qid,binaryGeneration:1,effectiveDirectCountSnapshot:0,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:100,payableAmount:100,ruleVersionCode:'R1.0B',occurredAt:at}});
    const settlement=await tx.globalPoolSettlement.create({data:{periodStart:new Date(at.getTime()-1000),periodEnd:at,totalGpv:1000,poolRate:0.1,poolAvailable:100,distributedAmount:100,undistributedAmount:0,ruleVersionCode:'R1.0B'}});
    await tx.globalPoolAward.create({data:{globalPoolSettlementId:settlement.globalPoolSettlementId,qualificationId:qid,rankLevel:'NEW_STAR',rankPoolRate:1,rankPoolAmount:100,eligibleCount:1,payableAmount:100,weakSidePvSnapshot:1000,activeSnapshot:true}});
    const candidates=await companyReservoirCandidates(tx,200);
    expect(candidates.map(c=>c.sourceType).sort()).toEqual(['GLOBAL_AWARD','RPV_AWARD']);
    expect(candidates.every(c=>c.code==='COMPANY_AWARD_DESTINATION_MISSING')).toBe(true);
    const monitor=new OperationsCompanyHealthService({$transaction:(work:any)=>work(tx)} as any);for(const scope of ['COMPANY_RPV','COMPANY_GLOBAL']){const page=await monitor.list({scope});expect(page.items).toHaveLength(1);expect(page.items[0].evidence.historicalCompany).toBe(true);expect(page.items[0].candidates[0].code).toBe('COMPANY_AWARD_DESTINATION_MISSING');expect(JSON.stringify(page)).not.toContain(qid);}
  }));
  it('uses ownership at award time and excludes awards after company ownership ends',()=>rollback(async tx=>{
    const person=await tx.person.create({data:{legalName:'Historical owner fixture'}});
    const company=await tx.companyPrincipal.create({data:{code:randomUUID(),displayName:'Historical company'}});
    const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date('2020-01-01')}});
    await tx.qualificationOwnerInterval.create({data:{qualificationId:q.qualificationId,ownerType:'COMPANY',companyPrincipalId:company.companyPrincipalId,effectiveFrom:new Date('2024-01-01'),effectiveTo:new Date('2025-01-01'),closedRecordedAt:new Date(),sourceType:'TEST',sourceId:randomUUID(),evidenceHash:'a'.repeat(64)}});
    for(const at of [new Date('2024-06-01'),new Date('2025-01-01')]) await tx.bonusAward.create({data:{recipientQualificationId:q.qualificationId,awardType:'REFERRAL',sourceEventId:randomUUID(),theoryAmount:100,payableAmount:100,activeSnapshot:true,ruleVersionCode:'R1.0B',occurredAt:at,pendingUntil:at,calculationDetail:{}}});
    const candidates=await companyReservoirCandidates(tx,200);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({code:'COMPANY_AWARD_DESTINATION_MISSING',reference:`QUALIFICATION:${q.qualificationNo}:REFERRAL:2024-06-01T00:00:00.000Z`});
    const monitor=new OperationsCompanyHealthService({$transaction:(work:any)=>work(tx)} as any),first=await monitor.list({scope:'COMPANY_BONUS',take:1}),next=await monitor.list({scope:'COMPANY_BONUS',take:1,cursor:first.nextCursor!,asOf:first.asOf});expect(next.items[0].reference).not.toBe(first.items[0].reference);expect([...first.items,...next.items].map(row=>row.evidence.historicalCompany).sort()).toEqual([false,true]);expect([...first.items,...next.items].flatMap(row=>row.candidates)).toHaveLength(1);
  }));
});
