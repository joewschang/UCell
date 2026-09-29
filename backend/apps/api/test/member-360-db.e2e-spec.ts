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
    const course=await db.learningCourse.create({data:{courseCode:'MEMBER360-LEARN',status:'PUBLISHED',createdByActor:'test'}});
    const version=await db.learningCourseVersion.create({data:{learningCourseId:course.learningCourseId,version:1,title:'Member 360 Learning',categoryCode:'ONBOARDING',contentHash:'a'.repeat(64),status:'PUBLISHED',approvalReference:'test',approvedByActor:'test',approvedAt:new Date()}});
    const enrollment=await db.learningEnrollment.create({data:{learningCourseId:course.learningCourseId,learningCourseVersionId:version.learningCourseVersionId,personId:person.personId,status:'COMPLETED',enrolledAt:new Date(Date.now()-3000),startedAt:new Date(Date.now()-2000),completedAt:new Date(Date.now()-1000)}});
    await db.learningProgressEvent.create({data:{learningEnrollmentId:enrollment.learningEnrollmentId,eventType:'COURSE_COMPLETED',idempotencyKey:'member360-learning',evidenceHash:'b'.repeat(64)}});
    const event=await db.memberEvent.create({data:{eventCode:'MEMBER360-EVENT',status:'PUBLISHED',createdByActor:'test'}});
    const eventVersion=await db.memberEventVersion.create({data:{memberEventId:event.memberEventId,version:1,title:'Member 360 Event',eventType:'ONLINE',startsAt:new Date(Date.now()+60_000),endsAt:new Date(Date.now()+3_600_000),onlineJoinReference:'https://example.test/member360',contentHash:'c'.repeat(64),status:'PUBLISHED',approvalReference:'test',approvedByActor:'test',approvedAt:new Date()}});
    await db.memberEventRegistration.create({data:{memberEventId:event.memberEventId,memberEventVersionId:eventVersion.memberEventVersionId,personId:person.personId,status:'CHECKED_IN',checkInTokenHash:'d'.repeat(64),checkedInAt:new Date()}});
    const read=await new AdminOperationsService(db as any,new AuditService()).member360(person.memberNo);
    expect(read.member).toMatchObject({memberNo:person.memberNo,legalName:'Member 360 Subject'});
    expect(read.lineLinks).toEqual([expect.objectContaining({provider:'LINE',status:'ACTIVE'})]);
    expect(read.qualifications).toEqual([expect.objectContaining({qualificationNo:qualification.qualificationNo.toString(),ballNo:null,active:true})]);
    expect(read.tasks).toEqual([expect.objectContaining({taskCode:'MANUAL_FOLLOW_UP'})]);
    expect(read.timeline).toEqual([expect.objectContaining({action:'QUALIFICATION_EFFECTIVE'})]);
    expect(read.learning).toEqual([expect.objectContaining({courseCode:'MEMBER360-LEARN',status:'COMPLETED'})]);
    expect(read.events).toEqual([expect.objectContaining({eventCode:'MEMBER360-EVENT',status:'CHECKED_IN'})]);
    const payload=JSON.stringify(read);
    expect(payload).not.toContain(person.personId);
    expect(payload).not.toContain(qualification.qualificationId);
    expect(payload).not.toContain('line-member-360');
  });
});
