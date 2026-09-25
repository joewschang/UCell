import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ExistingMemberLineLinkService } from '../src/modules/auth/existing-member-line-link.service';

describe('existing member LINE link boundary',()=>{
 const verifier:any={verify:jest.fn().mockResolvedValue({subject:'line-subject',expiresAt:Math.floor(Date.now()/1000)+3600})};
 const audit:any={write:jest.fn().mockResolvedValue(undefined)};
 it('creates a pending request only after verified LINE subject and without binding it',async()=>{
  const tx:any={person:{findUnique:jest.fn().mockResolvedValue({personId:'person-1',status:'EFFECTIVE'})},identityLink:{findUnique:jest.fn().mockResolvedValue(null),findFirst:jest.fn().mockResolvedValue(null)},accountRecoveryRequest:{create:jest.fn().mockResolvedValue({accountRecoveryRequestId:'r1'})}};
  const idempotency:any={execute:jest.fn(async (_s:string,_k:string,_v:unknown,work:any)=>({value:await work(tx),replayed:false}))};
  const service=new ExistingMemberLineLinkService({} as any,verifier,idempotency,audit);
  await expect(service.request({memberNo:'2609250001',verificationReference:'CASE-0001',idToken:'token',key:'idem-0001',requestId:'req'})).resolves.toMatchObject({value:{status:'PENDING'}});
  expect(tx.accountRecoveryRequest.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({type:'EXISTING_MEMBER_LINE_LINK',requestedProviderSubject:'line-subject'})}));
 });
 it('fails closed if the verified LINE subject is already bound',async()=>{
  const tx:any={person:{findUnique:jest.fn().mockResolvedValue({personId:'person-1',status:'EFFECTIVE'})},identityLink:{findUnique:jest.fn().mockResolvedValue({personId:'person-2'})}};
  const idempotency:any={execute:jest.fn(async (_s:string,_k:string,_v:unknown,work:any)=>({value:await work(tx),replayed:false}))};
  const service=new ExistingMemberLineLinkService({} as any,verifier,idempotency,audit);
  await expect(service.request({memberNo:'2609250001',verificationReference:'CASE-0001',idToken:'token',key:'idem-0002',requestId:'req'})).rejects.toBeInstanceOf(ConflictException);
 });
 it('does not bind or issue a session for an invalid or replayed completion token',async()=>{
  const tx:any={accountRecoveryRequest:{findUnique:jest.fn().mockResolvedValue({type:'EXISTING_MEMBER_LINE_LINK',status:'APPROVED',completionTokenHash:'wrong',completionTokenExpiresAt:new Date(Date.now()+60000),requestedProviderSubject:'line-subject'})}};
  const service=new ExistingMemberLineLinkService({$transaction:(work:any)=>work(tx)} as any,verifier,{} as any,audit);
  await expect(service.complete({requestId:'r1',completionToken:'wrong-token',idToken:'token'})).rejects.toBeInstanceOf(UnauthorizedException);
  expect(tx.accountRecoveryRequest.update).toBeUndefined();
 });
});
