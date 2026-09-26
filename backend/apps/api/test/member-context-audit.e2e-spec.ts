import { ForbiddenException } from '@nestjs/common';
import { MemberContextGuard } from '../src/modules/member/member-context.guard';

describe('G8 member BOLA denial audit evidence',()=>{
  it('records only a controlled path and denial code for a non-holder',async()=>{
    const tx:any={};
    const audit={write:jest.fn(async()=>({}))};
    const prisma={$transaction:jest.fn(async(fn:any)=>fn(tx))};
    const access={assertHolder:jest.fn(async()=>{throw new ForbiddenException('QUALIFICATION_ACCESS_DENIED');})};
    const guard=new MemberContextGuard(access as any,prisma as any,audit as any);
    const request:any={url:'/api/v1/member/orders?qualificationId=private-id',method:'GET',query:{qualificationId:'11111111-1111-4111-8111-111111111111'},user:{personId:'22222222-2222-4222-8222-222222222222'},requestId:'33333333-3333-4333-8333-333333333333',correlationId:'44444444-4444-4444-8444-444444444444'};
    const context:any={switchToHttp:()=>({getRequest:()=>request})};
    await expect(guard.canActivate(context)).rejects.toMatchObject({response:{code:'QUALIFICATION_NOT_OWNED'}});
    expect(audit.write).toHaveBeenCalledWith(tx,expect.objectContaining({action:'ACCESS_DENIED',eventCode:'ACCESS_DENIED',reasonCode:'QUALIFICATION_NOT_OWNED',result:'DENIED',afterData:{path:'/api/v1/member/orders',code:'QUALIFICATION_NOT_OWNED'}}));
    expect(JSON.stringify(audit.write.mock.calls)).not.toContain('private-id');
    expect(JSON.stringify(audit.write.mock.calls)).not.toContain('11111111-1111-4111-8111-111111111111');
  });
});
