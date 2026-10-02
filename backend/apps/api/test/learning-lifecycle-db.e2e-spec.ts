import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {LearningService} from '../src/modules/learning/learning.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {AuditService} from '../src/common/audit/audit.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Learning lifecycle integrity',()=>{
 let db:PrismaClient,s:LearningService;const actor=randomUUID();
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});s=new LearningService(db as any,new IdempotencyService(db as any),new AuditService());});afterAll(()=>db.$disconnect());
 async function fixture(){const courseCode=`LEARN-${randomUUID().slice(0,8).toUpperCase()}`,person=await db.person.create({data:{legalName:'Private learner',membershipState:'NETWORK_MEMBER'}});await s.create({courseCode,title:'Original',categoryCode:'ONBOARDING',lessons:[{title:'Original article',contentType:'ARTICLE',contentReference:'Original content'}]},actor,randomUUID(),randomUUID());await s.publish(courseCode,'APPROVED-TEST',actor,randomUUID(),randomUUID());const course=await db.learningCourse.findUniqueOrThrow({where:{courseCode},include:{versions:{include:{lessons:true}}}});return {courseCode,person,course};}
 it('pins member content to enrollment version while new members see the latest published version',async()=>{
  const f=await fixture();await s.enroll(f.person.personId,f.courseCode,randomUUID(),randomUUID());
  await db.learningCourseVersion.create({data:{learningCourseId:f.course.learningCourseId,version:2,title:'New content',categoryCode:'ONBOARDING',contentHash:'a'.repeat(64),lessons:{create:{sequenceNo:1,title:'New article',contentType:'ARTICLE',contentReference:'Different content'}}}});await s.publish(f.courseCode,'APPROVED-V2',actor,randomUUID(),randomUUID());
  expect(await s.memberDetail(f.person.personId,f.courseCode)).toMatchObject({version:1,title:'Original',lessons:[{title:'Original article'}]});
  const other=await db.person.create({data:{legalName:'Other learner',membershipState:'NETWORK_MEMBER'}});expect(await s.memberDetail(other.personId,f.courseCode)).toMatchObject({version:2,title:'New content'});
  expect(await s.memberList(f.person.personId)).toEqual(expect.arrayContaining([expect.objectContaining({courseCode:f.courseCode,version:1,status:'ENROLLED'})]));
  const admin=JSON.stringify(await s.adminList());expect(admin).not.toContain(f.course.learningCourseId);expect(admin).not.toContain(actor);
 });
 it('serializes enrollment, first start, lesson completion and course completion under different retry keys',async()=>{
  const f=await fixture();const enroll=()=>s.enroll(f.person.personId,f.courseCode,randomUUID(),randomUUID());await Promise.all([enroll(),enroll()]);const lesson=()=>s.lessonCompleted(f.person.personId,f.courseCode,1,randomUUID());await Promise.all([lesson(),lesson()]);
  const detail=await s.memberDetail(f.person.personId,f.courseCode);expect(detail).toMatchObject({status:'STARTED',requiredLessonCount:1,completedRequiredCount:1,canComplete:true});
  const complete=()=>s.complete(f.person.personId,f.courseCode,randomUUID(),randomUUID());await Promise.all([complete(),complete()]);const e=await db.learningEnrollment.findFirstOrThrow({where:{personId:f.person.personId},include:{progressEvents:true}});expect(e.progressEvents.map(x=>x.eventType).sort()).toEqual(['COURSE_COMPLETED','COURSE_ENROLLED','COURSE_STARTED','LESSON_COMPLETED']);expect(await db.memberNotification.count({where:{personId:f.person.personId}})).toBe(2);
  await expect(db.learningProgressEvent.update({where:{learningProgressEventId:e.progressEvents[0].learningProgressEventId},data:{occurredAt:new Date()}})).rejects.toThrow();await expect(db.learningEnrollment.update({where:{learningEnrollmentId:e.learningEnrollmentId},data:{completedAt:new Date()}})).rejects.toThrow();
 });
 it('archives without erasing history, excludes unregistered readers and blocks new progress/publish',async()=>{
  const f=await fixture();await s.enroll(f.person.personId,f.courseCode,randomUUID(),randomUUID());const other=await db.person.create({data:{legalName:'Not enrolled',membershipState:'NETWORK_MEMBER'}}),key=randomUUID();await s.archive(f.courseCode,'課程已結束',actor,key,randomUUID());await s.archive(f.courseCode,'課程已結束',actor,key,randomUUID());
  expect(await s.memberDetail(f.person.personId,f.courseCode)).toMatchObject({version:1,courseStatus:'ARCHIVED',available:false,status:'ENROLLED'});await expect(s.memberDetail(other.personId,f.courseCode)).rejects.toMatchObject({status:404});await expect(s.lessonCompleted(f.person.personId,f.courseCode,1,randomUUID())).rejects.toThrow();await expect(s.publish(f.courseCode,'APPROVED',actor,randomUUID(),randomUUID())).rejects.toThrow();expect(await db.auditEvent.count({where:{entityId:f.course.learningCourseId,action:'LEARNING_COURSE_ARCHIVED'}})).toBe(1);
 });
 it('rejects mutation of published lessons, published versions and cross-version progress',async()=>{
  const a=await fixture(),b=await fixture();await s.enroll(a.person.personId,a.courseCode,randomUUID(),randomUUID());const e=await db.learningEnrollment.findFirstOrThrow({where:{personId:a.person.personId}});
  await expect(db.learningCourseVersion.update({where:{learningCourseVersionId:a.course.versions[0].learningCourseVersionId},data:{title:'Changed'}})).rejects.toThrow();await expect(db.learningLesson.update({where:{learningLessonId:a.course.versions[0].lessons[0].learningLessonId},data:{contentReference:'Changed'}})).rejects.toThrow();await expect(db.learningProgressEvent.create({data:{learningEnrollmentId:e.learningEnrollmentId,learningLessonId:b.course.versions[0].lessons[0].learningLessonId,eventType:'LESSON_COMPLETED',idempotencyKey:randomUUID(),evidenceHash:'b'.repeat(64)}})).rejects.toThrow();await expect(db.learningEnrollment.update({where:{learningEnrollmentId:e.learningEnrollmentId},data:{learningCourseVersionId:b.course.versions[0].learningCourseVersionId}})).rejects.toThrow();
 });
});
