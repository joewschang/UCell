import {PrismaClient} from '@prisma/client';
import {appendMemberMessage,memberMessageReference,safeMemberMessageLink,claimOutboxLease,processMemberOrderNotification} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {MemberMessagesService} from '../src/modules/member/member-messages.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {AuditService} from '../src/common/audit/audit.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('MEMBER_MESSAGES_REAL_DB',()=>{
 let db:PrismaClient,service:MemberMessagesService;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new MemberMessagesService(db as any,new AuditService(),new IdempotencyService(db as any));});afterAll(()=>db.$disconnect());
 async function fixture(){const person=await db.person.create({data:{legalName:'PRIVATE MESSAGE OWNER'}}),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:person.personId,effectiveFrom:new Date(0),sourceType:'TEST',sourceId:randomUUID()}});return {person,q};}
 async function message(personId:string,extra:Record<string,unknown>={}){return db.$transaction(tx=>appendMemberMessage(tx,{messageKey:randomUUID(),personId,category:'LEARNING',title:'課程通知',body:'課程 TEST_COURSE 已開始。',sourceType:'LEARNING_COURSE',sourceReference:'COURSE:TEST_COURSE',deepLink:'/learning',...extra}));}
 it('exposes only the authenticated Person and selected currently owned qualification with safe legacy content',async()=>{
  const a=await fixture(),b=await fixture(),personal=await message(a.person.personId),scoped=await message(a.person.personId,{qualificationId:a.q.qualificationId});await message(b.person.personId);
  const legacy=await db.memberNotification.create({data:{personId:a.person.personId,category:'ORDER',title:'舊通知',body:'訂單 '+randomUUID()+'；銀行帳號：1234567890123456',deepLink:'https://external.invalid/private',sourceReference:randomUUID()}});
  const page=await service.list(a.person.personId,{qualificationId:a.q.qualificationId});expect(page.items).toHaveLength(3);expect(page.items.find(row=>row.reference===memberMessageReference(legacy.notificationId))).toMatchObject({deepLink:null});
  const serialized=JSON.stringify(page);for(const hidden of [a.person.personId,a.q.qualificationId,b.person.personId,personal.notificationId,scoped.notificationId,'1234567890123456','PRIVATE MESSAGE OWNER'])expect(serialized).not.toContain(hidden);
  expect((await service.list(a.person.personId,{})).items).toHaveLength(2);
  await expect(service.list(b.person.personId,{qualificationId:a.q.qualificationId})).rejects.toThrow();await expect(service.command(b.person.personId,memberMessageReference(personal.notificationId),b.q.qualificationId,'READ',randomUUID(),randomUUID())).rejects.toMatchObject({response:{code:'MESSAGE_NOT_FOUND'}});
  await expect(service.command(a.person.personId,memberMessageReference(scoped.notificationId),undefined,'READ',randomUUID(),randomUUID())).rejects.toMatchObject({response:{code:'MESSAGE_NOT_FOUND'}});
 });
 it('honors publication, expiry, retirement and personal archive without implicitly marking read',async()=>{
  const f=await fixture(),at=new Date(),notice=await message(f.person.personId),expired=await message(f.person.personId,{publishedAt:new Date(at.getTime()-2000),expiresAt:new Date(at.getTime()-1000)});await message(f.person.personId,{publishedAt:new Date(at.getTime()+86400000)});
  const retired=await message(f.person.personId);await db.memberNotification.update({where:{notificationId:retired.notificationId},data:{retiredAt:at}});
  expect((await service.list(f.person.personId,{})).items.map(row=>row.reference)).toEqual([memberMessageReference(notice.notificationId)]);
  const reference=memberMessageReference(notice.notificationId),archive=()=>service.command(f.person.personId,reference,undefined,'ARCHIVE',randomUUID(),randomUUID());const results=await Promise.all([archive(),archive()]);expect(results[0]).toEqual(results[1]);expect(await db.memberNotificationRead.count({where:{notificationId:notice.notificationId}})).toBe(0);
  expect((await service.list(f.person.personId,{})).items).toEqual([]);const page=await service.list(f.person.personId,{view:'ARCHIVED'});expect(page.items).toHaveLength(3);expect(page.items.every(row=>row.deepLink===null)).toBe(true);expect(page.items.find(row=>row.reference===memberMessageReference(expired.notificationId))?.status).toBe('EXPIRED');
  await expect(db.memberNotificationArchive.update({where:{notificationId_personId:{notificationId:notice.notificationId,personId:f.person.personId}},data:{archivedAt:new Date()}})).rejects.toThrow();
 });
 it('preserves first read under concurrent keys and rolls back read, audit and idempotency together',async()=>{
  const f=await fixture(),notice=await message(f.person.personId),reference=memberMessageReference(notice.notificationId),key=randomUUID(),broken=new MemberMessagesService(db as any,{write:async()=>{throw new Error('MESSAGE_AUDIT_FAILURE');}} as any,new IdempotencyService(db as any));
  await expect(broken.command(f.person.personId,reference,undefined,'READ',key,randomUUID())).rejects.toThrow('MESSAGE_AUDIT_FAILURE');expect(await db.memberNotificationRead.count({where:{notificationId:notice.notificationId}})).toBe(0);expect(await db.idempotencyRecord.count({where:{idempotencyKey:key}})).toBe(0);
  const read=(k:string)=>service.command(f.person.personId,reference,undefined,'READ',k,randomUUID()),values=await Promise.all([read(key),read(randomUUID())]);expect(values[0]).toEqual(values[1]);expect(await read(key)).toEqual(values[0]);expect(await db.auditEvent.count({where:{entityId:notice.notificationId,action:'MEMBER_MESSAGE_READ'}})).toBe(1);
  await expect(service.command(f.person.personId,reference,undefined,'ARCHIVE',key,randomUUID())).rejects.toThrow();await expect(db.memberNotificationRead.update({where:{notificationId_personId:{notificationId:notice.notificationId,personId:f.person.personId}},data:{readAt:new Date()}})).rejects.toThrow();
 });
 it('deduplicates personal delivery, rejects unsafe links and pages without LINE delivery work',async()=>{
  const f=await fixture(),messageKey=randomUUID(),before=await db.notificationDelivery.count();await message(f.person.personId,{messageKey});await message(f.person.personId,{messageKey});expect(await db.memberNotification.count({where:{messageKey}})).toBe(1);
  await expect(message(f.person.personId,{messageKey,body:'不同內容'})).rejects.toThrow('MEMBER_MESSAGE_FAILURE');for(const link of ['https://evil.invalid','//evil.invalid','/orders?token=secret','javascript:alert(1)','/learning?course=../../secret']){expect(safeMemberMessageLink(link)).toBeNull();await expect(message(f.person.personId,{deepLink:link})).rejects.toThrow('MEMBER_MESSAGE_FAILURE');}
  await message(f.person.personId);const first=await service.list(f.person.personId,{take:1});await message(f.person.personId);const second=await service.list(f.person.personId,{take:1,cursor:first.nextCursor!,asOf:first.asOf});expect(second.nextCursor).toBeNull();expect(second.items[0].reference).not.toBe(first.items[0].reference);expect(await db.notificationDelivery.count()).toBe(before);
 });
 it('renders new order notices with the business order number and fences duplicate Worker delivery',async()=>{
  const f=await fixture(),order=await db.order.create({data:{qualificationId:f.q.qualificationId,purpose:'RETAIL',grossAmount:10,netAmount:10,ruleVersionCode:'R1.0B'}}),event=await db.outboxEvent.create({data:{eventType:'MEMBER_ORDER_CREATED',aggregateType:'ORDER',aggregateId:order.orderId,payload:{personId:f.person.personId,qualificationId:f.q.qualificationId,orderId:order.orderId},correlationId:randomUUID()}}),lease=(await claimOutboxLease(db,event))!;
  await processMemberOrderNotification(db,lease);await processMemberOrderNotification(db,lease);const row=await db.memberNotification.findUniqueOrThrow({where:{sourceEventId:event.outboxEventId}});expect(row.body).toContain(order.orderNo.toString());expect(row.body).not.toContain(order.orderId);expect(row.sourceReference).toBe('ORDER:'+order.orderNo);expect(row.deepLink).toBe('/orders');
 });
});
