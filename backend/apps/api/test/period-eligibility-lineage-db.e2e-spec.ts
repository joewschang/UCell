import {PrismaClient,Prisma} from '@prisma/client';
import {sealGpvEvent,verifyReplayEnvelope} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {BinaryBonusService} from '../src/modules/bonus/binary-bonus.service';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {RuntimeRuleService} from '../src/modules/rules/runtime-rule.service';
import {SettlementCalendarService} from '../src/modules/settlement/settlement-calendar.service';
import {orderEconomicEvidence} from '../src/modules/admin-operations/order-economic-evidence';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('sealed Binary eligibility writer-to-order lineage',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());

  it.each([false,true])('preserves historical Active=%s through actual settlement, sealing and read',async active=>{
    const rollback='PERIOD_ELIGIBILITY_ROLLBACK';
    await expect(db.$transaction(async tx=>{
      // A past, isolated calendar avoids current cut-off assumptions and baseline qualifications.
      const start=new Date('1901-01-01T00:00:00Z'),end=new Date('1901-01-08T00:00:00Z');
      const effectiveFrom=new Date('1900-01-01T00:00:00Z'),at=new Date('1901-01-02T00:00:00Z');
      const rule=`TEST_PERIOD_${randomUUID()}`;
      const parameters:Array<[string,string,Prisma.InputJsonValue]>=[
        ['award.pending.days','*','45'],['pool.binary.rate','*','0.2'],['binary.pair.rate','*','0.1'],['binary.weekly.cap','STARTER','10000'],
        ['settlement.timezone','BINARY_K1','UTC'],
        ['settlement.period','BINARY_K1',{unit:'WEEK',count:1,anchorLocal:'1901-01-01T00:00:00'}],
        ['settlement.cut_off','BINARY_K1',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_ONLY'}],
      ];
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
      const batch=await service.settleBinary(start,end,rule);
      expect(batch).toMatchObject({status:'FINALIZED'});
      expect(batch.totalGpv.toString()).toBe('200');
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
      expect(period).toMatchObject({kind:'BINARY_K1',orderOriginalGpv:'100',periodContext:{attribution:'WHOLE_PERIOD_NOT_ORDER_ALLOCATION',eligibilityEvidenceStatus:'RECORDED'}});
      expect(period.periodContext.eligibilityDecisions).toHaveLength(active?2:3);
      if(active)expect(period.periodContext.recipients).toEqual([expect.objectContaining({awardType:'BINARY',theoryAmount:'10',originallyPosted:'10',active:true})]);
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
      throw new Error(rollback);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(rollback);
  },40000);
});
