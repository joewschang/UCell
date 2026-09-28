import {PrismaClient,Prisma} from '@prisma/client';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;

describeDb('OPERATIONAL_INVARIANT_REAL_DB',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());

  it('reports a payout total mismatch as a deterministic read-only candidate',async()=>{
    const person=await db.person.create({data:{legalName:'Invariant Recipient'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
    const batch=await db.payoutBatch.create({data:{periodStart:new Date('2026-11-01T00:00:00Z'),periodEnd:new Date('2026-11-30T00:00:00Z'),status:'READY',totalGross:new Prisma.Decimal(100),totalRecovery:new Prisma.Decimal(0),totalNet:new Prisma.Decimal(100)}});
    await db.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:qualification.qualificationId,grossAmount:new Prisma.Decimal(90),netAmount:new Prisma.Decimal(90),detailJson:{source:'invariant-test'}}});
    const monitor=new AdminOperationsService(db as any,new AuditService());
    const first=await monitor.invariantCandidates();
    const second=await monitor.invariantCandidates();
    expect(first).toEqual(second);
    expect(first).toContainEqual(expect.objectContaining({code:'PAYOUT_BATCH_TOTAL_MISMATCH',severity:'CRITICAL',reference:'PAYOUT:2026-11-01:2026-11-30',detail:{declaredTotalNet:'100',lineNetTotal:'90',status:'READY'}}));
    expect(JSON.stringify(first)).not.toContain(batch.payoutBatchId);
    expect(await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:batch.payoutBatchId}})).toMatchObject({totalNet:new Prisma.Decimal(100),status:'READY'});
  });

  it('reports a BONUS_AWARD payable whose immutable award source is missing without changing payable state',async()=>{
    const person=await db.person.create({data:{legalName:'Missing Award Recipient'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
    const missingAwardId='00000000-0000-0000-0000-000000000777';
    const payable=await db.payableEntry.create({data:{qualificationId:qualification.qualificationId,sourceType:'BONUS_AWARD',sourceId:missingAwardId,awardType:'REFERRAL',grossAmount:new Prisma.Decimal(17),availableAt:new Date(),ruleVersionCode:'R1'}});
    const candidates=await new AdminOperationsService(db as any,new AuditService()).invariantCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({code:'PAYABLE_AWARD_SOURCE_MISSING',severity:'CRITICAL',reference:`QUALIFICATION:${qualification.qualificationNo.toString()}:PAYABLE_AWARD`,detail:expect.objectContaining({sourceType:'BONUS_AWARD',grossAmount:'17'})}));
    expect(JSON.stringify(candidates)).not.toContain(payable.payableEntryId);
    expect(await db.payableEntry.findUniqueOrThrow({where:{payableEntryId:payable.payableEntryId}})).toMatchObject({status:'OPEN',grossAmount:new Prisma.Decimal(17)});
  });

  it('reports overdue recognition as a privacy-safe read-only candidate',async()=>{
    const person=await db.person.create({data:{legalName:'Overdue Recognition Holder'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
    const plan=await db.subscriptionPlan.create({data:{planCode:`OVERDUE-${Date.now()}`,displayName:'Overdue invariant plan',durationMonths:3,prepaidAmount:new Prisma.Decimal(300),productBoxQty:2,monthlyRecognizedAmount:new Prisma.Decimal(100),monthlyRpv:new Prisma.Decimal(10)}});
    const subscription=await db.subscription.create({data:{qualificationId:qualification.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:new Date('2026-01-01'),endMonth:new Date('2026-03-01'),ruleVersionCode:'R1.0B'}});
    const schedule=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:new Date('2026-01-01'),recognizedAmount:new Prisma.Decimal(100),rpvAmount:new Prisma.Decimal(10),dueAt:new Date('2026-01-03'),ruleVersionCode:'R1.0B'}});
    const candidates=await new AdminOperationsService(db as any,new AuditService()).invariantCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({code:'OVERDUE_RECOGNITION',severity:'HIGH',reference:`QUALIFICATION:${qualification.qualificationNo.toString()}:RECOGNITION:2026-01-03`,detail:expect.objectContaining({status:'SCHEDULED',installmentNo:1,ruleVersionCode:'R1.0B'})}));
    expect(JSON.stringify(candidates)).not.toContain(schedule.recognitionId);
    expect(await db.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:schedule.recognitionId}})).toMatchObject({status:'SCHEDULED'});
  });
});
