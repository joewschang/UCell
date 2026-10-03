import {PrismaClient} from '@prisma/client';
import {erpBusinessReference} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {MaturedPayableSourcesService} from '../src/modules/admin-operations/matured-payable-sources.service';
import {CompensationPeriodControlService} from '../src/modules/settlement-jobs/compensation-period-control.service';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('MATURED_PAYABLE_SOURCES_REAL_DB',()=>{
 let db:PrismaClient,service:MaturedPayableSourcesService;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new MaturedPayableSourcesService(db as any);});afterAll(()=>db?.$disconnect());
 async function fixture(){
  const rule='OPS-FIN-'+randomUUID(),person=await db.person.create({data:{legalName:'PRIVATE FINANCIAL NAME'}}),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}}),at=new Date('1889-01-01Z');
  const bonus=await db.bonusAward.create({data:{recipientQualificationId:q.qualificationId,awardType:'REFERRAL',sourceEventId:randomUUID(),theoryAmount:100,payableAmount:100,activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode:rule,parameterSnapshotHash:'a'.repeat(64),occurredAt:at,pendingUntil:at,calculationDetail:{private:'PRIVATE CALCULATION'}}});await db.bonusAwardLifecycleEvent.create({data:{bonusAwardId:bonus.bonusAwardId,status:'EFFECTIVE',occurredAt:at}});
  const payable=new UnifiedPayableService(db as any,new RecoveryBalanceService(db as any));
  return {rule,person,q,bonus,at,payable};
 }

 it('pages three real sources, matches aging and rechecks current materialization',async()=>{
  const f=await fixture(),plan=await db.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Synthetic monitor RPV',durationMonths:1,prepaidAmount:100,productBoxQty:1,monthlyRecognizedAmount:100,monthlyRpv:1}}),subscription=await db.subscription.create({data:{qualificationId:f.q.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:f.at,endMonth:f.at,ruleVersionCode:f.rule}}),recognition=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:f.at,dueAt:f.at,recognizedAt:f.at,status:'RECOGNIZED',recognizedAmount:100,rpvAmount:1,ruleVersionCode:f.rule}}),rpv=await db.rpvUplineAwardEvent.create({data:{recognitionId:recognition.recognitionId,sourceQualificationId:f.q.qualificationId,recipientQualificationId:f.q.qualificationId,binaryGeneration:1,effectiveDirectCountSnapshot:1,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:30,payableAmount:30,ruleVersionCode:f.rule,occurredAt:f.at}}),settlement=await db.globalPoolSettlement.create({data:{periodStart:f.at,periodEnd:new Date('1889-02-01Z'),totalGpv:100,poolRate:0.1,poolAvailable:10,distributedAmount:10,undistributedAmount:0,ruleVersionCode:f.rule}}),global=await db.globalPoolAward.create({data:{globalPoolSettlementId:settlement.globalPoolSettlementId,qualificationId:f.q.qualificationId,rankLevel:'NEW_STAR',rankPoolRate:1,rankPoolAmount:10,eligibleCount:1,payableAmount:10,weakSidePvSnapshot:100,activeSnapshot:true}});
 const first=await service.list({thresholdHours:24,take:1});const all=[...first.items];let page=first;
 while(page.nextCursor){page=await service.list({thresholdHours:24,take:1,cursor:page.nextCursor,asOf:first.asOf});all.push(...page.items);}
 expect(all).toHaveLength(3);expect(all.map(r=>r.sourceType).sort()).toEqual(['BONUS_AWARD','GLOBAL_POOL_AWARD','RPV_UPLINE_AWARD']);
 expect(all.find(r=>r.sourceType==='BONUS_AWARD')).toMatchObject({amount:'100.0000',qualificationNo:f.q.qualificationNo.toString(),reference:erpBusinessReference('MATURED-AWARD','BONUS_AWARD:'+f.bonus.bonusAwardId)});
 const aging=await new CompensationPeriodControlService(db as any).aging({thresholdHours:24,asOf:first.asOf});expect(aging.items.find(r=>r.category==='MATURED_AWARD_NOT_PAYABLE')).toMatchObject({count:3,amount:'140.0000'});
 for(const hidden of [f.person.personId,f.q.qualificationId,f.bonus.bonusAwardId,rpv.rpvAwardEventId,global.globalPoolAwardId,'PRIVATE FINANCIAL NAME','PRIVATE CALCULATION'])expect(JSON.stringify(all)).not.toContain(hidden);
 expect((await service.list({thresholdHours:24,asOf:'1889-03-01T00:00:00Z'})).items).toEqual([]);
 await f.payable.materialize(new Date('1889-03-01Z'),f.rule);expect((await service.list({thresholdHours:24,asOf:first.asOf})).items).toEqual([]);
 });
 it('rejects invalid thresholds, unsafe cursors and future horizons',async()=>{for(const input of [{thresholdHours:0},{thresholdHours:1,take:101},{thresholdHours:1,cursor:randomUUID()},{thresholdHours:1,asOf:'2999-01-01T00:00:00Z'}])await expect(service.list(input)).rejects.toThrow();});
});