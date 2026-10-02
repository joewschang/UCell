import {PrismaClient} from '@prisma/client';
import {ConflictException,UnprocessableEntityException} from '@nestjs/common';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
const actor='00000000-0000-0000-0000-000000000401';

describeDb('OPERATIONAL_EXCEPTION_REAL_DB',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());

  it('tracks investigation work without mutating its source workflow and preserves an audit trail',async()=>{
    const sourceId='FUL-'+Date.now();
    const exception=await db.operationalException.create({data:{
      sourceType:'FULFILLMENT',sourceId,exceptionCode:'ERP_DELIVERY_TIMEOUT',severity:'WARNING',
      evidenceHash:'a'.repeat(64),traceId:'00000000-0000-0000-0000-000000000402',summary:'ERP delivery acknowledgement did not arrive',
    }});
    const service=new AdminOperationsService(db as any,new AuditService());
    const queue=await service.operationalExceptions({status:'OPEN'});
    expect(queue.map(row=>row.operationalExceptionId)).toContain(exception.operationalExceptionId);
    await expect(service.operationalExceptions({status:'NOT_A_STATUS'})).rejects.toBeInstanceOf(UnprocessableEntityException);

    const acknowledged=await service.transitionOperationalException(exception.operationalExceptionId,'ACKNOWLEDGED',actor,undefined,'00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000404');
    expect(acknowledged).toMatchObject({status:'ACKNOWLEDGED',acknowledgedByActor:actor});
    const investigating=await service.transitionOperationalException(exception.operationalExceptionId,'INVESTIGATING',actor,undefined,'00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000406');
    expect(investigating.status).toBe('INVESTIGATING');
    const resolved=await service.transitionOperationalException(exception.operationalExceptionId,'RESOLVED',actor,'Confirmed downstream retry delivery','00000000-0000-0000-0000-000000000407','00000000-0000-0000-0000-000000000408');
    expect(resolved).toMatchObject({status:'RESOLVED',resolvedByActor:actor,resolutionNote:'Confirmed downstream retry delivery'});
    await expect(service.transitionOperationalException(exception.operationalExceptionId,'INVESTIGATING',actor,undefined,'00000000-0000-0000-0000-000000000409','00000000-0000-0000-0000-000000000410')).rejects.toBeInstanceOf(ConflictException);

    const stored=await db.operationalException.findUniqueOrThrow({where:{operationalExceptionId:exception.operationalExceptionId}});
    expect(stored).toMatchObject({sourceType:'FULFILLMENT',sourceId,exceptionCode:'ERP_DELIVERY_TIMEOUT',evidenceHash:'a'.repeat(64),status:'RESOLVED'});
    expect(await db.auditEvent.count({where:{entityType:'OPERATIONAL_EXCEPTION',entityId:exception.operationalExceptionId,action:'OPERATIONAL_EXCEPTION_TRANSITIONED'}})).toBe(3);
  });
});
