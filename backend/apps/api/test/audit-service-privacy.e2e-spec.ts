import { AuditService } from '../src/common/audit/audit.service';

describe('G8 AuditService privacy minimization',()=>{
  it('records changed field names and hashes while redacting restricted values',async()=>{
    const create=jest.fn(async({data}:any)=>data);
    const result=await new AuditService().write({auditEvent:{create}} as any,{actorType:'MEMBER',actorId:'11111111-1111-4111-8111-111111111111',action:'MEMBER_PROFILE_UPDATED',entityType:'Person',entityId:'11111111-1111-4111-8111-111111111111',beforeData:{email:'private@example.test',phone:'0912'},afterData:{email:'changed@example.test',plan:'STARTER'},requestId:'r1',correlationId:'11111111-1111-4111-8111-111111111111'});
    expect(result.eventCode).toBe('MEMBER_PROFILE_UPDATED');expect(result.traceId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.beforeData).toEqual({email:'[REDACTED]',phone:'[REDACTED]'});expect(result.afterData).toEqual({email:'[REDACTED]',plan:'STARTER'});
    expect(result.changedFieldNames).toEqual(['email','phone','plan']);expect(result.beforeHash).toMatch(/^[0-9a-f]{64}$/);expect(result.afterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(result)).not.toContain('private@example.test');
  });
});
