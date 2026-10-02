import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Payable materialization source boundaries',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db?.$disconnect());
 it.each([['GLOBAL','other-rule'],['GLOBAL','future'],['RPV','other-rule'],['RPV','future']] as const)('%s excludes %s sources and preserves the exact cutoff boundary',async(kind,fault)=>{
  const marker='PAYABLE_BOUNDARY_ROLLBACK';
  await expect(db.$transaction(async tx=>{
   const proxy=new Proxy(tx,{get(target,key){return key==='$transaction'?(work:any)=>work(proxy):Reflect.get(target,key);}}) as any;
   const rule='TEST_PAYABLE_'+randomUUID(),cutoff=new Date('1906-01-10T00:00:00Z');
   const person=await tx.person.create({data:{legalName:'Synthetic payable boundary'}});
   const qualification=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
   async function source(version:string,at:Date){
    if(kind==='RPV'){
     const plan=await tx.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Synthetic payable RPV',durationMonths:1,prepaidAmount:100,productBoxQty:1,monthlyRecognizedAmount:100,monthlyRpv:1}});
     const subscription=await tx.subscription.create({data:{qualificationId:qualification.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:new Date('1906-01-01'),endMonth:new Date('1906-01-01'),ruleVersionCode:version}});
     const recognition=await tx.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:new Date('1906-01-01'),dueAt:at,recognizedAt:at,status:'RECOGNIZED',recognizedAmount:100,rpvAmount:1,ruleVersionCode:version}});
     const award=await tx.rpvUplineAwardEvent.create({data:{recognitionId:recognition.recognitionId,sourceQualificationId:qualification.qualificationId,recipientQualificationId:qualification.qualificationId,binaryGeneration:1,effectiveDirectCountSnapshot:1,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:5,payableAmount:5,ruleVersionCode:version,occurredAt:at}});
     return award.rpvAwardEventId;
    }
    const settlement=await tx.globalPoolSettlement.create({data:{periodStart:new Date(at.getTime()-86400000),periodEnd:at,totalGpv:100,poolRate:0.05,poolAvailable:5,distributedAmount:5,undistributedAmount:0,ruleVersionCode:version}});
    const award=await tx.globalPoolAward.create({data:{globalPoolSettlementId:settlement.globalPoolSettlementId,qualificationId:qualification.qualificationId,rankLevel:'NEW_STAR',rankPoolRate:0.05,rankPoolAmount:5,eligibleCount:1,payableAmount:5,weakSidePvSnapshot:100,activeSnapshot:true}});
    return award.globalPoolAwardId;
   }
   const valid=await source(rule,cutoff),excluded=await source(fault==='other-rule'?rule+'_OTHER':rule,fault==='future'?new Date(cutoff.getTime()+1):cutoff);
   const service=new UnifiedPayableService(proxy,new RecoveryBalanceService(proxy));
   await service.materialize(cutoff,rule);
   const entries=await tx.payableEntry.findMany({where:{qualificationId:qualification.qualificationId}});
   expect(entries).toHaveLength(1);
   expect(entries[0]).toMatchObject({sourceId:valid,ruleVersionCode:rule,availableAt:cutoff});
   expect(await tx.payableEntry.count({where:{sourceId:excluded}})).toBe(0);
   await service.materialize(cutoff,rule);
   expect(await tx.payableEntry.findMany({where:{qualificationId:qualification.qualificationId}})).toEqual(entries);
   throw new Error(marker);
  },{timeout:30000})).rejects.toThrow(marker);
 },40000);
});
