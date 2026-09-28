import {PrismaClient,Prisma} from '@prisma/client';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('PAYOUT_EXPORT_ARTIFACT_REVISION',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());
  it('creates one immutable revision-one artifact and safely replays its export reference',async()=>{
    const person=await db.person.create({data:{legalName:'Payout Export Recipient'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
    const batch=await db.payoutBatch.create({data:{periodStart:new Date('2026-09-01T00:00:00Z'),periodEnd:new Date('2026-09-30T00:00:00Z'),status:'READY',totalGross:new Prisma.Decimal(100),totalRecovery:new Prisma.Decimal(0),totalNet:new Prisma.Decimal(100)}});
    await db.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:qualification.qualificationId,grossAmount:new Prisma.Decimal(100),netAmount:new Prisma.Decimal(100),detailJson:{source:'isolated-test'}}});
    await db.payoutApproval.createMany({data:[
      {payoutBatchId:batch.payoutBatchId,stage:'FINANCE_REVIEW',decision:'APPROVED',actorId:'00000000-0000-0000-0000-000000000101'},
      {payoutBatchId:batch.payoutBatchId,stage:'COMPLIANCE_REVIEW',decision:'APPROVED',actorId:'00000000-0000-0000-0000-000000000102'},
    ]});
    const service=new AdminOperationsService(db as any,new AuditService());
    const first=await service.exportPayout(batch.payoutBatchId,'PAYOUT-EXPORT-REVISION-1','00000000-0000-0000-0000-000000000101','FINANCE','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000202');
    expect(first.replayed).toBe(false);
    expect(first.artifact.revision).toBe(1);
    expect(first.artifact.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(first.artifact.payloadSnapshot)).not.toMatch(/bank|account/i);
    const replay=await service.exportPayout(batch.payoutBatchId,'PAYOUT-EXPORT-REVISION-1','00000000-0000-0000-0000-000000000101','FINANCE','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000204');
    expect(replay.replayed).toBe(true);
    expect(replay.artifact.payoutExportArtifactId).toBe(first.artifact.payoutExportArtifactId);
    expect(await db.payoutExportArtifact.count({where:{payoutBatchId:batch.payoutBatchId}})).toBe(1);
    const saved=await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:batch.payoutBatchId}});
    expect(saved.status).toBe('EXPORTED');
    expect(saved.paidAt).toBeNull();
  });
});
