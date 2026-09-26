import { HttpException } from '@nestjs/common';
import { structuredOperationalError } from '@ucell/database';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';

describe('G8 structured error envelope',()=>{
  it('emits a deterministic privacy-safe fingerprint without raw exception details',()=>{
    const event=structuredOperationalError({service:'api',operation:'GET /api/v1/member/me',traceId:'trace-1',error:new Error('DATABASE_URL=super-secret'),errorCode:'AUTH_ACCESS_DENIED',statusCode:403,releaseVersion:'test-head',now:new Date('2026-09-26T00:00:00.000Z')});
    expect(event).toMatchObject({event:'UCELL_STRUCTURED_ERROR',traceId:'trace-1',errorCode:'AUTH_ACCESS_DENIED',errorClass:'Error',service:'api',operation:'GET /api/v1/member/me',severity:'WARNING',retryable:false});
    expect(event.fingerprint).toMatch(/^[0-9a-f]{64}$/);expect(JSON.stringify(event)).not.toContain('super-secret');expect(event.message).not.toContain('DATABASE_URL');
  });
  it('falls back to a controlled internal code and never forwards raw errors',()=>{
    const spy=jest.spyOn(console,'error').mockImplementation();
    const reply={header:jest.fn(),status:jest.fn().mockReturnThis(),send:jest.fn()};
    const request:any={method:'GET',url:'/api/v1/member/me',headers:{'x-request-id':'r1'},correlationId:'trace-2'};
    const host:any={switchToHttp:()=>({getRequest:()=>request,getResponse:()=>reply})};
    new ApiExceptionFilter().catch(new Error('token=forbidden'),host);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({code:'INTERNAL_UNEXPECTED',request_id:'r1'}));
    expect(spy).toHaveBeenCalledWith(expect.not.stringContaining('forbidden'));
    spy.mockRestore();
  });
  it('keeps explicit controlled domain codes',()=>{
    const spy=jest.spyOn(console,'error').mockImplementation();
    const reply={header:jest.fn(),status:jest.fn().mockReturnThis(),send:jest.fn()};
    const host:any={switchToHttp:()=>({getRequest:()=>({method:'POST',url:'/x',headers:{},correlationId:'trace-3'}),getResponse:()=>reply})};
    new ApiExceptionFilter().catch(new HttpException({code:'PLACEMENT_SLOT_UNAVAILABLE',message:'controlled'},422),host);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({code:'PLACEMENT_SLOT_UNAVAILABLE'}));
    expect(spy.mock.calls.join(' ')).toContain('PLACEMENT_SLOT_UNAVAILABLE');spy.mockRestore();
  });
});
