import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {LearningService} from '../src/modules/learning/learning.service';
import {MemberEventsService} from '../src/modules/events/events.service';
import {MemberMessagesService} from '../src/modules/member/member-messages.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {AuditService} from '../src/common/audit/audit.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Personal engagement outreach',()=>{
 let db:PrismaClient,l:LearningService,e:MemberEventsService;const actor=randomUUID(),reason='個別進度追蹤';
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});l=new LearningService(db as any,new IdempotencyService(db as any),new AuditService());e=new MemberEventsService(db as any,new IdempotencyService(db as any),new AuditService());});afterAll(()=>db.$disconnect());
 async function course(){const person=await db.person.create({data:{legalName:'PRIVATE OUTREACH',membershipState:'NETWORK_MEMBER'}}),courseCode='OUT-'+randomUUID().slice(0,8).toUpperCase();await l.create({courseCode,title:'Original',categoryCode:'ONBOARDING',lessons:[{title:'Read',contentType:'ARTICLE',contentReference:'Read this'}]},actor,randomUUID(),randomUUID());await l.publish(courseCode,'APPROVED',actor,randomUUID(),randomUUID());return {person,courseCode};}
 it('concurrent assignments pin one enrollment and notify only the selected member; reminders deduplicate across keys and actors',async()=>{
  const f=await course(),other=await db.person.create({data:{legalName:'Other',membershipState:'NETWORK_MEMBER'}});
  await Promise.all(Array.from({length:3},()=>l.outreach(f.courseCode,f.person.memberNo,'ASSIGN',reason,actor,randomUUID(),randomUUID())));
  const enrollment=await db.learningEnrollment.findFirstOrThrow({where:{personId:f.person.personId}});expect(await db.learningEnrollment.count({where:{personId:f.person.personId}})).toBe(1);expect(await db.learningProgressEvent.count({where:{learningEnrollmentId:enrollment.learningEnrollmentId,eventType:'COURSE_ASSIGNED'}})).toBe(1);
  await Promise.all([actor,randomUUID()].map(a=>l.outreach(f.courseCode,f.person.memberNo,'REMIND',reason,a,randomUUID(),randomUUID())));
  expect(await db.memberNotification.count({where:{personId:f.person.personId}})).toBe(2);
  const messages=new MemberMessagesService(db as any,new AuditService(),new IdempotencyService(db as any)),view=await messages.list(f.person.personId,{});expect(view.items.map(x=>x.title).sort()).toEqual(['已為您指派課程','課程學習提醒'].sort());expect(view.items.every(x=>x.deepLink==='/learning?course='+f.courseCode)).toBe(true);expect((await messages.list(other.personId,{})).items).toEqual([]);expect(JSON.stringify(view)).not.toContain(f.person.personId);
  await l.lessonCompleted(f.person.personId,f.courseCode,1,randomUUID());await l.complete(f.person.personId,f.courseCode,randomUUID(),randomUUID());expect(await db.memberNotification.count({where:{personId:f.person.personId,title:'課程學習提醒',retiredAt:null}})).toBe(0);await expect(l.outreach(f.courseCode,f.person.memberNo,'REMIND',reason,actor,randomUUID(),randomUUID())).rejects.toThrow('LEARNING_REMINDER_NOT_APPLICABLE');
  expect((await db.learningEnrollment.findUniqueOrThrow({where:{learningEnrollmentId:enrollment.learningEnrollmentId}})).learningCourseVersionId).toBe(enrollment.learningCourseVersionId);
 });
 it('rolls back assignment, message and evidence on audit failure and rejects ineligible or archived targets',async()=>{
  const f=await course(),failing=new LearningService(db as any,new IdempotencyService(db as any),{write:async()=>{throw Error('AUDIT_FAILED');}} as any);
  await expect(failing.outreach(f.courseCode,f.person.memberNo,'ASSIGN',reason,actor,randomUUID(),randomUUID())).rejects.toThrow('AUDIT_FAILED');expect(await db.learningEnrollment.count({where:{personId:f.person.personId}})).toBe(0);expect(await db.memberNotification.count({where:{personId:f.person.personId}})).toBe(0);
  await db.person.update({where:{personId:f.person.personId},data:{membershipState:null}});await expect(l.outreach(f.courseCode,f.person.memberNo,'ASSIGN',reason,actor,randomUUID(),randomUUID())).rejects.toThrow('LEARNING_TARGET_NOT_AVAILABLE');
  await db.person.update({where:{personId:f.person.personId},data:{membershipState:'NETWORK_MEMBER'}});await l.archive(f.courseCode,'Archived',actor,randomUUID(),randomUUID());await expect(l.outreach(f.courseCode,f.person.memberNo,'ASSIGN',reason,actor,randomUUID(),randomUUID())).rejects.toThrow('LEARNING_COURSE_NOT_OPEN');
 });
 it('event reminders use pinned registration cycle, expire at start, exclude cancellation, and re-registration can receive a fresh reminder',async()=>{
  const person=await db.person.create({data:{legalName:'Reminder member',membershipState:'NETWORK_MEMBER'}}),eventCode='REM-'+randomUUID().slice(0,8).toUpperCase(),startsAt=new Date(Date.now()+3600000).toISOString();
  await e.create({eventCode,title:'Future event',eventType:'ONLINE',startsAt,endsAt:new Date(Date.now()+7200000).toISOString(),onlineJoinReference:'https://example.com/join'},actor,randomUUID(),randomUUID());await e.publish(eventCode,'APPROVED',actor,randomUUID(),randomUUID());await e.register(person.personId,eventCode,randomUUID(),randomUUID());
  const key=randomUUID();await e.remind(eventCode,person.memberNo,reason,actor,key,randomUUID());await e.remind(eventCode,person.memberNo,reason,actor,key,randomUUID());await e.remind(eventCode,person.memberNo,reason,actor,randomUUID(),randomUUID());
  let rows=await db.memberNotification.findMany({where:{personId:person.personId,title:'活動參加提醒'}});expect(rows).toHaveLength(1);expect(rows[0].expiresAt?.toISOString()).toBe(startsAt);expect(rows[0].body).not.toContain('https://');
  await e.cancel(person.personId,eventCode,randomUUID(),randomUUID());expect((await db.memberNotification.findUniqueOrThrow({where:{notificationId:rows[0].notificationId}})).retiredAt).not.toBeNull();await expect(e.remind(eventCode,person.memberNo,reason,actor,randomUUID(),randomUUID())).rejects.toThrow('EVENT_REMINDER_NOT_APPLICABLE');await e.register(person.personId,eventCode,randomUUID(),randomUUID());await e.remind(eventCode,person.memberNo,reason,actor,randomUUID(),randomUUID());rows=await db.memberNotification.findMany({where:{personId:person.personId,title:'活動參加提醒'}});expect(rows).toHaveLength(2);
  await e.archive(eventCode,'Archived',actor,randomUUID(),randomUUID());await expect(e.remind(eventCode,person.memberNo,reason,actor,randomUUID(),randomUUID())).rejects.toThrow('EVENT_REMINDER_NOT_APPLICABLE');
 });
});
