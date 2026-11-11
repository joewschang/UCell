import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {GreetingPublicationService} from '../src/modules/daily-greetings/greeting-publication.service';
import {greetingDate} from '../src/modules/daily-greetings/daily-greeting';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Greeting publication real isolated PostgreSQL',()=>{
 let db:PrismaService,service:GreetingPublicationService,id:string,hash:string;
 const actor=randomUUID(),date=greetingDate(),requestId=randomUUID(),key=randomUUID(),previous=process.env.DAILY_GREETING_PUBLISHING_ENABLED;
 const input={date,title:'TEST ONLY greeting',message:'TEST ONLY copy',contentBase64:readFileSync(join(__dirname,'../../../../member/tests/fixtures/daily-greeting-2026-11-11.png')).toString('base64')};
 beforeAll(async()=>{
  if(!url||!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))||process.env.DATABASE_URL!==url)throw new Error('ISOLATED_DATABASE_REQUIRED');
  db=new PrismaService();await db.$connect();process.env.DAILY_GREETING_PUBLISHING_ENABLED='true';service=new GreetingPublicationService(db,new IdempotencyService(db),new AuditService());
 });
 afterAll(async()=>{if(previous===undefined)delete process.env.DAILY_GREETING_PUBLISHING_ENABLED;else process.env.DAILY_GREETING_PUBLISHING_ENABLED=previous;await db?.$disconnect();});
 it('stores a private draft once with audit and payload-sensitive replay',async()=>{
  const first=await service.draft(input,key,requestId,actor),again=await service.draft(input,key,requestId,actor);id=first.data.id;hash=first.data.imageHash;
  expect(again.data.id).toBe(id);expect(again.meta.replayed).toBe(true);await expect(service.draft({...input,title:'changed'},key,requestId,actor)).rejects.toThrow();await expect(service.publicImage(id,hash)).rejects.toThrow();expect(await db.auditEvent.count({where:{entityId:id,action:'GREETING_UPLOADED'}})).toBe(1);
 });
 it('requires approval and exposes precisely the reviewed bytes',async()=>{
  await expect(service.transition(id,'publish','',randomUUID(),requestId,actor)).rejects.toThrow();await service.transition(id,'publish','TEST approval',randomUUID(),requestId,actor);expect((await service.released())?.id).toBe(id);expect(await service.publicImage(id,hash)).toEqual(await service.preview(id));
 });
 it('replaces then restores a prior version and revokes archived URLs',async()=>{
  const next=await service.draft({...input,title:'TEST replacement'},randomUUID(),requestId,actor);await service.transition(next.data.id,'publish','TEST approval',randomUUID(),requestId,actor);await expect(service.publicImage(id,hash)).rejects.toThrow();await service.transition(id,'publish','TEST restore',randomUUID(),requestId,actor);expect((await service.released())?.id).toBe(id);await expect(service.publicImage(next.data.id,next.data.imageHash)).rejects.toThrow();
 });
 it('does not replace a manual publication with the automatic template',async()=>{
  const result=await service.generateTemplate({date,title:'TEST automated',message:'TEST'},await service.preview(id),'TEST-v1');expect(result.status).toBe('ALREADY_PUBLISHED');expect((await service.released())?.id).toBe(id);
 });
 it('keeps an approved future version private until 07:00 Taipei',async()=>{
  const tomorrow=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10),future=await service.draft({...input,date:tomorrow},randomUUID(),requestId,actor);await service.transition(future.data.id,'publish','TEST future',randomUUID(),requestId,actor);await expect(service.publicImage(future.data.id,future.data.imageHash)).rejects.toThrow();expect((await service.released())?.id).toBe(id);
 });
 it('publishes only the approved template and records a system actor without a fake user UUID',async()=>{
  const approval=process.env.DAILY_GREETING_TEMPLATE_APPROVAL_REFERENCE,automatic=process.env.DAILY_GREETING_TEMPLATE_AUTO_APPROVAL;
  try{
   process.env.DAILY_GREETING_TEMPLATE_AUTO_APPROVAL='true';process.env.DAILY_GREETING_TEMPLATE_APPROVAL_REFERENCE='TEST reviewed template';
   const futureDate=new Date(Date.parse(date+'T12:00:00Z')+2*86400000).toISOString().slice(0,10);
   const result=await service.generateTemplate({date:futureDate,title:'TEST automatic template',message:'TEST reviewed copy'},await service.preview(id),'TEST-system-v1');
   expect(result.status).toBe('PUBLISHED');const events=await db.auditEvent.findMany({where:{entityId:result.id,action:{in:['GREETING_UPLOADED','GREETING_PUBLISHED']}}});
   expect(events).toHaveLength(2);expect(events.every(event=>event.actorType==='SYSTEM'&&event.actorId===null)).toBe(true);
  }finally{if(approval===undefined)delete process.env.DAILY_GREETING_TEMPLATE_APPROVAL_REFERENCE;else process.env.DAILY_GREETING_TEMPLATE_APPROVAL_REFERENCE=approval;if(automatic===undefined)delete process.env.DAILY_GREETING_TEMPLATE_AUTO_APPROVAL;else process.env.DAILY_GREETING_TEMPLATE_AUTO_APPROVAL=automatic;}
 });
 it('keeps one published version under concurrent approvals and permits safe retry',async()=>{
  const drafts=await Promise.all(['A','B'].map(label=>service.draft({...input,title:'TEST parallel '+label},randomUUID(),requestId,actor))),keys=[randomUUID(),randomUUID()];
  const publish=(index:number)=>service.transition(drafts[index].data.id,'publish','TEST concurrent approval',keys[index],requestId,actor);
  const results=await Promise.allSettled([publish(0),publish(1)]);expect(results.some(result=>result.status==='fulfilled')).toBe(true);
  for(let index=0;index<results.length;index++)if(results[index].status==='rejected')await publish(index);
  const active=await db.$queryRaw<{id:string}[]>`SELECT id FROM learning.daily_greeting_publication WHERE greeting_date=${date} AND status='PUBLISHED'`;
  expect(active).toHaveLength(1);expect(drafts.map(draft=>draft.data.id)).toContain(active[0].id);
 });

});
