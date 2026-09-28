import {PrismaClient} from '@prisma/client';
import {ConflictException,UnprocessableEntityException} from '@nestjs/common';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
const actor='00000000-0000-0000-0000-000000000501';

describeDb('OPERATIONAL_TASK_REAL_DB',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());

  it('records operational work without changing its source authority and keeps an audit trail',async()=>{
    const sourceId='ORDER-'+Date.now();
    const task=await db.operationalTask.create({data:{sourceType:'ORDER',sourceId,taskCode:'FULFILLMENT_HANDOFF_REVIEW',priority:'HIGH',evidenceHash:'b'.repeat(64),traceId:'00000000-0000-0000-0000-000000000502',summary:'Review a delayed fulfillment handoff'}});
    const service=new AdminOperationsService(db as any,new AuditService());
    expect((await service.operationalTasks({status:'OPEN'})).map(row=>row.operationalTaskId)).toContain(task.operationalTaskId);
    await expect(service.operationalTasks({status:'INVALID'})).rejects.toBeInstanceOf(UnprocessableEntityException);
    const acknowledged=await service.transitionOperationalTask(task.operationalTaskId,'ACKNOWLEDGED',actor,undefined,'00000000-0000-0000-0000-000000000503','00000000-0000-0000-0000-000000000504');
    expect(acknowledged).toMatchObject({status:'ACKNOWLEDGED',acknowledgedByActor:actor});
    const completed=await service.transitionOperationalTask(task.operationalTaskId,'COMPLETED',actor,'Verified external acknowledgement','00000000-0000-0000-0000-000000000505','00000000-0000-0000-0000-000000000506');
    expect(completed).toMatchObject({status:'COMPLETED',completedByActor:actor,completionNote:'Verified external acknowledgement'});
    await expect(service.transitionOperationalTask(task.operationalTaskId,'ACKNOWLEDGED',actor,undefined,'00000000-0000-0000-0000-000000000507','00000000-0000-0000-0000-000000000508')).rejects.toBeInstanceOf(ConflictException);
    const stored=await db.operationalTask.findUniqueOrThrow({where:{operationalTaskId:task.operationalTaskId}});
    expect(stored).toMatchObject({sourceType:'ORDER',sourceId,taskCode:'FULFILLMENT_HANDOFF_REVIEW',evidenceHash:'b'.repeat(64),status:'COMPLETED'});
    expect(await db.auditEvent.count({where:{entityType:'OPERATIONAL_TASK',entityId:task.operationalTaskId,action:'OPERATIONAL_TASK_TRANSITIONED'}})).toBe(2);
  });
});
