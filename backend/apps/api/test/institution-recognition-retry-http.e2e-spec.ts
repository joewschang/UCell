import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Prisma } from '@prisma/client';
import { withRecognitionRetry } from '@ucell/database';
import { RpvController } from '../src/modules/rpv/rpv.controller';
import { EpvController } from '../src/modules/epv/epv.controller';
import { RpvService } from '../src/modules/rpv/rpv.service';
import { EpvService } from '../src/modules/epv/epv.service';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import {sendRecognitionRequest} from '../../../../shared/recognition-request';
import {Reflector} from '@nestjs/core';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';

describe('Recognition retry transport and failure boundaries', () => {
  it('enforces RPV write roles through the real role guard while retaining audit read access',async()=>{
    const service={recognize:jest.fn().mockResolvedValue({recognized:true}),listAwards:jest.fn().mockResolvedValue([])};
    const module=await Test.createTestingModule({controllers:[RpvController],providers:[{provide:RpvService,useValue:service}]}).compile();
    const app=module.createNestApplication(new FastifyAdapter());const guard=new AdminRoleGuard(new Reflector());
    // Test principals replace authentication only; production role enforcement stays real.
    app.useGlobalGuards({canActivate(ctx){const req=ctx.switchToHttp().getRequest();if(req.headers['x-test-role'])req.user={role:req.headers['x-test-role']};return guard.canActivate(ctx);}});
    await app.listen(0,'127.0.0.1');
    try{
      const base=(await app.getUrl())+'/admin/rpv/recognitions/test';
      for(const role of ['COMPLIANCE_AUDIT','SUPPORT'])expect((await fetch(base+'/run',{method:'POST',headers:{'x-test-role':role}})).status).toBe(403);
      expect((await fetch(base+'/run',{method:'POST'})).status).toBe(401);expect(service.recognize).not.toHaveBeenCalled();
      for(const role of ['SUPER_ADMIN','FINANCE'])expect((await fetch(base+'/run',{method:'POST',headers:{'x-test-role':role}})).status).toBe(201);
      expect((await fetch(base+'/awards',{headers:{'x-test-role':'COMPLIANCE_AUDIT'}})).status).toBe(200);expect(service.recognize).toHaveBeenCalledTimes(2);
    }finally{await app.close();}
  });
  it.each(['RPV','EPV'])('%s client resends the same endpoint after the actual HTTP 409 envelope',async kind=>{
    const conflict=new Prisma.PrismaClientKnownRequestError('PRIVATE SQL DETAIL',{code:'P2034',clientVersion:'test'});
    const transaction=jest.fn().mockRejectedValueOnce(conflict).mockRejectedValueOnce(conflict).mockRejectedValueOnce(conflict).mockRejectedValueOnce(conflict).mockResolvedValue({recognized:true});
    const client={$transaction:transaction} as any;
    const module=await Test.createTestingModule({controllers:[RpvController,EpvController],providers:[
      {provide:RpvService,useValue:new RpvService(client,{} as any)},
      {provide:EpvService,useValue:new EpvService(client,{} as any,{} as any,{} as any)},
    ]}).compile();
    const app=module.createNestApplication(new FastifyAdapter());app.useGlobalFilters(new ApiExceptionFilter());await app.listen(0,'127.0.0.1');
    try{
      const id='11111111-1111-4111-8111-111111111111';
      const route=kind==='RPV'?`/admin/rpv/recognitions/${id}/run`:`/admin/epv/orders/${id}/recognize`;
      const urls:string[]=[],statuses:number[]=[];
      const result=await sendRecognitionRequest(async()=>{
        const url=(await app.getUrl())+route;urls.push(url);const response=await fetch(url,{method:'POST',headers:{'Idempotency-Key':'same-key'}});statuses.push(response.status);
        const body=await response.json();if(!response.ok)throw {status:response.status,body};return body;
      });
      expect(result).toEqual({data:{recognized:true}});expect(statuses).toEqual([409,201]);expect(new Set(urls).size).toBe(1);expect(transaction).toHaveBeenCalledTimes(5);
    }finally{await app.close();}
  });
  it.each(['RPV', 'EPV'])('%s returns actionable HTTP 409 after four transaction conflicts', async kind => {
    const transaction = jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('PRIVATE SQL DETAIL', { code: 'P2034', clientVersion: 'test' }));
    const client = { $transaction: transaction } as any;
    const module = await Test.createTestingModule({ controllers: [RpvController, EpvController], providers: [
      { provide: RpvService, useValue: new RpvService(client, {} as any) },
      { provide: EpvService, useValue: new EpvService(client, {} as any, {} as any, {} as any) },
    ] }).compile();
    const app = module.createNestApplication(new FastifyAdapter()); app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, '127.0.0.1');
    try {
      const route = kind === 'RPV' ? '/admin/rpv/recognitions/test/run' : '/admin/epv/orders/test/recognize';
      const response = await fetch((await app.getUrl()) + route, { method: 'POST' });
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body).toMatchObject({ code: 'RECOGNITION_RETRY_EXHAUSTED', details: { retryable: true, attempts: 4 } });
      expect(response.headers.get('x-request-id')).toBeTruthy();
      expect(JSON.stringify(body)).not.toContain('PRIVATE SQL DETAIL');
      expect(transaction).toHaveBeenCalledTimes(4);
    } finally { await app.close(); }
  });
  it.each([
    { code: 'P2002' }, { code: 'P1001' }, { code: 'P2028' },
    { code: 'P2010', meta: { code: '23505' } }, { code: 'P2010', meta: { code: '55P03' } },
    new Error('business validation'),
  ])('does not retry business, uniqueness, timeout or unknown-commit errors %#', async error => {
    const work = jest.fn().mockRejectedValue(error);
    await expect(withRecognitionRetry(work)).rejects.toBe(error);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
