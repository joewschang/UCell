import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {EpvService} from '../src/modules/epv/epv.service';
import {EpvMonthService} from '../src/modules/epv/epv-month.service';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {RuntimeRuleService} from '../src/modules/rules/runtime-rule.service';
import {orderEconomicEvidence} from '../src/modules/admin-operations/order-economic-evidence';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('EPV required writer-to-lineage acceptance',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db?.$disconnect());
 it('EPV_ORDER_TO_SELF_AWARD_LINEAGE / EPV_TO_SPONSOR_UPLINE_AWARD_LINEAGE preserve historical self and Sponsor awards',async()=>{
  const marker='EPV_LINEAGE_ROLLBACK';
  await expect(db.$transaction(async tx=>{
   const proxy=new Proxy(tx,{get(target,key){return key==='$transaction'?(work:any)=>work(proxy):Reflect.get(target,key);}}) as any;
   const rule='TEST_EPV_LINEAGE_'+randomUUID(),at=new Date('2020-01-05'),from=new Date('2020-01-01');
   const parameters=await tx.runtimeRuleParameter.findMany({where:{ruleVersionCode:'R1.0B'},orderBy:{effectiveFrom:'asc'}});
   for(const row of new Map(parameters.map(row=>[JSON.stringify([row.parameterCode,row.scopeKey]),row])).values()){
    await tx.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode:row.parameterCode,scopeKey:row.scopeKey,valueJson:['epv.calendar.timezone','accounting.timezone'].includes(row.parameterCode)?'UTC':row.valueJson!,effectiveFrom:new Date('2019-01-01')}});
   }
   const person=await tx.person.create({data:{legalName:'PRIVATE-EPV-LINEAGE'}});
   async function qualification(){
    const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:from}});
    await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:from,sourceType:'TEST'}});
    await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:from,sourceType:'TEST'}});
    await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:from,sourceType:'TEST',ruleVersionCode:rule}});
    return q;
   }
   const self=await qualification(),sponsor=await qualification(),replacement=await qualification();
   const edge=await tx.sponsorRelationship.create({data:{childQualificationId:self.qualificationId,sponsorQualificationId:sponsor.qualificationId,sponsorSequenceNo:1,effectiveFrom:from}});
   const product=await tx.productReference.create({data:{sku:randomUUID(),displayName:'Synthetic EPV',currentPrice:1600}});
   const order=await tx.order.create({data:{qualificationId:self.qualificationId,purpose:'REPURCHASE',status:'PAID',paidAt:at,grossAmount:4800,netAmount:4800,ruleVersionCode:rule,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:3,unitPrice:1600,lineAmount:4800,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{testOnly:true}}}}});
   const service=new EpvService(proxy,new RuntimeRuleService(proxy),new BonusQueryService(proxy),new EpvMonthService());
   expect(await service.recognizeOrder(order.orderId,rule)).toMatchObject({epv:'1680'});
   const awards=await tx.bonusAward.findMany({where:{sourceQualificationId:self.qualificationId,awardType:'EPV'},orderBy:{generationNo:'asc'}});
   expect(awards.map(row=>[row.recipientQualificationId,row.payableAmount.toString()])).toEqual([[self.qualificationId,'840'],[sponsor.qualificationId,'100.8']]);
   const before=await orderEconomicEvidence(tx,order.orderId,[]);
   expect(before.pvEvents).toEqual([expect.objectContaining({pvType:'EPV',amount:'1680'})]);
   expect(before.awards.map(row=>row.payableAmount).sort()).toEqual(['100.8','840']);
   for(const award of before.awards)expect(award).toMatchObject({awardType:'EPV',sourcePvReference:before.pvEvents[0].reference,activeAtRecognition:true});
   await tx.sponsorRelationship.update({where:{sponsorRelationshipId:edge.sponsorRelationshipId},data:{effectiveTo:new Date('2020-01-06')}});
   await tx.sponsorRelationship.update({where:{sponsorRelationshipId:edge.sponsorRelationshipId},data:{sponsorQualificationId:replacement.qualificationId,effectiveFrom:new Date('2020-01-06'),effectiveTo:null}});
   await tx.activePeriod.updateMany({where:{qualificationId:{in:[self.qualificationId,sponsor.qualificationId]}},data:{activeTo:new Date('2020-01-06')}});
   expect(await orderEconomicEvidence(tx,order.orderId,[])).toEqual(before);
   expect(await service.recognizeOrder(order.orderId,rule)).toMatchObject({skipped:'ALREADY_RECOGNIZED'});
   expect(await tx.bonusAward.findMany({where:{sourceQualificationId:self.qualificationId,awardType:'EPV'},orderBy:{generationNo:'asc'}})).toEqual(awards);
   for(const secret of [person.personId,self.qualificationId,sponsor.qualificationId,order.orderId,'PRIVATE-EPV-LINEAGE',...awards.map(row=>row.bonusAwardId)])expect(JSON.stringify(before)).not.toContain(secret);
   throw new Error(marker);
  },{timeout:30000})).rejects.toThrow(marker);
 },40000);
});
