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
});
