import {PrismaClient} from '@prisma/client';
import {erpBusinessReference} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {OperationsFinancialHealthService} from '../src/modules/admin-operations/operations-financial-health.service';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';
import {AuditService} from '../src/common/audit/audit.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('OPERATIONS_FINANCIAL_HEALTH_REAL_DB',()=>{
 let db:PrismaClient,service:OperationsFinancialHealthService,ops:AdminOperationsService;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new OperationsFinancialHealthService(db as any);ops=new AdminOperationsService(db as any,new AuditService());});afterAll(()=>db?.$disconnect());
 async function fixture(){
  const rule='OPS-FIN-'+randomUUID(),person=await db.person.create({data:{legalName:'PRIVATE FINANCIAL NAME'}}),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}}),at=new Date('1889-01-01Z');
  const bonus=await db.bonusAward.create({data:{recipientQualificationId:q.qualificationId,awardType:'REFERRAL',sourceEventId:randomUUID(),theoryAmount:100,payableAmount:100,activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode:rule,parameterSnapshotHash:'a'.repeat(64),occurredAt:at,pendingUntil:at,calculationDetail:{private:'PRIVATE CALCULATION'}}});await db.bonusAwardLifecycleEvent.create({data:{bonusAwardId:bonus.bonusAwardId,status:'EFFECTIVE',occurredAt:at}});
  const payable=new UnifiedPayableService(db as any,new RecoveryBalanceService(db as any));
  return {rule,person,q,bonus,at,payable};
 }
 const read=(scope:string,id:string)=>service.list({scope,reference:erpBusinessReference(scope,id)}).then(page=>page.items[0]);
 it('covers Bonus, RPV and Global sources and detects missing, foreign-rule, amount and payout links independently',async()=>{
  const f=await fixture(),plan=await db.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Synthetic monitor RPV',durationMonths:1,prepaidAmount:100,productBoxQty:1,monthlyRecognizedAmount:100,monthlyRpv:1}}),subscription=await db.subscription.create({data:{qualificationId:f.q.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:f.at,endMonth:f.at,ruleVersionCode:f.rule}}),recognition=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:f.at,dueAt:f.at,recognizedAt:f.at,status:'RECOGNIZED',recognizedAmount:100,rpvAmount:1,ruleVersionCode:f.rule}}),rpv=await db.rpvUplineAwardEvent.create({data:{recognitionId:recognition.recognitionId,sourceQualificationId:f.q.qualificationId,recipientQualificationId:f.q.qualificationId,binaryGeneration:1,effectiveDirectCountSnapshot:1,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:30,payableAmount:30,ruleVersionCode:f.rule,occurredAt:f.at}}),settlement=await db.globalPoolSettlement.create({data:{periodStart:f.at,periodEnd:new Date('1889-02-01Z'),totalGpv:100,poolRate:0.1,poolAvailable:10,distributedAmount:10,undistributedAmount:0,ruleVersionCode:f.rule}}),global=await db.globalPoolAward.create({data:{globalPoolSettlementId:settlement.globalPoolSettlementId,qualificationId:f.q.qualificationId,rankLevel:'NEW_STAR',rankPoolRate:1,rankPoolAmount:10,eligibleCount:1,payableAmount:10,weakSidePvSnapshot:100,activeSnapshot:true}});
  await f.payable.materialize(new Date('1889-03-01Z'),f.rule);
  for(const [type,id] of [['BONUS_AWARD',f.bonus.bonusAwardId],['RPV_UPLINE_AWARD',rpv.rpvAwardEventId],['GLOBAL_POOL_AWARD',global.globalPoolAwardId]]){
   const p=await db.payableEntry.findUniqueOrThrow({where:{sourceType_sourceId:{sourceType:type,sourceId:id}}});expect((await read('PAYABLE',p.payableEntryId)).candidates).toEqual([]);
   await db.payableEntry.update({where:{payableEntryId:p.payableEntryId},data:{grossAmount:999,ruleVersionCode:'WRONG_RULE',status:'PAID',availableAt:new Date('1888-01-01Z')}});const broken=await read('PAYABLE',p.payableEntryId);expect(broken.candidates.map(row=>row.code)).toEqual(expect.arrayContaining(['PAYABLE_SOURCE_MISMATCH','PAYABLE_PAYOUT_LINK_MISMATCH','PAYABLE_MATURITY_EVIDENCE_MISSING']));
   const missing=await db.payableEntry.create({data:{qualificationId:f.q.qualificationId,sourceType:type,sourceId:randomUUID(),awardType:p.awardType,grossAmount:5,availableAt:f.at,ruleVersionCode:f.rule}});expect((await read('PAYABLE',missing.payableEntryId)).candidates.map(row=>row.code)).toContain('PAYABLE_SOURCE_MISSING');
  }
 });
 it('tracks real failed→partial→fully confirmed bank evidence without cumulative double counting and resolves the exact public payout link',async()=>{
  const f=await fixture();await f.payable.materialize(new Date('1889-03-01Z'),f.rule);const batch=await f.payable.createPayoutBatch(f.at,new Date('1889-03-01Z'),f.rule),line=await db.payoutLine.findFirstOrThrow({where:{payoutBatchId:batch.payoutBatchId}});
  expect((await read('PAYOUT',batch.payoutBatchId)).candidates).toEqual([]);
  await ops.approvePayout(batch.payoutBatchId,'FINANCE_REVIEW',randomUUID(),'FINANCE',undefined,randomUUID(),randomUUID());await ops.approvePayout(batch.payoutBatchId,'COMPLIANCE_REVIEW',randomUUID(),'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());await ops.exportPayout(batch.payoutBatchId,'OPS-EXPORT-'+randomUUID(),randomUUID(),'FINANCE',randomUUID(),randomUUID());
  const post=(status:'FAILED'|'PAID',paidAmount:string)=>ops.recordPayoutResults(batch.payoutBatchId,{results:[{payoutLineId:line.payoutLineId,status,paidAmount,paymentReference:'PRIVATE BANK REFERENCE',reasonCode:status==='FAILED'?'BANK_REJECTED':undefined}]},randomUUID(),'FINANCE',randomUUID(),randomUUID());
  await post('FAILED','0');expect((await read('PAYOUT',batch.payoutBatchId)).evidence).toMatchObject({bankFailedLines:1,bankUnreconciledLines:1,bankConfirmed:'0.0000'});
  await post('PAID','40');expect((await read('PAYOUT',batch.payoutBatchId)).evidence).toMatchObject({bankFailedLines:0,bankUnreconciledLines:1,bankConfirmed:'40.0000'});
  await post('PAID','100');const paid=await read('PAYOUT',batch.payoutBatchId);expect(paid.evidence).toMatchObject({bankFailedLines:0,bankUnreconciledLines:0,bankConfirmed:'100.0000',amountScope:'WHOLE_PAYOUT_BATCH'});expect(paid.candidates).toEqual([]);
  for(const hidden of [f.person.personId,f.person.legalName,f.q.qualificationId,batch.payoutBatchId,line.payoutLineId,'PRIVATE BANK REFERENCE','PRIVATE CALCULATION'])expect(JSON.stringify(paid)).not.toContain(hidden);
  expect((await ops.payoutBatchDetail(paid.reference)).payoutBatchId).toBe(batch.payoutBatchId);expect(paid.actionLink).toBe('/payouts?reference='+paid.reference);
 });
 it('requires a real bank acknowledgement for a fully offset zero-net batch and reconciles its recovery applications',async()=>{
  const f=await fixture(),recovery=await db.bonusRecoveryEvent.create({data:{bonusAwardId:f.bonus.bonusAwardId,recoveryAmount:100,outstandingAmount:100,reasonCode:'OPS-TEST',occurredAt:f.at}});expect((await read('RECOVERY',recovery.bonusRecoveryEventId)).candidates.map(row=>row.code)).toEqual(['RECOVERY_OUTSTANDING']);
  await f.payable.materialize(new Date('1889-03-01Z'),f.rule);const batch=await f.payable.createPayoutBatch(f.at,new Date('1889-03-01Z'),f.rule),line=await db.payoutLine.findFirstOrThrow({where:{payoutBatchId:batch.payoutBatchId}});expect(line.netAmount.toString()).toBe('0');expect((await read('RECOVERY',recovery.bonusRecoveryEventId)).candidates).toEqual([]);
  await ops.approvePayout(batch.payoutBatchId,'FINANCE_REVIEW',randomUUID(),'FINANCE',undefined,randomUUID(),randomUUID());await ops.approvePayout(batch.payoutBatchId,'COMPLIANCE_REVIEW',randomUUID(),'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());await ops.exportPayout(batch.payoutBatchId,'OPS-ZERO-'+randomUUID(),randomUUID(),'FINANCE',randomUUID(),randomUUID());
  expect((await read('PAYOUT',batch.payoutBatchId)).evidence.bankUnreconciledLines).toBe(1);await ops.recordPayoutResults(batch.payoutBatchId,{results:[{payoutLineId:line.payoutLineId,status:'PAID',paidAmount:'0',paymentReference:'ZERO-CONFIRMED'}]},randomUUID(),'FINANCE',randomUUID(),randomUUID());expect((await read('PAYOUT',batch.payoutBatchId)).candidates).toEqual([]);
 });
 it('paginates past healthy rows, preserves the admission horizon and avoids same-period reference collisions',async()=>{
  const first=await db.payoutBatch.create({data:{periodStart:new Date('1888-01-01Z'),periodEnd:new Date('1888-02-01Z')}}),page=await service.list({scope:'PAYOUT',take:1}),next=await db.payoutBatch.create({data:{periodStart:first.periodStart,periodEnd:first.periodEnd,totalNet:1}});
  expect(page.items[0].reference).toBe(erpBusinessReference('PAYOUT',first.payoutBatchId));expect(page.items[0].candidates).toEqual([]);expect(page.nextCursor).toBeTruthy();const after=await service.list({scope:'PAYOUT',take:100,cursor:page.nextCursor!,asOf:page.asOf});expect(after.items.some(row=>row.reference===erpBusinessReference('PAYOUT',next.payoutBatchId))).toBe(false);
  const broken=await read('PAYOUT',next.payoutBatchId);expect(broken.reference).not.toBe(page.items[0].reference);expect(broken.candidates.map(row=>row.code)).toContain('PAYOUT_BATCH_TOTAL_MISMATCH');await expect(service.list({scope:'PAYOUT',take:101})).rejects.toThrow();
 });
});
