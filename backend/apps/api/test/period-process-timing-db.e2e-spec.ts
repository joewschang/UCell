import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {periodProcessTiming} from '../src/modules/settlement-jobs/period-process-timing';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('PERIOD_PROCESS_TIMING_REAL_DB',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});afterAll(()=>db?.$disconnect());
 async function create(eventType='PERIOD_CLOSE_REQUESTED'){
  return db.outboxEvent.create({data:{eventType,aggregateType:'PERIOD_CLOSE_JOB',aggregateId:randomUUID(),payload:{},correlationId:randomUUID()}});
 }
 const history=(id:string)=>db.periodJobProcessTransition.findMany({where:{outboxEventId:id},orderBy:{revision:'desc'}});
 it('captures atomic status entry, ignores same-status retries and preserves original timestamps',async()=>{
  const event=await create(),initial=await history(event.outboxEventId);
  expect(initial).toHaveLength(1);expect(initial[0]).toMatchObject({revision:1,fromStatus:null,toStatus:'PENDING'});
  expect(initial[0].enteredAt).toEqual(initial[0].recordedAt);
  await db.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{attemptCount:1}});
  expect(await history(event.outboxEventId)).toEqual(initial);
  await db.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PROCESSING'}});
  await db.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PENDING'}});
  const rows=await history(event.outboxEventId);
  expect(rows.map(row=>[row.revision,row.fromStatus,row.toStatus])).toEqual([[3,'PROCESSING','PENDING'],[2,'PENDING','PROCESSING'],[1,null,'PENDING']]);
  expect(rows[2]).toEqual(initial[0]);
  const asOf=new Date(rows[0].recordedAt.getTime()+60000);
  expect(periodProcessTiming('PENDING',rows,asOf)).toMatchObject({status:'RECORDED',elapsedSeconds:60,enteredAt:rows[0].enteredAt!.toISOString()});
  expect(periodProcessTiming('DEAD',rows,asOf)).toMatchObject({status:'UNAVAILABLE',elapsedSeconds:null});
  expect(periodProcessTiming('PENDING',[{...rows[0],enteredAt:null}],asOf)).toMatchObject({status:'UNAVAILABLE',enteredAt:null});
  expect(periodProcessTiming('PENDING',rows,new Date(rows[0].recordedAt.getTime()-1))).toMatchObject({status:'UNAVAILABLE'});
 });
 it('rolls back process and timing together and rejects evidence tampering',async()=>{
  const event=await create(),rows=await history(event.outboxEventId);
  await expect(db.$transaction(async tx=>{
   await tx.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PROCESSING'}});
   throw new Error('ROLLBACK_TIMING');
  })).rejects.toThrow('ROLLBACK_TIMING');
  expect(await history(event.outboxEventId)).toEqual(rows);
  await expect(db.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{aggregateId:randomUUID()}})).rejects.toThrow();
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:event.outboxEventId}})).processStatus).toBe('PENDING');
  await expect(db.periodJobProcessTransition.update({where:{transitionId:rows[0].transitionId},data:{toStatus:'DEAD'}})).rejects.toThrow();
  await expect(db.periodJobProcessTransition.delete({where:{transitionId:rows[0].transitionId}})).rejects.toThrow();
  await expect(db.periodJobProcessTransition.create({data:{outboxEventId:event.outboxEventId,revision:2,toStatus:'DEAD'}})).rejects.toThrow();
  expect(await history(event.outboxEventId)).toEqual(rows);
 });
 it('serializes concurrent transitions and does not capture unrelated outbox types',async()=>{
  const event=await create();
  await Promise.all(Array.from({length:4},()=>db.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PROCESSING',attemptCount:{increment:1}}})));
  const rows=await history(event.outboxEventId);
  expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({revision:2,fromStatus:'PENDING',toStatus:'PROCESSING'});
  const other=await create('UNRELATED_EVENT');expect(await history(other.outboxEventId)).toEqual([]);
 });
});
