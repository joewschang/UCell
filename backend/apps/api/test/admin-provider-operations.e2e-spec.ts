import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { AdminProviderOperationsController } from '../src/modules/admin-provider-operations/admin-provider-operations.controller';
import { AdminProviderOperationsService } from '../src/modules/admin-provider-operations/admin-provider-operations.service';

describe('Admin provider webhook operations read model',()=>{
  const now=new Date('2026-09-19T00:00:00.000Z');

  it('reports critical health from an expired processing lease and aggregates safe dimensions',async()=>{
    const inbox={count:jest.fn().mockResolvedValueOnce(9).mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(2),groupBy:jest.fn()
      .mockResolvedValueOnce([{status:'PROCESSING',_count:{_all:4}}]).mockResolvedValueOnce([{domain:'PAYMENT',_count:{_all:9}}])
      .mockResolvedValueOnce([{domain:'PAYMENT',provider:'ACME',_count:{_all:9}}]),findFirst:jest.fn().mockResolvedValue({receivedAt:new Date('2026-09-18T22:00:00Z')})};
    const result=await new AdminProviderOperationsService({providerWebhookInbox:inbox} as unknown as PrismaService,{} as never,{} as never).health(now);
    expect(result).toMatchObject({state:'CRITICAL',total:9,dueBacklog:3,expiredLeases:1,manualReview:2,oldestDueReceivedAt:'2026-09-18T22:00:00.000Z',counts:{byStatus:{PROCESSING:4},byDomain:{PAYMENT:9},byProvider:[{domain:'PAYMENT',provider:'ACME',count:9}]}});
  });

  it('returns a bounded oldest-first backlog and omits stored evidence and lease ownership',async()=>{
    const row={providerWebhookInboxId:'inbox',domain:'PAYMENT',provider:'ACME',connectionId:'primary',status:'RETRY_PENDING',attemptCount:2,lastErrorCode:'TEMPORARY',receivedAt:new Date('2026-09-18T22:00:00Z'),verifiedAt:null,processedAt:null,nextAttemptAt:new Date('2026-09-18T23:00:00Z'),leaseExpiresAt:null,correlationId:'correlation'};
    const inbox={findMany:jest.fn().mockResolvedValue([row,{...row,providerWebhookInboxId:'overflow'}])};
    const result=await new AdminProviderOperationsService({providerWebhookInbox:inbox} as unknown as PrismaService,{} as never,{} as never).backlog({domain:'PAYMENT',provider:'ACME',take:1},now);
    expect(result).toMatchObject({limit:1,truncated:true,items:[{providerWebhookInboxId:'inbox',due:true,leaseExpired:false}]});
    expect(result.items[0]).not.toHaveProperty('payloadHash');
    expect(result.items[0]).not.toHaveProperty('safeEvidenceRef');
    expect(result.items[0]).not.toHaveProperty('verificationEvidenceHash');
    expect(result.items[0]).not.toHaveProperty('leaseOwner');
    expect(inbox.findMany.mock.calls[0][0]).toMatchObject({orderBy:[{receivedAt:'asc'},{providerWebhookInboxId:'asc'}],take:2});
  });

  it.each([{status:'UNKNOWN'},{domain:'UNKNOWN'},{take:0},{take:201},{provider:' '}])('rejects invalid filters before querying (%p)',async input=>{
    const inbox={findMany:jest.fn()};
    const service=new AdminProviderOperationsService({providerWebhookInbox:inbox} as unknown as PrismaService,{} as never,{} as never);
    await expect(service.backlog(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(inbox.findMany).not.toHaveBeenCalled();
  });

  it('keeps both endpoints wrapped in the admin API data envelope',async()=>{
    const service={health:jest.fn().mockResolvedValue({state:'HEALTHY'}),backlog:jest.fn().mockResolvedValue({items:[]})};
    const controller=new AdminProviderOperationsController(service as never);
    await expect(controller.health()).resolves.toEqual({data:{state:'HEALTHY'}});
    await expect(controller.backlog(undefined,undefined,undefined,'25')).resolves.toEqual({data:{items:[]}});
    expect(service.backlog).toHaveBeenCalledWith({domain:undefined,provider:undefined,status:undefined,take:25});
  });

  it('allows only operational and audit admin roles',()=>{
    expect(Reflect.getMetadata('roles',AdminProviderOperationsController)).toEqual(['SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT']);
  });

  it('requeues MANUAL_REVIEW transactionally with idempotency and audit evidence',async()=>{
    const tx:any={providerWebhookInbox:{findUnique:jest.fn(async()=>({providerWebhookInboxId:'00000000-0000-4000-8000-000000000001',status:'MANUAL_REVIEW',attemptCount:3,lastErrorCode:'PERMANENT_FAILURE',nextAttemptAt:null})),updateMany:jest.fn(async()=>({count:1}))}};
    const idempotency={execute:jest.fn(async(_scope:string,_key:string,_command:any,work:any)=>({value:await work(tx),replayed:false}))};
    const audit={write:jest.fn(async()=>undefined)};
    const service=new AdminProviderOperationsService({} as PrismaService,idempotency as never,audit as never);
    const result=await service.retryManualReview('00000000-0000-4000-8000-000000000001','Operator reviewed evidence and approved retry','retry-key','actor-subject',undefined,'request','00000000-0000-4000-8000-000000000002',now);
    expect(result).toMatchObject({status:'RETRY_PENDING',attemptCount:3,requeued:true,replayed:false});
    expect(tx.providerWebhookInbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{providerWebhookInboxId:'00000000-0000-4000-8000-000000000001',status:'MANUAL_REVIEW'},data:expect.objectContaining({status:'RETRY_PENDING',leaseOwner:null,leaseExpiresAt:null})}));
    expect(audit.write).toHaveBeenCalledWith(tx,expect.objectContaining({action:'PROVIDER_WEBHOOK_MANUAL_RETRY_REQUESTED',reasonCode:'MANUAL_RETRY',afterData:expect.objectContaining({actorReference:'actor-subject'})}));
  });

  it('rejects retry outside MANUAL_REVIEW without updating or auditing',async()=>{
    const tx:any={providerWebhookInbox:{findUnique:jest.fn(async()=>({status:'PROCESSED'})),updateMany:jest.fn()}};
    const idempotency={execute:jest.fn(async(_scope:string,_key:string,_command:any,work:any)=>work(tx))};
    const audit={write:jest.fn()};
    const service=new AdminProviderOperationsService({} as PrismaService,idempotency as never,audit as never);
    await expect(service.retryManualReview('00000000-0000-4000-8000-000000000001','Operator reviewed evidence and approved retry','retry-key','actor',undefined,'request','00000000-0000-4000-8000-000000000002',now)).rejects.toMatchObject({response:{code:'PROVIDER_WEBHOOK_NOT_MANUAL_REVIEW'}});
    expect(tx.providerWebhookInbox.updateMany).not.toHaveBeenCalled();expect(audit.write).not.toHaveBeenCalled();
  });
});
