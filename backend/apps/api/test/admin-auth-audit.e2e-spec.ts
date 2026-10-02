import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from '../src/modules/auth/admin-auth.service';

describe('G8 Admin authentication audit evidence',()=>{
 const audit={write:jest.fn(async()=>({}))};
 const base=()=>{const tx:any={};return {tx,prisma:{$transaction:jest.fn(async(fn:any)=>fn(tx)),adminAccessGrant:{findFirst:jest.fn()},identityLink:{findUnique:jest.fn(),create:jest.fn()},authSession:{update:jest.fn()}},entra:{verify:jest.fn()},sessions:{issue:jest.fn()},config:{get:jest.fn(()=>3600)}};};
 it('records a safe LOGIN_SUCCEEDED event',async()=>{
  const f=base();f.entra.verify.mockResolvedValue({subject:'subject',email:'private@example.test',displayName:'Private'});f.prisma.adminAccessGrant.findFirst.mockResolvedValue({personId:'11111111-1111-4111-8111-111111111111',roleCode:'SUPER_ADMIN',person:{legalName:'Private'}});f.prisma.identityLink.findUnique.mockResolvedValue({personId:'11111111-1111-4111-8111-111111111111'});f.sessions.issue.mockResolvedValue({sessionId:'22222222-2222-4222-8222-222222222222',accessToken:'secret'});
  await new AdminAuthService(f.prisma as any,f.entra as any,f.sessions as any,f.config as any,audit as any).exchangeEntra('token','44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333');
  expect(audit.write).toHaveBeenCalledWith(f.tx,expect.objectContaining({action:'LOGIN_SUCCEEDED',eventCode:'LOGIN_SUCCEEDED',actorRoleSnapshot:'SUPER_ADMIN'}));expect(JSON.stringify(audit.write.mock.calls)).not.toContain('private@example.test');
 });
 it('records a controlled LOGIN_FAILED event and rethrows',async()=>{
  const f=base();f.entra.verify.mockRejectedValue(new UnauthorizedException({code:'AUTH_TOKEN_INVALID'}));
  await expect(new AdminAuthService(f.prisma as any,f.entra as any,f.sessions as any,f.config as any,audit as any).exchangeEntra('token','44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333')).rejects.toBeInstanceOf(UnauthorizedException);
  expect(audit.write).toHaveBeenCalledWith(f.tx,expect.objectContaining({action:'LOGIN_FAILED',result:'DENIED',reasonCode:'AUTH_TOKEN_INVALID'}));
 });
 it('preserves the original controlled denial when audit persistence is unavailable',async()=>{
  const f=base();f.entra.verify.mockRejectedValue(new UnauthorizedException({code:'AUTH_TOKEN_INVALID'}));f.prisma.$transaction.mockRejectedValue(new Error('audit database unavailable'));
  await expect(new AdminAuthService(f.prisma as any,f.entra as any,f.sessions as any,f.config as any,audit as any).exchangeEntra('token','44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333')).rejects.toMatchObject({response:{code:'AUTH_TOKEN_INVALID'}});
 });
});
