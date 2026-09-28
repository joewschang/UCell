import {PrismaClient} from '@prisma/client';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;

describeDb('ADMIN_MEMBER_360_REAL_DB',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());

  it('composes protected member facts by business memberNo without returning internal identifiers',async()=>{
    const person=await db.person.create({data:{legalName:'Member 360 Subject',preferredName:'360',status:'EFFECTIVE'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',activeFlag:true,effectiveAt:new Date()}});
    await db.identityLink.create({data:{personId:person.personId,provider:'LINE',providerSubject:'line-member-360',status:'ACTIVE'}});
    await db.auditEvent.create({data:{actorType:'SYSTEM',action:'QUALIFICATION_EFFECTIVE',entityType:'Qualification',entityId:qualification.qualificationId,requestId:'member-360-test',correlationId:'00000000-0000-0000-0000-000000000601'}});
    await db.operationalTask.create({data:{sourceType:'MEMBER',sourceId:person.memberNo,taskCode:'MANUAL_FOLLOW_UP',summary:'會員後續聯繫'}});
    const read=await new AdminOperationsService(db as any,new AuditService()).member360(person.memberNo);
    expect(read.member).toMatchObject({memberNo:person.memberNo,legalName:'Member 360 Subject'});
    expect(read.lineLinks).toEqual([expect.objectContaining({provider:'LINE',status:'ACTIVE'})]);
    expect(read.qualifications).toEqual([expect.objectContaining({qualificationNo:qualification.qualificationNo.toString(),ballNo:null,active:true})]);
    expect(read.tasks).toEqual([expect.objectContaining({taskCode:'MANUAL_FOLLOW_UP'})]);
    expect(read.timeline).toEqual([expect.objectContaining({action:'QUALIFICATION_EFFECTIVE'})]);
    const payload=JSON.stringify(read);
    expect(payload).not.toContain(person.personId);
    expect(payload).not.toContain(qualification.qualificationId);
    expect(payload).not.toContain('line-member-360');
  });
});
