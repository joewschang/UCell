import {PeriodProjectionService} from '../src/modules/analytics/period-projection.service';
import {BinaryTreeReadService} from '../src/modules/binary-tree/binary-tree-read.service';
import {GlobalPoolService} from '../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../src/modules/global-pool/global-pool-persistence';
import {ReservoirService} from '../src/modules/reservoir/reservoir.service';
import {AdminStructuredExplainService} from '../src/modules/explain/admin-structured-explain.service';
import {randomUUID} from 'node:crypto';
import {projectPeriodFacts} from '../src/modules/analytics/period-projection-sources';
import {PrismaService,Prisma,recognizeConsumption,captureParameters,sealGpvEvent,processHistoricalReturn,verifyReplayEnvelope} from '@ucell/database';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {ReferralBonusService} from '../src/modules/bonus/referral-bonus.service';
import {BinaryBonusService} from '../src/modules/bonus/binary-bonus.service';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
const db=new PrismaService(),org=new OrganizationService(db),treeService=new BinaryTreeService(db,new IdempotencyService(db),org);
afterAll(()=>db.$disconnect());
it('Company Golden: existing Core Referral/Equalization/Binary/Matching/Carry, append-only Return/Replay and payout isolation',async()=>{
 const person=await db.person.create({data:{legalName:'SYNTHETIC COMPANY GOLDEN'}}),subject=randomUUID();
 await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
 await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
 const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
 const p:TreePrincipal={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
 const start=new Date();
 const tree=(await treeService.create(p,{treeName:'Company Economic Golden',reason:'Synthetic Golden'},randomUUID())).value;
 await treeService.change(p,tree.binaryTreeId,{status:'ACTIVE',expectedVersion:1,reason:'Synthetic Golden'},randomUUID());
 const members:string[]=[];
 for(let i=0;i<5;i++){
  const at=new Date(),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
  members.push(q.qualificationId);
  await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:at,sourceType:'SYNTHETIC_GOLDEN'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'SYNTHETIC_GOLDEN'}});
  await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:person.personId,effectiveFrom:at,sourceType:'SYNTHETIC_GOLDEN',sourceId:randomUUID()}});
  if(i<4)await treeService.confirmCompanySponsor(p,tree.binaryTreeId,{qualificationId:q.qualificationId,reason:'Synthetic Golden'},randomUUID());
  else await db.sponsorRelationship.create({data:{childQualificationId:q.qualificationId,sponsorQualificationId:members[0],sponsorSequenceNo:1,effectiveFrom:new Date()}});
  await treeService.place(p,tree.binaryTreeId,{qualificationId:q.qualificationId,binaryParentQualificationId:i<4?tree.companyQualificationIds[1+Math.floor(i/2)]:members[0],side:i%2?'RIGHT':'LEFT',expectedVersion:2+i,reason:'Synthetic Golden'},randomUUID());
 }
 const product=await db.productReference.create({data:{sku:'COMPANY-GOLDEN-'+randomUUID(),displayName:'Synthetic GPV',currentPrice:20000}});
 const orders:Array<any>=[];
 for(let i=0;i<5;i++){
  const at=new Date(),amount=i<4?200000:100000,snapshot=await captureParameters(db as unknown as Prisma.TransactionClient,at,'R1.0B');
  const order=await db.order.create({data:{qualificationId:members[i],purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:amount,netAmount:amount,ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,
   lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:10,unitPrice:amount/10,lineAmount:amount,gpvRateSnapshot:1,gpvAmountSnapshot:amount,ruleProfileSnapshot:{synthetic:true,parameterSnapshotHash:snapshot.hash}}}},include:{lines:true}});
  orders.push(order);
  await db.$transaction(async tx=>{
   const recognition=await recognizeConsumption(tx,{qualificationId:members[i],sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC_FULL_LINE',ruleVersionCode:'R1.0B',parameterSnapshotHash:snapshot.hash,recognizedAt:at,activeThreshold:'2000'});
   expect(recognition.created).toBe(true);await sealGpvEvent(tx,recognition.volume!);
  },{isolationLevel:'Serializable'});
 }
 const end=new Date(),query=new BonusQueryService(db);
 // Core arithmetic and persistence use a precise synthetic period; calendar cadence has separate Golden tests.
 const calendar={captureForPeriod:(tx:Prisma.TransactionClient)=>captureParameters(tx,end,'R1.0B')};
 const referral=new ReferralBonusService(db,{} as any,query,calendar as any),binary=new BinaryBonusService(db,{} as any,query,calendar as any);
 const pendingNow=new Date().toISOString();
 const unfinalizedDistribution=await db.$transaction(tx=>projectPeriodFacts(tx,{metrics:['bonus.distribution'],time:{timezone:'Asia/Taipei',periodStart:start.toISOString(),periodEnd:new Date(end.getTime()+1).toISOString(),asOf:pendingNow,knowledgeCutoff:pendingNow},dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],filters:{binaryTreeId:tree.binaryTreeId},limit:100}));
 expect(unfinalizedDistribution).toMatchObject({status:'STALE',rows:[],manifest:{pendingSourceCount:'5'}});
 const k0=await referral.settle(start,end),k1=await binary.settleBinary(start,end),k2=await binary.settleMatching(start,end);
 const companyIds=tree.companyQualificationIds;
 const destinations=await db.awardEconomicDestination.findMany({where:{binaryTreeId:tree.binaryTreeId},include:{effects:true}});
 expect(new Set(destinations.map(d=>d.awardType))).toEqual(new Set(['REFERRAL','EQUALIZATION','BINARY','MATCHING']));
 for(const qid of companyIds){
  const profile=await db.companyBootstrapProfileBinding.findFirstOrThrow({where:{qualificationId:qid}});
  expect(profile.planCode).toBe('LEADER');
  expect(await db.qualificationGlobalRankHistory.count({where:{qualificationId:qid}})).toBe(0);
  expect(await db.bonusAwardLifecycleEvent.count({where:{bonusAwardId:{in:destinations.filter(d=>d.qualificationId===qid).map(d=>d.sourceBonusAwardId!)}}})).toBe(0);
  expect(destinations.some(d=>d.qualificationId===qid&&d.awardType==='BINARY')).toBe(true);
 }
 expect((await db.binaryCarry.findUniqueOrThrow({where:{qualificationId_periodEnd_ruleVersionCode:{qualificationId:companyIds[0],periodEnd:end,ruleVersionCode:'R1.0B'}}})).leftCarryOut.toString()).toBe('100000');
 for(const d of destinations){expect(d.effects).toHaveLength(1);expect(d.effects[0].amountDelta.eq(d.finalAmount)).toBe(true);}
 // BEFORE INSERT guards must reject mismatched economic metadata, before duplicate-source checks.
 const {effects:ignoredEffects,destinationId:ignoredId,recordedAt:ignoredAt,...destinationCopy}=destinations[0];
 for(const mutation of [{awardType:'GLOBAL'},{sourceSettlementId:randomUUID()},{periodStart:new Date(destinations[0].periodStart.getTime()+1)}]){
  await expect(db.awardEconomicDestination.create({data:{...destinationCopy,parameterSnapshot:destinationCopy.parameterSnapshot as Prisma.InputJsonValue,destinationId:randomUUID(),...mutation}})).rejects.toThrow('RESERVOIR_B_PERIOD_SOURCE_MISMATCH');
 }
 const original=JSON.stringify(await db.bonusAward.findMany({where:{settlementBatchId:{in:[k0.settlementBatchId,k1.settlementBatchId,k2.settlementBatchId]}},orderBy:{bonusAwardId:'asc'}}));
 const target=orders[3],source=await db.pvLedger.findFirstOrThrow({where:{sourceId:target.orderId,pvType:'GPV'}});
 const anchor=await db.bonusAward.findFirstOrThrow({where:{sourceEventId:source.eventId,awardType:'REFERRAL',recipientQualificationId:companyIds[0]}});
 expect(anchor.payableAmount.toString()).toBe('50000');
 const aCount=await db.reservoirLedgerEffect.count();
 for(let i=0;i<2;i++){
  const ret=await db.returnCase.create({data:{orderId:target.orderId,status:'POSTED',postedAt:new Date(),occurredAt:new Date(),reasonCode:'SYNTHETIC_GOLDEN',idempotencyKey:randomUUID(),correlationId:randomUUID(),
   lines:{create:{orderLineId:target.lines[0].orderLineId,quantity:2,returnAmount:40000,gpvReversalAmount:40000}}}});
  await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:30000});
  const count=await db.reservoirBEffect.count();
  await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:30000});
  expect(await db.reservoirBEffect.count()).toBe(count);
  expect(await db.bonusRecoveryEvent.count({where:{returnCaseId:ret.returnCaseId,bonusAward:{recipientQualificationId:{in:companyIds}}}})).toBe(0);
 }
 const final=await db.awardEconomicDestination.findUniqueOrThrow({where:{sourceBonusAwardId:anchor.bonusAwardId},include:{effects:{orderBy:{recordedAt:'asc'}}}});
 expect(final.effects.map(e=>e.amountDelta.toString())).toEqual(['50000','-10000','-10000']);
 expect(await db.reservoirLedgerEffect.count()).toBe(aCount);
 expect(JSON.stringify(await db.bonusAward.findMany({where:{settlementBatchId:{in:[k0.settlementBatchId,k1.settlementBatchId,k2.settlementBatchId]}},orderBy:{bonusAwardId:'asc'}}))).toBe(original);
 await expect(db.bonusAwardLifecycleEvent.create({data:{bonusAwardId:anchor.bonusAwardId,status:'PAID',occurredAt:new Date()}})).rejects.toThrow();
 await expect(db.reservoirBEffect.update({where:{effectId:final.effects[0].effectId},data:{amountDelta:1}})).rejects.toThrow();
 await expect(db.reservoirBEffect.create({data:{destinationId:final.destinationId,effectType:'ENTITLEMENT',amountDelta:50000,effectiveAt:anchor.occurredAt,idempotencyKey:randomUUID()}})).rejects.toThrow();
 const subtreeOrder=orders[4],subtreeReturn=await db.returnCase.create({data:{orderId:subtreeOrder.orderId,status:'POSTED',postedAt:new Date(),occurredAt:new Date(),reasonCode:'SYNTHETIC_SUBTREE_RETURN',idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:subtreeOrder.lines[0].orderLineId,quantity:1,returnAmount:10000,gpvReversalAmount:10000}}}});
 await db.$transaction(tx=>processHistoricalReturn(tx,subtreeReturn.returnCaseId),{timeout:30000});
 const global=await new GlobalPoolService(db,{} as any,query,calendar as any,new GlobalPoolPersistence()).evaluateAndSettle(start,end);
 const globalB=await db.awardEconomicDestination.findMany({where:{sourceSettlementId:global.globalPoolSettlementId,awardType:'GLOBAL'}});
 expect(globalB).toHaveLength(1);expect(globalB[0].qualificationId).toBe(companyIds[0]);
 expect(globalB[0].finalAmount.gt(0)).toBe(true);
 expect(await db.qualificationGlobalRankHistory.count({where:{qualificationId:companyIds[1]}})).toBe(0);
 expect(await db.qualificationGlobalRankHistory.count({where:{qualificationId:companyIds[2]}})).toBe(0);
 expect(await db.reservoirLedgerEffect.count({where:{sourceGlobalSettlementId:global.globalPoolSettlementId}})).toBe(1);
 await new UnifiedPayableService(db,{} as any).materialize(new Date(Date.now()+365*86400000));
 expect(await db.payableEntry.count({where:{qualificationId:{in:companyIds}}})).toBe(0);
 const sealed=verifyReplayEnvelope(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:k1.settlementBatchId}}}));
 expect(sealed.evidence.carryRecipients.filter((r:any)=>companyIds.includes(r.qualificationId)).every((r:any)=>r.active&&r.qualification.plan.planCode==='LEADER')).toBe(true);

 const now=new Date().toISOString(),time={timezone:'Asia/Taipei' as const,asOf:now,knowledgeCutoff:now,periodStart:start.toISOString(),periodEnd:new Date(end.getTime()+1).toISOString()};
 const queryFor=(metric:string)=>({metrics:[metric],time,dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],filters:{binaryTreeId:tree.binaryTreeId},limit:100});

 for(const [metric,batch] of [['pool.k0',k0],['pool.k1',k1],['pool.k2',k2]] as const){
  const result=await db.$transaction(tx=>projectPeriodFacts(tx,{metrics:[metric],time,dimensions:['settlementId'],groupBy:['settlementId'],filters:{settlementId:batch.settlementBatchId},limit:100}));
  expect(result.status).toBe('CURRENT');expect(result.rows).toHaveLength(1);
  expect(result.rows[0].evidence.replaySequence).toBeTruthy();
  const [revision]=await db.$queryRaw<any[]>`SELECT * FROM ledger.settlement_replay_metric WHERE settlement_batch_id=${batch.settlementBatchId}::uuid ORDER BY sequence DESC LIMIT 1`;
  expect(new Prisma.Decimal(result.rows[0].measures.k!).eq(revision.k_factor)).toBe(true);
  expect(new Prisma.Decimal(revision.total_gpv).eq(810000)).toBe(true);
  await expect(db.$executeRaw`UPDATE ledger.settlement_replay_metric SET k_factor=0 WHERE sequence=${revision.sequence}`).rejects.toThrow();
 }
 const returns=await db.$transaction(tx=>projectPeriodFacts(tx,queryFor('return.cohort_rates')));
 expect(returns).toMatchObject({status:'CURRENT',rows:[{measures:{orderNumerator:'2',orderDenominator:'5',orderRate:'0.40000000',amountNumerator:'90000.00',amountDenominator:'900000.0000',unitNumerator:'5.0000',unitDenominator:'50.0000'}}]});
 const founding=await db.$transaction(tx=>projectPeriodFacts(tx,queryFor('founding.statistics')));
 expect(founding.status).toBe('CURRENT');const fourth=founding.rows.find(r=>r.key==='4')!;
 expect(fourth.measures).toMatchObject({descendantBalls:'1',leftBalls:'1',rightBalls:'0',monthlyNewBalls:'1',leftCarry:'90000.0000',rightCarry:'0.0000',pairPv:'0.0000'});
 expect(new Prisma.Decimal(fourth.measures.cumulativeGpv!).eq(90000)).toBe(true);
 expect(founding.rows.filter(r=>r.key!=='4').every(r=>new Prisma.Decimal(r.measures.cumulativeGpv!).eq(0))).toBe(true);
 const distribution=await db.$transaction(tx=>projectPeriodFacts(tx,queryFor('bonus.distribution')));
 expect(distribution.status).toBe('CURRENT');expect(distribution.rows).toHaveLength(8);
 expect(distribution.manifest).toMatchObject({populationCount:'5',excludedCompanyCount:'3',unknownOwnerCount:'0'});
 expect(distribution.rows.reduce((n,r)=>n+Number(r.measures.count),0)).toBe(5);
 const carryMetric=await db.$transaction(tx=>projectPeriodFacts(tx,{...queryFor('binary.left_carry'),dimensions:['qualificationId'],groupBy:['qualificationId'],filters:{qualificationId:members[0]}}));
 expect(carryMetric).toMatchObject({status:'CURRENT',rows:[{measures:{value:'90000.0000'}}]});
 const comparison=await db.$transaction(tx=>projectPeriodFacts(tx,queryFor('tree.comparison')));
 expect(comparison).toMatchObject({status:'CURRENT',rows:[{measures:{balls:'8',monthlyNewBalls:'8'}}]});
 const ranks=await db.$transaction(tx=>projectPeriodFacts(tx,queryFor('rank.distribution')));
 expect(ranks.manifest).toMatchObject({eligibleCount:'5',excludedCompanyCount:'3'});
 const rankGpv=await db.$transaction(tx=>projectPeriodFacts(tx,queryFor('rank.gpv')));
 expect(rankGpv.status).toBe('CURRENT');expect(new Prisma.Decimal(rankGpv.rows.find(r=>r.key==='UNRANKED')!.measures.gpv!).eq(810000)).toBe(true);
 const rankBonus=await db.$transaction(tx=>projectPeriodFacts(tx,queryFor('rank.bonus')));
 expect(rankBonus.status).toBe('CURRENT');expect(rankBonus.rows.reduce((n,r)=>n.add(String(r.measures.totalEntitlement)),new Prisma.Decimal(0)).eq(distribution.rows.reduce((n,r)=>n.add(String(r.measures.totalEntitlement)),new Prisma.Decimal(0)))).toBe(true);
 const active=await db.$transaction(tx=>projectPeriodFacts(tx,queryFor('active.rate')));
 expect(active).toMatchObject({status:'CURRENT',rows:[{measures:{numerator:'5',denominator:'5',rate:'1.00000000'}}]});
 const center=new ReservoirService(db),ledger=await center.list(p,'B',time,{tree:tree.binaryTreeId});
 expect(ledger.total).toBe(await db.reservoirBEffect.count({where:{destination:{binaryTreeId:tree.binaryTreeId}}}));
 expect(ledger.items.every((r:any)=>r.tree===tree.binaryTreeId)).toBe(true);
 expect((await center.list(p,'A',time,{})).total).toBe(1);
 await expect(center.list({...p,role:'ORDER_OPS'},'B',time,{})).rejects.toMatchObject({status:403});
 await expect(center.list(p,'B',time,{position:1},undefined,ledger.snapshotToken)).rejects.toMatchObject({status:409});
 const explain=new AdminStructuredExplainService(db);
 const result=await explain.explain({user:p},'explainReservoirB',{resourceId:final.effects[0].effectId,time:{...time,periodStart:start.toISOString(),periodEnd:end.toISOString()}});
 expect(result.status).toBe('AVAILABLE');expect(result.result).toMatchObject({amount:'50000',theory:'50000',final:'50000',profile:'LEADER',economicDestination:'RESERVOIR_B',position:'1'});

 // Global was already finalized: shared Core replay must revise both typed destinations.
 // A registry update after sealing must not rewrite historical LEADER economics.
 const capRows=await db.runtimeRuleParameter.findMany({where:{ruleVersionCode:'R1.0B',parameterCode:'binary.weekly.cap',scopeKey:'LEADER',effectiveTo:null}});
 expect(capRows).toHaveLength(1);
 const parameterChangeAt=new Date();
 await db.$transaction(async tx=>{
  await tx.runtimeRuleParameter.update({where:{runtimeRuleParameterId:capRows[0].runtimeRuleParameterId},data:{effectiveTo:parameterChangeAt}});
  await tx.runtimeRuleParameter.create({data:{ruleVersionCode:'R1.0B',parameterCode:'binary.weekly.cap',scopeKey:'LEADER',valueJson:'1',effectiveFrom:parameterChangeAt}});
 });
 const updatedParameters=await captureParameters(db as unknown as Prisma.TransactionClient,new Date(),'R1.0B');
 expect(updatedParameters.hash).not.toBe(sealed.parameters.hash);
 expect(updatedParameters.parameters.find(r=>r.code==='binary.weekly.cap'&&r.scope==='LEADER')!.value).toBe('1');
 const globalOriginal=JSON.stringify(await db.globalPoolAward.findMany({where:{globalPoolSettlementId:global.globalPoolSettlementId}}));
 const globalDestination=globalB[0];
 for(let index=0;index<2;index++){
  const ret=await db.returnCase.create({data:{orderId:target.orderId,status:'POSTED',postedAt:new Date(),occurredAt:new Date(),reasonCode:'SYNTHETIC_GLOBAL_RETURN',idempotencyKey:randomUUID(),correlationId:randomUUID(),
   lines:{create:{orderLineId:target.lines[0].orderLineId,quantity:1,returnAmount:20000,gpvReversalAmount:20000}}}});
  const pendingTime={...time,asOf:new Date().toISOString(),knowledgeCutoff:new Date().toISOString()};
  const pendingLedger=await center.list(p,'B',pendingTime,{tree:tree.binaryTreeId});
  expect(pendingLedger.status).toBe('STALE');
  for(const metric of ['bonus.distribution','active.rate','rank.gpv']){
   const stale=await db.$transaction(tx=>projectPeriodFacts(tx,{...queryFor(metric),time:pendingTime}));
   expect(stale.status).toBe('STALE');
  }
  const staleK=await db.$transaction(tx=>projectPeriodFacts(tx,{metrics:['pool.k1'],time:pendingTime,dimensions:['settlementId'],groupBy:['settlementId'],filters:{settlementId:k1.settlementBatchId},limit:100}));
  expect(staleK.status).toBe('STALE');
  await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:30000});
  const stablePending=await center.list(p,'B',pendingTime,{tree:tree.binaryTreeId},undefined,pendingLedger.snapshotToken);
  expect(stablePending.status).toBe('STALE');expect(stablePending.cumulative).toBe(pendingLedger.cumulative);
  const refreshedTime={...time,asOf:new Date().toISOString(),knowledgeCutoff:new Date().toISOString()};
  expect((await center.list(p,'B',refreshedTime,{tree:tree.binaryTreeId})).status).toBe('CURRENT');
  const effects=await db.reservoirBEffect.findMany({where:{destinationId:globalDestination.destinationId},orderBy:{recordedAt:'asc'}});
  expect(effects.reduce((sum,e)=>sum.add(e.amountDelta),new Prisma.Decimal(0)).toString()).toBe(index===0?'11850':'0');
  expect(await db.bonusRecoveryEvent.count({where:{returnCaseId:ret.returnCaseId,bonusAward:{recipientQualificationId:{in:companyIds}}}})).toBe(0);
  const before=await db.reservoirBEffect.count();await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:30000});expect(await db.reservoirBEffect.count()).toBe(before);
 }
 expect(JSON.stringify(await db.globalPoolAward.findMany({where:{globalPoolSettlementId:global.globalPoolSettlementId}}))).toBe(globalOriginal);
 expect(await db.qualificationGlobalRankHistory.count({where:{qualificationId:companyIds[0],rankCode:'NEW_STAR'}})).toBe(1);
 const globalA=await db.reservoirLedgerEffect.aggregate({where:{sourceGlobalSettlementId:global.globalPoolSettlementId},_sum:{amount:true}});
 expect(globalA._sum.amount!.toString()).toBe('38500');

 const adjustment=await explain.explain({user:p},'explainReservoirB',{resourceId:final.effects[1].effectId,time:{...time,periodStart:start.toISOString(),periodEnd:end.toISOString()}});
 expect(adjustment.result).toMatchObject({amount:'-10000',kind:'CORRECTION'});
 // A member-origin company-held Ball keeps STARTER and uses ordinary Core referral parameters.
 const transferAt=new Date(),company=await db.companyPrincipal.findUniqueOrThrow({where:{code:'UCELL_COMPANY'}});
 const owner=await db.qualificationOwnerInterval.findFirstOrThrow({where:{qualificationId:members[0],effectiveTo:null}});
 await db.$transaction(async tx=>{
  await tx.qualificationOwnerInterval.update({where:{ownerIntervalId:owner.ownerIntervalId},data:{effectiveTo:transferAt,closedRecordedAt:transferAt}});
  await tx.qualificationOwnerInterval.create({data:{qualificationId:members[0],ownerType:'COMPANY',companyPrincipalId:company.companyPrincipalId,effectiveFrom:transferAt,sourceType:'SYNTHETIC_COMPANY_SUCCESSION',sourceId:randomUUID(),evidenceHash:'c'.repeat(64)}});
  await tx.qualification.update({where:{qualificationId:members[0]},data:{currentHolderPersonId:null,currentCompanyPrincipalId:company.companyPrincipalId}});
 });
 const transferReadTime={...time,asOf:new Date().toISOString(),knowledgeCutoff:new Date().toISOString()};
 const transferDetail=await new BinaryTreeReadService(db,treeService).detail(p,tree.binaryTreeId,transferReadTime);
 expect(transferDetail.result!.positions.find(r=>r.positionNo===4)!.activeLabel).toBe('Always Active (Company Rule)');
 expect(transferDetail.result!.positions.find(r=>r.positionNo===1)!.activeLabel).toBe('Always Active (Company Rule)');
 const transferProjection=await db.$transaction(tx=>projectPeriodFacts(tx,{...queryFor('founding.statistics'),time:transferReadTime}));
 expect(transferProjection.rows.find(r=>r.key==='4')!.measures.active).toBe('ALWAYS_ACTIVE');
 const foundingScope={...queryFor('founding.statistics'),time:transferReadTime,filters:{binaryTreeId:tree.binaryTreeId,foundingBallId:members[0]}};
 const scopedFounding=await db.$transaction(tx=>projectPeriodFacts(tx,foundingScope));
 expect(scopedFounding.rows).toHaveLength(1);expect(scopedFounding.rows[0].key).toBe('4');
 const scopedWorker=new PeriodProjectionService(db),scopedJob=await scopedWorker.request(p,foundingScope,'REBUILD',randomUUID());
 expect(await scopedWorker.runOne()).toMatchObject({jobId:scopedJob.jobId,status:'COMPLETED'});
 expect((await scopedWorker.read(p,foundingScope)).result).toHaveLength(1);
 await expect(db.$transaction(tx=>projectPeriodFacts(tx,{...foundingScope,filters:{binaryTreeId:tree.binaryTreeId,foundingBallId:randomUUID()}}))).rejects.toThrow('FOUNDING_SCOPE_NOT_IN_TREE');
 expect(new Date(transferDetail.result!.positions.find(r=>r.positionNo===4)!.lastUpdated!).getTime()).toBeGreaterThanOrEqual(transferAt.getTime());
 expect(new Date(String(transferProjection.rows.find(r=>r.key==='4')!.evidence.lastUpdated)).getTime()).toBeGreaterThanOrEqual(transferAt.getTime());
 const nextAt=new Date(),nextSnapshot=await captureParameters(db as unknown as Prisma.TransactionClient,nextAt,'R1.0B');
 const nextOrder=await db.order.create({data:{qualificationId:members[4],purpose:'RETAIL',status:'PAID',paidAt:nextAt,grossAmount:2000,netAmount:2000,ruleVersionCode:'R1.0B',parameterSnapshotHash:nextSnapshot.hash,
  lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:2000,lineAmount:2000,gpvRateSnapshot:1,gpvAmountSnapshot:2000,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
 await db.$transaction(async tx=>{
  const recognized=await recognizeConsumption(tx,{qualificationId:members[4],sourceType:'ORDER',sourceId:nextOrder.orderId,sourceLineId:nextOrder.lines[0].orderLineId,amount:2000,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC_FULL_LINE',ruleVersionCode:'R1.0B',parameterSnapshotHash:nextSnapshot.hash,recognizedAt:nextAt,activeThreshold:'2000'});
  await sealGpvEvent(tx,recognized.volume!);
 });
 const nextEnd=new Date(),nextCalendar={captureForPeriod:(tx:Prisma.TransactionClient)=>captureParameters(tx,nextEnd,'R1.0B')};
 const nextK0=await new ReferralBonusService(db,{} as any,query,nextCalendar as any).settle(transferAt,nextEnd);
 const memberOriginB=await db.awardEconomicDestination.findFirstOrThrow({where:{qualificationId:members[0],sourceSettlementId:nextK0.settlementBatchId,awardType:'REFERRAL'},include:{sourceBonusAward:true}});
 expect(memberOriginB.bindingId).toBeNull();expect(memberOriginB.companyPosition).toBeNull();
 expect(memberOriginB.sourceBonusAward!.planLevelSnapshot).toBe('STARTER');
 const starterRate=nextSnapshot.parameters.find(r=>r.code==='referral.g1.rate'&&r.scope==='STARTER')!.value as string;
 expect(memberOriginB.sourceBonusAward!.theoryAmount.eq(new Prisma.Decimal(2000).mul(starterRate))).toBe(true);
 expect(await db.companyBootstrapProfileBinding.count({where:{qualificationId:members[0]}})).toBe(0);
 expect((await db.qualification.findUniqueOrThrow({where:{qualificationId:members[0]}})).planLevelCode).toBe('STARTER');
 const historicalBinary=await db.awardEconomicDestination.findFirstOrThrow({where:{qualificationId:companyIds[0],sourceSettlementId:k1.settlementBatchId,awardType:'BINARY'},include:{effects:true}});
 expect(historicalBinary.effects.reduce((n,e)=>n.add(e.amountDelta),new Prisma.Decimal(0)).gt(1)).toBe(true);

 await db.authSession.update({where:{authSessionId:p.sessionId},data:{revokedAt:new Date()}});
 await expect(center.list(p,'B',time,{},undefined,ledger.snapshotToken)).rejects.toMatchObject({status:403});

},120000);
