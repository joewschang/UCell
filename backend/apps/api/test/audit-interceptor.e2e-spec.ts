import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from '../src/common/audit/audit.interceptor';

describe('G8 HTTP audit privacy and outcome evidence',()=>{
 const context=(request:any)=>({switchToHttp:()=>({getRequest:()=>request})}) as any;
 it('removes query data and captures the controlled outcome',async()=>{
  const create=jest.fn(async()=>({}));const interceptor=new AuditInterceptor({auditEvent:{create}} as any);
  await new Promise<void>((resolve,reject)=>interceptor.intercept(context({method:'GET',originalUrl:'/api/v1/member/me?email=private@example.test',requestId:'r',correlationId:'11111111-1111-4111-8111-111111111111',user:{personId:'22222222-2222-4222-8222-222222222222',role:'MEMBER'}}),{handle:()=>of({})} as any).subscribe({complete:resolve,error:reject}));await new Promise(resolve=>setImmediate(resolve));const call=(create as jest.Mock).mock.calls[0];expect(call).toBeTruthy();const data=call![0].data;
  expect(data).toMatchObject({action:'HTTP_GET',eventCode:'HTTP_GET',result:'SUCCESS',traceId:'11111111-1111-4111-8111-111111111111'});expect(JSON.stringify(data)).not.toContain('private@example.test');
 });
 it('records controlled failed outcomes without raw exception details',async()=>{
  const create=jest.fn(async()=>({}));const interceptor=new AuditInterceptor({auditEvent:{create}} as any);
  await new Promise<void>(resolve=>interceptor.intercept(context({method:'POST',url:'/api/v1/x',requestId:'r',correlationId:'11111111-1111-4111-8111-111111111111'}),{handle:()=>throwError(()=>new HttpException({code:'PLACEMENT_SLOT_UNAVAILABLE',message:'private'},422))} as any).subscribe({error:()=>resolve()}));await new Promise(resolve=>setImmediate(resolve));const call=(create as jest.Mock).mock.calls[0];expect(call).toBeTruthy();expect(call![0].data).toMatchObject({eventCode:'PLACEMENT_SLOT_UNAVAILABLE',result:'FAILED'});
 });
});
