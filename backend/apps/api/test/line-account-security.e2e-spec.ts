import { UnauthorizedException } from '@nestjs/common';
import { AccountSecurityService } from '../src/modules/auth/account-security.service';
import { LineIdentityService } from '../src/modules/auth/line-identity.service';
import { MemberAuthenticationGuard } from '../src/modules/auth/member-authentication.guard';

describe('LINE account security lite',()=>{
  const actor={actorType:'ADMIN' as const,actorId:'10000000-0000-4000-8000-000000000001',requestId:'req-security'};

  it('only resolves an active LINE binding',async()=>{
    const findFirst=jest.fn().mockResolvedValue({personId:'person-1',provider:'LINE',providerSubject:'line-1'});
    const service=new LineIdentityService({identityLink:{findFirst}} as any);
    await expect(service.resolveVerifiedSubject({lineSubject:'line-1'})).resolves.toMatchObject({personId:'person-1'});
    expect(findFirst).toHaveBeenCalledWith({where:{provider:'LINE',providerSubject:'line-1',status:'ACTIVE'}});
  });

  it('returns bounded security data without recovery tokens',async()=>{
    const findUnique=jest.fn().mockResolvedValue({personId:'person-1',memberNo:'M1',securityStatus:'NORMAL',identityLinks:[],accountRecoveryRequests:[]});
    const service=new AccountSecurityService({person:{findUnique},auditEvent:{findMany:jest.fn().mockResolvedValue([])}} as any,{write:jest.fn()} as any);
    await expect(service.readPersonSecurity('person-1')).resolves.toMatchObject({personId:'person-1',securityStatus:'NORMAL'});
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{personId:'person-1'},select:expect.objectContaining({accountRecoveryRequests:expect.objectContaining({take:20})})}));
  });

  it('rejects an otherwise valid session while the Person is security locked',async()=>{
    const guard=new MemberAuthenticationGuard(
      {authenticate:jest.fn().mockResolvedValue({sessionId:'session-1',personId:'person-1',provider:'LINE',subject:'line-1',role:null})} as any,
      {resolveVerifiedSubject:jest.fn().mockResolvedValue({personId:'person-1',provider:'LINE',providerSubject:'line-1'})} as any,
      {person:{findUnique:jest.fn().mockResolvedValue({personId:'person-1',status:'EFFECTIVE',securityStatus:'SECURITY_LOCKED'})}} as any,
      {get:jest.fn().mockReturnValue(undefined)} as any,
    );
    const request:any={headers:{authorization:'Bearer token'}};
    await expect(guard.canActivate({switchToHttp:()=>({getRequest:()=>request})} as any)).rejects.toMatchObject(new UnauthorizedException('MEMBER_SECURITY_LOCKED'));
    expect(request.user).toBeUndefined();
  });

  it('does not let the existing isolated Stage UAT path bypass a security lock',async()=>{
    const guard=new MemberAuthenticationGuard(
      {authenticate:jest.fn()} as any,{resolveVerifiedSubject:jest.fn()} as any,
      {person:{findUnique:jest.fn().mockResolvedValue({status:'EFFECTIVE',securityStatus:'SECURITY_LOCKED'})}} as any,
      {get:jest.fn((key:string)=>({STAGE_UAT_MEMBER_TOKEN:'test-token',UCELL_ENVIRONMENT:'STAGE',NODE_ENV:'staging'}[key]))} as any,
    );
    const request:any={headers:{authorization:'Bearer test-token'}};
    await expect(guard.canActivate({switchToHttp:()=>({getRequest:()=>request})} as any)).rejects.toMatchObject({response:{message:'STAGE_UAT_MEMBER_UNAVAILABLE'}});
    expect(request.user).toBeUndefined();
  });

  it('locks the Person and revokes every active LINE session in one transaction',async()=>{
    const tx:any={
      person:{findUnique:jest.fn().mockResolvedValue({personId:'person-1',securityStatus:'NORMAL'}),update:jest.fn().mockResolvedValue({personId:'person-1',securityStatus:'SECURITY_LOCKED'})},
      authSession:{updateMany:jest.fn().mockResolvedValue({count:3})},
    };
    const audit={write:jest.fn().mockResolvedValue(undefined)};
    const service=new AccountSecurityService({$transaction:(work:any)=>work(tx)} as any,audit as any);
    await expect(service.lockPerson('person-1','SUSPECTED_TAKEOVER',actor)).resolves.toEqual({personId:'person-1',securityStatus:'SECURITY_LOCKED',revokedSessionCount:3});
    expect(tx.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{personId:'person-1',provider:'LINE',status:'ACTIVE'}}));
    expect(audit.write).toHaveBeenCalledWith(tx,expect.objectContaining({action:'PERSON_SECURITY_LOCKED',reasonCode:'SUSPECTED_TAKEOVER'}));
  });

  it('runs an admin lock command through the idempotency transaction',async()=>{
    const tx:any={person:{findUnique:jest.fn().mockResolvedValue({personId:'person-1',securityStatus:'NORMAL'}),update:jest.fn().mockResolvedValue({personId:'person-1',securityStatus:'SECURITY_LOCKED'})},authSession:{updateMany:jest.fn().mockResolvedValue({count:1})}};
    const execute=jest.fn(async (_scope:string,_key:string,_request:unknown,work:any)=>({value:await work(tx),replayed:false}));
    const service=new AccountSecurityService({} as any,{write:jest.fn()} as any,{execute} as any);
    await expect(service.lockPersonCommand('person-1','SUSPECTED_TAKEOVER','idem-lock-1',actor)).resolves.toMatchObject({value:{revokedSessionCount:1},replayed:false});
    expect(execute).toHaveBeenCalledWith(`admin:person-security:lock:${actor.actorId}`,'idem-lock-1',{personId:'person-1',reasonCode:'SUSPECTED_TAKEOVER'},expect.any(Function));
  });

  it('requires a different approver for a LINE rebind',async()=>{
    const tx:any={accountRecoveryRequest:{findUnique:jest.fn().mockResolvedValue({accountRecoveryRequestId:'request-1',type:'LINE_REBIND',status:'PENDING',requesterActorId:actor.actorId})}};
    const service=new AccountSecurityService({$transaction:(work:any)=>work(tx)} as any,{write:jest.fn()} as any);
    await expect(service.approveLineRebind('request-1',actor)).rejects.toMatchObject({response:{code:'RECOVERY_DUAL_CONTROL_REQUIRED'}});
  });

  it('creates a rebind request with reference evidence and no raw credential',async()=>{
    const tx:any={
      person:{findUnique:jest.fn().mockResolvedValue({personId:'person-1'})},
      accountRecoveryRequest:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({accountRecoveryRequestId:'request-1',type:'LINE_REBIND',status:'PENDING',verificationEvidence:{reference:'VERIFY-20260924'}})},
    };
    const audit={write:jest.fn().mockResolvedValue(undefined)};
    const service=new AccountSecurityService({$transaction:(work:any)=>work(tx)} as any,audit as any);
    await expect(service.createLineRebindRequest('person-1',{verificationEvidence:{reference:'VERIFY-20260924'},idempotencyKey:'rebind-idem-1'},actor)).resolves.toMatchObject({status:'PENDING'});
    expect(tx.accountRecoveryRequest.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({verificationEvidence:{reference:'VERIFY-20260924'}})}));
  });
});
