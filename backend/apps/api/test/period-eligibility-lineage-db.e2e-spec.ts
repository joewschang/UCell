import {PrismaClient,Prisma} from '@prisma/client';
import {sealGpvEvent,verifyReplayEnvelope} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {BinaryBonusService} from '../src/modules/bonus/binary-bonus.service';
import {ReferralBonusService} from '../src/modules/bonus/referral-bonus.service';
import {GlobalPoolService} from '../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../src/modules/global-pool/global-pool-persistence';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {RuntimeRuleService} from '../src/modules/rules/runtime-rule.service';
import {SettlementCalendarService} from '../src/modules/settlement/settlement-calendar.service';
import {orderEconomicEvidence} from '../src/modules/admin-operations/order-economic-evidence';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('sealed period eligibility writer-to-order lineage',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());

  it.each(['g1Inactive','g2Inactive','active'])('preserves recognition-time referral and fixed-generation equalization: %s',async mode=>{
    const rollback='REFERRAL_LINEAGE_ROLLBACK';
    await expect(db.$transaction(async tx=>{
      const start=new Date('1901-01-01T00:00:00Z'),end=new Date('1901-01-08T00:00:00Z');
      const effectiveFrom=new Date('1900-01-01T00:00:00Z'),at=new Date('1901-01-02T00:00:00Z');
      const rule=`TEST_REFERRAL_${randomUUID()}`;
      const parameters:Array<[string,string,Prisma.InputJsonValue]>=[
        ['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['referral.g1.rate','STARTER','0.15'],
        ['equalization.rate','STARTER:G2','0.1'],['equalization.rate','STARTER:G3','0.05'],['equalization.rate','STARTER:G4','0.02'],
        ['settlement.timezone','REFERRAL_K0','UTC'],['settlement.period','REFERRAL_K0',{unit:'WEEK',count:1,anchorLocal:'1901-01-01T00:00:00'}],
        ['settlement.cut_off','REFERRAL_K0',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_ONLY'}],
      ];
      for(const [parameterCode,scopeKey,valueJson] of parameters)await tx.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode,scopeKey,valueJson,effectiveFrom}});
      const person=await tx.person.create({data:{legalName:'PRIVATE-REFERRAL-HOLDER'}}),qualifications=[];
      for(let generation=0;generation<=4;generation++){
        const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:effectiveFrom}});
        qualifications.push(q);
        await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom,sourceType:'TEST_REFERRAL'}});
        await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom,sourceType:'TEST_REFERRAL'}});
        const inactive=(mode==='g1Inactive'&&generation===1)||(mode==='g2Inactive'&&generation===2);
        if(!inactive)await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:effectiveFrom,sourceType:'TEST_REFERRAL',ruleVersionCode:rule}});
        if(generation)await tx.sponsorRelationship.create({data:{sponsorQualificationId:q.qualificationId,childQualificationId:qualifications[generation-1].qualificationId,sponsorSequenceNo:1,effectiveFrom}});
      }
      const order=await tx.order.create({data:{qualificationId:qualifications[0].qualificationId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:rule}});
      const product=await tx.productReference.create({data:{sku:randomUUID(),displayName:'Referral fixture',currentPrice:100}});
      const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'Referral fixture',quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
      const event=await tx.pvLedger.create({data:{qualificationId:qualifications[0].qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode:rule,occurredAt:at,correlationId:randomUUID()}});
      await sealGpvEvent(tx,event);
      // Later eligibility before period close cannot replace recognition-time eligibility.
      if(mode!=='active')await tx.activePeriod.create({data:{qualificationId:qualifications[mode==='g1Inactive'?1:2].qualificationId,activeFrom:new Date('1901-01-03T00:00:00Z'),sourceType:'TEST_REFERRAL_LATER',ruleVersionCode:rule}});
      const proxy=new Proxy(tx,{get(target,key){return key==='$transaction'?(callback:any)=>callback(proxy):Reflect.get(target,key);}}) as any;
      const service=new ReferralBonusService(proxy,new RuntimeRuleService(proxy),new BonusQueryService(proxy),new SettlementCalendarService(proxy));
      const batch=await service.settle(start,end,rule);
      expect(batch.status).toBe('FINALIZED');expect(batch.totalGpv.toString()).toBe('100');expect(batch.kFactor.toString()).toBe('1');
      const awards=await tx.bonusAward.findMany({where:{settlementBatchId:batch.settlementBatchId},orderBy:{generationNo:'asc'}});
      const expectedAwards=[...(mode==='g1Inactive'?[]:[['REFERRAL',1,'15']]),...(mode==='g2Inactive'?[]:[['EQUALIZATION',2,'1.5']]),['EQUALIZATION',3,'0.75']];
      expect(awards.map(row=>[row.awardType,row.generationNo,row.payableAmount.toString()])).toEqual(expectedAwards);
      const decisions=await tx.bonusCalculationEvidence.findMany({where:{settlementBatchId:batch.settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}});
      expect(decisions).toHaveLength(mode==='active'?1:2);
      expect(decisions).toContainEqual(expect.objectContaining({recipientQualificationId:qualifications[4].qualificationId,evidenceType:'REFERRAL_MATCHING_ELIGIBILITY',reasonCode:'LOCKED'}));
      const stored=await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'REFERRAL_K0',sourceId:batch.settlementBatchId}}});
      expect(verifyReplayEnvelope(stored).evidence.eligibilityEvidence).toEqual(JSON.parse(JSON.stringify(decisions)));
      const first=await orderEconomicEvidence(tx,order.orderId,[]),context=first.periodContributions[0].periodContext;
      expect(context.eligibilityEvidenceStatus).toBe('RECORDED');expect(context.eligibilityDecisions).toHaveLength(decisions.length);
      expect(context.eligibilityDecisions).toContainEqual(expect.objectContaining({eligibilityType:'REFERRAL_MATCHING_ELIGIBILITY',reasonCode:'LOCKED',theoryAmount:'0.3',entitlementAmount:'0'}));
      if(mode!=='active')expect(context.eligibilityDecisions).toContainEqual(expect.objectContaining({eligibilityType:mode==='g1Inactive'?'REFERRAL_ELIGIBILITY':'REFERRAL_MATCHING_ELIGIBILITY',reasonCode:'INACTIVE',theoryAmount:mode==='g1Inactive'?'15':'1.5',entitlementAmount:'0'}));
      expect(first.awards).toHaveLength(expectedAwards.length);expect(first.payables).toEqual([]);
      expect(first.awards.map(row=>[row.awardType,row.payableAmount]).sort()).toEqual(expectedAwards.map(([kind,,amount])=>[kind,amount]).sort());
      for(const secret of [person.personId,event.eventId,qualifications[1].qualificationId,'PRIVATE-REFERRAL-HOLDER','calculationDetail'])expect(JSON.stringify(first)).not.toContain(secret);
      expect(await service.settle(start,end,rule)).toEqual(batch);
      expect(await tx.bonusAward.findMany({where:{settlementBatchId:batch.settlementBatchId},orderBy:{generationNo:'asc'}})).toEqual(awards);
      expect(await tx.bonusCalculationEvidence.findMany({where:{settlementBatchId:batch.settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}})).toEqual(decisions);
      expect(await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:stored.snapshotId}})).toEqual(stored);
      expect(await orderEconomicEvidence(tx,order.orderId,[])).toEqual(first);
      throw new Error(rollback);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(rollback);
  },40000);

  it.each([
    {name:'inactive',active:false,binaryPool:'0.2',matchingPool:'0.2',k1:'1',binaryPaid:'10',matchingTheory:'0.5',matchingPaid:'0.5',k2:'1',inactiveTheory:'1',lockedTheory:'0.2'},
    {name:'full pools',active:true,binaryPool:'0.2',matchingPool:'0.2',k1:'1',binaryPaid:'10',matchingTheory:'0.5',matchingPaid:'0.5',k2:'1',inactiveTheory:'1',lockedTheory:'0.2'},
    {name:'reduced Binary pool',active:true,binaryPool:'0.025',matchingPool:'0.2',k1:'0.5',binaryPaid:'5',matchingTheory:'0.25',matchingPaid:'0.25',k2:'1',inactiveTheory:'0.5',lockedTheory:'0.1'},
    {name:'both pools reduced',active:true,binaryPool:'0.025',matchingPool:'0.000625',k1:'0.5',binaryPaid:'5',matchingTheory:'0.25',matchingPaid:'0.125',k2:'0.5',inactiveTheory:'0.5',lockedTheory:'0.1'},
  ])('preserves Binary and Matching stages: $name',async scenario=>{
    const {active}=scenario;
    const rollback='PERIOD_ELIGIBILITY_ROLLBACK';
    await expect(db.$transaction(async tx=>{
      // A past, isolated calendar avoids current cut-off assumptions and baseline qualifications.
      const start=new Date('1901-01-01T00:00:00Z'),end=new Date('1901-01-08T00:00:00Z');
      const effectiveFrom=new Date('1900-01-01T00:00:00Z'),at=new Date('1901-01-02T00:00:00Z');
      const rule=`TEST_PERIOD_${randomUUID()}`;
      const parameters:Array<[string,string,Prisma.InputJsonValue]>=[
        ['award.pending.days','*','45'],['pool.binary.rate','*',scenario.binaryPool],['binary.pair.rate','*','0.1'],['binary.weekly.cap','STARTER','10000'],
        ['settlement.timezone','BINARY_K1','UTC'],
        ['settlement.period','BINARY_K1',{unit:'WEEK',count:1,anchorLocal:'1901-01-01T00:00:00'}],
        ['settlement.cut_off','BINARY_K1',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_ONLY'}],
        ['pool.matching.rate','*',scenario.matchingPool],['matching.rate','1','0.1'],['matching.rate','2','0.05'],['matching.rate','3','0.02'],
        ['settlement.timezone','MATCHING_K2','UTC'],['settlement.period','MATCHING_K2',{unit:'WEEK',count:1,anchorLocal:'1901-01-01T00:00:00'}],
        ['settlement.cut_off','MATCHING_K2',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_ONLY'}],
        ['pool.global.rate','*','0.05'],['settlement.timezone','GLOBAL','UTC'],
        ['settlement.period','GLOBAL',{unit:'WEEK',count:1,anchorLocal:'1901-01-01T00:00:00'}],
        ['settlement.cut_off','GLOBAL',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_ONLY'}],
      ];
      for(const rank of ['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN']){
        parameters.push(['global.rank.weak_threshold',rank,rank==='NEW_STAR'?'100':'1000']);
        parameters.push(['global.rank.pool_rate',rank,rank==='NEW_STAR'?'0.02':'0.0075']);
      }
      for(const [parameterCode,scopeKey,valueJson] of parameters)await tx.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode,scopeKey,valueJson,effectiveFrom}});
      const person=await tx.person.create({data:{legalName:'PRIVATE-PERIOD-HOLDER'}});
      const makeQualification=async()=>{
        const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:effectiveFrom}});
        await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom,sourceType:'TEST_PERIOD'}});
        await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom,sourceType:'TEST_PERIOD'}});
        return q;
      };
      const root=await makeQualification(),left=await makeQualification(),right=await makeQualification();
      if(active)await tx.activePeriod.create({data:{qualificationId:root.qualificationId,activeFrom:effectiveFrom,activeTo:new Date('1901-02-01T00:00:00Z'),sourceType:'TEST_PERIOD',ruleVersionCode:rule}});
      await tx.binaryPlacement.createMany({data:[
        {parentQualificationId:root.qualificationId,childQualificationId:left.qualificationId,side:'LEFT',effectiveFrom},
        {parentQualificationId:root.qualificationId,childQualificationId:right.qualificationId,side:'RIGHT',effectiveFrom},
      ]});
      const product=await tx.productReference.create({data:{sku:randomUUID(),displayName:'Period fixture',currentPrice:100}});
      const orders=[];
      for(const q of [left,right]){
        const order=await tx.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:rule}});
        const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'Period fixture',quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
        const event=await tx.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode:rule,occurredAt:at,correlationId:randomUUID()}});
        await sealGpvEvent(tx,event);orders.push(order);
      }
      // Keep the real service transaction inside this rollback-only test transaction.
      const proxy=new Proxy(tx,{get(target,key){return key==='$transaction'?(callback:any)=>callback(proxy):Reflect.get(target,key);}}) as any;
      const service=new BinaryBonusService(proxy,new RuntimeRuleService(proxy),new BonusQueryService(proxy),new SettlementCalendarService(proxy));
      await expect(service.settleMatching(start,end,rule)).rejects.toThrow('Binary K1 must be finalized before Matching');
      expect(await tx.settlementBatch.count({where:{ruleVersionCode:rule}})).toBe(0);
      const batch=await service.settleBinary(start,end,rule);
      expect(batch).toMatchObject({status:'FINALIZED'});
      expect(batch.totalGpv.toString()).toBe('200');expect(batch.kFactor.toString()).toBe(scenario.k1);
      const stored=await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:batch.settlementBatchId}}});
      const envelope=verifyReplayEnvelope(stored);
      const decisions=await tx.bonusCalculationEvidence.findMany({where:{settlementBatchId:batch.settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}});
      expect(envelope.evidence.eligibilityEvidence).toEqual(JSON.parse(JSON.stringify(decisions)));
      const rootDecision=decisions.find(row=>row.recipientQualificationId===root.qualificationId);
      if(active)expect(rootDecision).toBeUndefined();
      else{
        expect(rootDecision).toMatchObject({evidenceType:'BINARY_ELIGIBILITY',reasonCode:'INACTIVE',occurredAt:end});
        expect(rootDecision!.theoreticalAmount.toString()).toBe('10');expect(rootDecision!.entitlementAmount.toString()).toBe('0');
      }
      const first=await orderEconomicEvidence(tx,orders[0].orderId,[]),period=first.periodContributions[0];
      expect(period).toMatchObject({kind:'BINARY_K1',orderOriginalGpv:'100',kFactor:scenario.k1,periodContext:{attribution:'WHOLE_PERIOD_NOT_ORDER_ALLOCATION',eligibilityEvidenceStatus:'RECORDED'}});
      expect(period.periodContext.eligibilityDecisions).toHaveLength(active?2:3);
      if(active)expect(period.periodContext.recipients).toEqual([expect.objectContaining({awardType:'BINARY',theoryAmount:'10',originallyPosted:scenario.binaryPaid,active:true})]);
      else{
        expect(period.periodContext.recipients).toEqual([]);
        expect(period.periodContext.eligibilityDecisions).toContainEqual(expect.objectContaining({eligibilityType:'BINARY_ELIGIBILITY',reasonCode:'INACTIVE',theoryAmount:'10',entitlementAmount:'0'}));
      }
      expect(first.awards).toEqual([]);expect(first.payables).toEqual([]);
      for(const secret of [person.personId,root.qualificationId,batch.settlementBatchId,'PRIVATE-PERIOD-HOLDER','calculationDetail'])expect(JSON.stringify(first)).not.toContain(secret);
      expect(await service.settleBinary(start,end,rule)).toEqual(batch);
      expect(await tx.bonusAward.count({where:{settlementBatchId:batch.settlementBatchId}})).toBe(active?1:0);
      expect(await tx.binaryCarry.count({where:{periodEnd:end,ruleVersionCode:rule}})).toBe(3);
      expect(await tx.historicalReplaySnapshot.count({where:{kind:'BINARY_K1',sourceId:batch.settlementBatchId}})).toBe(1);
      expect((await orderEconomicEvidence(tx,orders[1].orderId,[])).periodContributions[0].periodContext).toEqual(period.periodContext);
      // A later Active interval cannot rewrite the sealed historical result.
      await tx.activePeriod.create({data:{qualificationId:root.qualificationId,activeFrom:new Date('1902-01-01T00:00:00Z'),sourceType:'TEST_PERIOD_LATER',ruleVersionCode:rule}});
      expect(await orderEconomicEvidence(tx,orders[0].orderId,[])).toEqual(first);
      expect(await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:stored.snapshotId}})).toEqual(stored);
      expect(await tx.bonusCalculationEvidence.findMany({where:{settlementBatchId:batch.settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}})).toEqual(decisions);
      if(active){
        // Matching captures the sponsor graph at close; Binary source snapshots remain sealed.
        const uplines=[];
        for(let generation=1;generation<=3;generation++){
          const q=await makeQualification();uplines.push(q);
          await tx.sponsorRelationship.create({data:{sponsorQualificationId:q.qualificationId,childQualificationId:generation===1?root.qualificationId:uplines[generation-2].qualificationId,sponsorSequenceNo:1,effectiveFrom}});
          if(generation>1)await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:effectiveFrom,sourceType:'TEST_MATCHING',ruleVersionCode:rule}});
        }
        const sourceAward=await tx.bonusAward.findFirstOrThrow({where:{settlementBatchId:batch.settlementBatchId,awardType:'BINARY'}});
        const matching=await service.settleMatching(start,end,rule);
        expect(matching.status).toBe('FINALIZED');expect(matching.kFactor.toString()).toBe(scenario.k2);expect(sourceAward.payableAmount.toString()).toBe(scenario.binaryPaid);
        const matchingAwards=await tx.bonusAward.findMany({where:{settlementBatchId:matching.settlementBatchId}});
        expect(matchingAwards).toHaveLength(1);
        expect(matchingAwards[0]).toMatchObject({awardType:'MATCHING',sourceAwardId:sourceAward.bonusAwardId,recipientQualificationId:uplines[1].qualificationId,generationNo:2});
        expect(matchingAwards[0].theoryAmount.toString()).toBe(scenario.matchingTheory);expect(matchingAwards[0].payableAmount.toString()).toBe(scenario.matchingPaid);
        const matchingDecisions=await tx.bonusCalculationEvidence.findMany({where:{settlementBatchId:matching.settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}});
        expect(matchingDecisions).toHaveLength(2);
        expect(matchingDecisions.map(row=>[row.reasonCode,row.theoreticalAmount.toString(),row.entitlementAmount.toString()]).sort()).toEqual([['INACTIVE',scenario.inactiveTheory,'0'],['LOCKED',scenario.lockedTheory,'0']]);
        expect(matchingDecisions.every(row=>row.evidenceType==='BINARY_MATCHING_ELIGIBILITY')).toBe(true);
        const matchingSnapshot=await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'MATCHING_K2',sourceId:matching.settlementBatchId}}});
        const matchingEnvelope=verifyReplayEnvelope(matchingSnapshot);
        expect(matchingEnvelope.evidence.eligibilityEvidence).toEqual(JSON.parse(JSON.stringify(matchingDecisions)));
        expect(matchingEnvelope.evidence.matchingSources).toEqual([expect.objectContaining({sourceAwardId:sourceAward.bonusAwardId,sourceQualificationId:root.qualificationId})]);
        const after=await orderEconomicEvidence(tx,orders[0].orderId,[]),matchingContext=after.periodContributions.find(row=>row.kind==='MATCHING_K2')!.periodContext;
        expect(matchingContext.recipients).toEqual([expect.objectContaining({awardType:'MATCHING',theoryAmount:scenario.matchingTheory,originallyPosted:scenario.matchingPaid})]);
        expect(matchingContext.eligibilityDecisions.map((row:any)=>[row.reasonCode,row.theoryAmount,row.entitlementAmount]).sort()).toEqual([['INACTIVE',scenario.inactiveTheory,'0'],['LOCKED',scenario.lockedTheory,'0']]);
        expect(after.periodContributions.find(row=>row.kind==='MATCHING_K2')!.kFactor).toBe(scenario.k2);
        expect(after.awards).toEqual([]);expect(after.payables).toEqual([]);
        for(const secret of [sourceAward.bonusAwardId,...uplines.map(q=>q.qualificationId),matchingAwards[0].bonusAwardId,'sourceBinaryPaid'])expect(JSON.stringify(after)).not.toContain(secret);
        expect(await service.settleMatching(start,end,rule)).toEqual(matching);
        expect(await tx.bonusAward.findMany({where:{settlementBatchId:matching.settlementBatchId}})).toEqual(matchingAwards);
        expect(await tx.bonusCalculationEvidence.findMany({where:{settlementBatchId:matching.settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}})).toEqual(matchingDecisions);
        expect(await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:matchingSnapshot.snapshotId}})).toEqual(matchingSnapshot);
        expect(await orderEconomicEvidence(tx,orders[0].orderId,[])).toEqual(after);
        expect((await orderEconomicEvidence(tx,orders[1].orderId,[])).periodContributions.find(row=>row.kind==='MATCHING_K2')!.periodContext).toEqual(matchingContext);
      }
      if(scenario.name==='inactive'||scenario.name==='full pools'){
        const globalService=new GlobalPoolService(proxy,new RuntimeRuleService(proxy),new BonusQueryService(proxy),new SettlementCalendarService(proxy),new GlobalPoolPersistence());
        const global=await globalService.evaluateAndSettle(start,end,rule);
        expect(global.totalGpv.toString()).toBe('200');expect(global.poolAvailable.toString()).toBe('10');
        expect(global.distributedAmount.toString()).toBe(active?'4':'0');expect(global.undistributedAmount.toString()).toBe(active?'6':'10');
        const globalAwards=await tx.globalPoolAward.findMany({where:{globalPoolSettlementId:global.globalPoolSettlementId}});
        expect(globalAwards).toHaveLength(active?1:0);
        if(active){
          expect(globalAwards[0]).toMatchObject({qualificationId:root.qualificationId,rankLevel:'NEW_STAR',activeSnapshot:true});
          expect(globalAwards[0].weakSidePvSnapshot.toString()).toBe('100');expect(globalAwards[0].payableAmount.toString()).toBe('4');
        }
        const reservoir=await tx.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:global.globalPoolSettlementId}});
        expect(reservoir).toHaveLength(1);expect(reservoir[0].amount.toString()).toBe(active?'6':'10');
        const globalSnapshot=await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'GLOBAL',sourceId:global.globalPoolSettlementId}}});
        expect(verifyReplayEnvelope(globalSnapshot).recipients).toHaveLength(globalAwards.length);
        const final=await orderEconomicEvidence(tx,orders[0].orderId,[]),globalPeriod=final.periodContributions.find(row=>row.kind==='GLOBAL')!;
        expect(globalPeriod).toMatchObject({orderOriginalGpv:'100',kFactor:null,periodContext:{attribution:'WHOLE_PERIOD_NOT_ORDER_ALLOCATION',eligibilityEvidenceStatus:'UNAVAILABLE',eligibilityDecisions:[]}});
        expect(globalPeriod.periodContext.recipients).toEqual(active?[expect.objectContaining({awardType:'GLOBAL',theoryAmount:'4',originallyPosted:'4',active:true})]:[]);
        expect(final.awards).toEqual([]);expect(final.payables).toEqual([]);
        for(const secret of [global.globalPoolSettlementId,globalSnapshot.snapshotId,root.qualificationId,...globalAwards.map(row=>row.globalPoolAwardId)])expect(JSON.stringify(final)).not.toContain(secret);
        expect((await orderEconomicEvidence(tx,orders[1].orderId,[])).periodContributions.find(row=>row.kind==='GLOBAL')!.periodContext).toEqual(globalPeriod.periodContext);
        expect(await globalService.evaluateAndSettle(start,end,rule)).toEqual(global);
        expect(await tx.globalPoolAward.findMany({where:{globalPoolSettlementId:global.globalPoolSettlementId}})).toEqual(globalAwards);
        expect(await tx.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:global.globalPoolSettlementId}})).toEqual(reservoir);
        expect(await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:globalSnapshot.snapshotId}})).toEqual(globalSnapshot);
        expect(await orderEconomicEvidence(tx,orders[0].orderId,[])).toEqual(final);
      }
      throw new Error(rollback);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(rollback);
  },40000);
});
