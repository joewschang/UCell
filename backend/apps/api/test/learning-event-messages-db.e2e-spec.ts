import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {LearningService} from '../src/modules/learning/learning.service';
import {MemberEventsService} from '../src/modules/events/events.service';
import {MemberMessagesService} from '../src/modules/member/member-messages.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {AuditService} from '../src/common/audit/audit.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Personal Learning/Event message integration',()=>{
 let db:PrismaClient,learning:LearningService,events:MemberEventsService,messages:MemberMessagesService;
 const actor=randomUUID();
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});const idempotency=new IdempotencyService(db as any),audit=new AuditService();learning=new LearningService(db as any,idempotency,audit);events=new MemberEventsService(db as any,idempotency,audit);messages=new MemberMessagesService(db as any,audit,idempotency);});
 afterAll(()=>db.$disconnect());afterEach(()=>jest.restoreAllMocks());
 const person=()=>db.person.create({data:{legalName:'Private learner',membershipState:'NETWORK_MEMBER'}});
 it('delivers enrollment/completion once, only after committed progress, without qualification or LINE delivery',async()=>{
  const p=await person(),other=await person(),courseCode=`COURSE-${randomUUID().slice(0,8).toUpperCase()}`,before=await db.notificationDelivery.count();
  await learning.create({courseCode,title:'Training',categoryCode:'ONBOARDING',lessons:[{title:'Read',contentType:'ARTICLE',contentReference:'Article'}]},actor,randomUUID(),randomUUID());
  await learning.publish(courseCode,'APPROVED-TRAINING',actor,randomUUID(),randomUUID());
  const key=randomUUID();await learning.enroll(p.personId,courseCode,key,randomUUID());await learning.enroll(p.personId,courseCode,key,randomUUID());await learning.enroll(p.personId,courseCode,randomUUID(),randomUUID());
  await expect(learning.complete(p.personId,courseCode,randomUUID(),randomUUID())).rejects.toMatchObject({status:409});
  expect(await db.memberNotification.count({where:{personId:p.personId}})).toBe(1);
  await learning.lessonCompleted(p.personId,courseCode,1,randomUUID());await learning.complete(p.personId,courseCode,randomUUID(),randomUUID());await learning.complete(p.personId,courseCode,randomUUID(),randomUUID());
  const page=await messages.list(p.personId,{category:'LEARNING'});expect(page.items).toHaveLength(2);expect(page.items.every(x=>x.deepLink===`/learning?course=${courseCode}`&&x.sourceReference===`COURSE:${courseCode}`)).toBe(true);
  expect(JSON.stringify(page)).not.toContain(p.personId);expect(JSON.stringify(page)).not.toContain('Private learner');expect((await messages.list(other.personId,{})).items).toEqual([]);expect(await db.notificationDelivery.count()).toBe(before);
 });
 it('keeps registration cycles distinct and excludes check-in credentials from personal messages',async()=>{
  const p=await person(),eventCode=`EVENT-${randomUUID().slice(0,8).toUpperCase()}`,before=await db.notificationDelivery.count();
  await events.create({eventCode,title:'Event',eventType:'ONLINE',onlineJoinReference:'https://example.test/event',startsAt:new Date(Date.now()+3600000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString()},actor,randomUUID(),randomUUID());await events.publish(eventCode,'APPROVED-EVENT',actor,randomUUID(),randomUUID());
  const key=randomUUID(),first=await events.register(p.personId,eventCode,key,randomUUID());await events.register(p.personId,eventCode,key,randomUUID());await events.register(p.personId,eventCode,randomUUID(),randomUUID());
  await events.cancel(p.personId,eventCode,randomUUID(),randomUUID());await events.cancel(p.personId,eventCode,randomUUID(),randomUUID());const renewed=await events.register(p.personId,eventCode,randomUUID(),randomUUID());
  await expect(events.checkIn(first.checkInToken!,actor,randomUUID(),randomUUID())).rejects.toMatchObject({status:404});
  const r=await db.memberEventRegistration.findFirstOrThrow({where:{personId:p.personId}});const version=await db.memberEventVersion.findUniqueOrThrow({where:{memberEventVersionId:r.memberEventVersionId}});jest.spyOn(events as any,'now').mockReturnValue(new Date(version.startsAt.getTime()+1000));
  await events.checkIn(renewed.checkInToken!,actor,randomUUID(),randomUUID());await events.checkIn(renewed.checkInToken!,actor,randomUUID(),randomUUID());
  const page=await messages.list(p.personId,{category:'EVENT'});expect(page.items).toHaveLength(4);expect(page.items.every(x=>x.sourceReference===`EVENT:${eventCode}`&&x.deepLink===`/events?event=${eventCode}`)).toBe(true);
  for(const hidden of [p.personId,r.memberEventRegistrationId,first.checkInToken!,renewed.checkInToken!,r.checkInTokenHash!])expect(JSON.stringify(page)).not.toContain(hidden);expect(await db.notificationDelivery.count()).toBe(before);
 });
 it('rolls back event registration and idempotency when transactional message delivery fails',async()=>{
  const p=await person(),eventCode=`EVENT-${randomUUID().slice(0,8).toUpperCase()}`,key=randomUUID();
  await events.create({eventCode,title:'Atomic event',eventType:'ONLINE',onlineJoinReference:'https://example.test/event',startsAt:new Date(Date.now()+3600000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString()},actor,randomUUID(),randomUUID());await events.publish(eventCode,'APPROVED-EVENT',actor,randomUUID(),randomUUID());
  // Scoped fault injection in this disposable database, removed even on assertion failure.
  await db.$executeRawUnsafe(`CREATE FUNCTION integration.test_message_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.person_id='${p.personId}'::uuid THEN RAISE EXCEPTION 'TEST_MESSAGE_DELIVERY_FAILURE'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER test_message_failure BEFORE INSERT ON integration.member_notification FOR EACH ROW EXECUTE FUNCTION integration.test_message_failure()');
  try{await expect(events.register(p.personId,eventCode,key,randomUUID())).rejects.toThrow('TEST_MESSAGE_DELIVERY_FAILURE');expect(await db.memberEventRegistration.count({where:{personId:p.personId}})).toBe(0);expect(await db.idempotencyRecord.count({where:{idempotencyKey:key}})).toBe(0);expect(await db.auditEvent.count({where:{actorId:p.personId,action:'MEMBER_EVENT_REGISTERED'}})).toBe(0);}finally{await db.$executeRawUnsafe('DROP TRIGGER test_message_failure ON integration.member_notification');await db.$executeRawUnsafe('DROP FUNCTION integration.test_message_failure()');}
  await events.register(p.personId,eventCode,key,randomUUID());expect(await db.memberNotification.count({where:{personId:p.personId}})).toBe(1);
 });
});
