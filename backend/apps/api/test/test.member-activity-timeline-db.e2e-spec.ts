import {PrismaClient} from '@prisma/client';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;

describeDb('ADMIN_MEMBER_ACTIVITY_TIMELINE_REAL_DB',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());

  it('rebuilds a memberNo-safe timeline from source facts without a shadow record',async()=>{
    const person=await db.person.create({data:{legalName:'Timeline Subject',preferredName:'Timeline',status:'EFFECTIVE'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',activeFlag:true,effectiveAt:new Date()}});
    await db.auditEvent.create({data:{actorType:'SYSTEM',action:'QUALIFICATION_EFFECTIVE',eventCode:'QUALIFICATION_EFFECTIVE',entityType:'Qualification',entityId:qualification.qualificationId,requestId:'timeline-test',correlationId:'00000000-0000-0000-0000-000000000701'}});
    await db.operationalTask.create({data:{sourceType:'MEMBER',sourceId:person.memberNo,taskCode:'FOLLOW_UP',summary:'safe operational follow-up',evidenceHash:'a'.repeat(64)}});
    await db.operationalException.create({data:{sourceType:'MEMBER',sourceId:person.memberNo,exceptionCode:'RECONCILIATION_CHECK',summary:'safe operational exception',evidenceHash:'b'.repeat(64)}});
    const course=await db.learningCourse.create({data:{courseCode:'TIMELINE-LEARN',status:'PUBLISHED',createdByActor:'test'}});
    const version=await db.learningCourseVersion.create({data:{learningCourseId:course.learningCourseId,version:1,title:'Timeline Learning',categoryCode:'ONBOARDING',contentHash:'c'.repeat(64),status:'PUBLISHED',approvalReference:'test',approvedByActor:'test',approvedAt:new Date()}});
    const enrollment=await db.learningEnrollment.create({data:{learningCourseId:course.learningCourseId,learningCourseVersionId:version.learningCourseVersionId,personId:person.personId}});
    await db.learningProgressEvent.create({data:{learningEnrollmentId:enrollment.learningEnrollmentId,eventType:'COURSE_ENROLLED',idempotencyKey:'timeline-learning',evidenceHash:'d'.repeat(64)}});
    const service=new AdminOperationsService(db as any,new AuditService());
    const first=await service.memberActivityTimeline(person.memberNo);
    expect(await service.memberActivityTimeline(person.memberNo)).toEqual(first);
    expect(first).toEqual(expect.arrayContaining([
      expect.objectContaining({source:'AUDIT_EVENT',eventType:'QUALIFICATION_EFFECTIVE',sourceReference:{qualificationNo:qualification.qualificationNo.toString(),ballNo:null}}),
      expect.objectContaining({source:'OPERATIONAL_TASK',eventCode:'FOLLOW_UP',sourceReference:{memberNo:person.memberNo}}),
      expect.objectContaining({source:'OPERATIONAL_EXCEPTION',eventCode:'RECONCILIATION_CHECK',sourceReference:{memberNo:person.memberNo}}),
      expect.objectContaining({source:'LEARNING',eventType:'COURSE_ENROLLED',sourceReference:{memberNo:person.memberNo,courseCode:'TIMELINE-LEARN'}}),
    ]));
    const payload=JSON.stringify(first);
    expect(payload).not.toContain(person.personId);
    expect(payload).not.toContain(qualification.qualificationId);
    expect(payload).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    await expect(service.memberActivityTimeline('not-a-member-no')).rejects.toThrow('INVALID_MEMBER_NO');
  });
});
