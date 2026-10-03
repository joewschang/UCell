import { ExistingMemberLineLinkService } from '../src/modules/auth/existing-member-line-link.service';

describe('ExistingMemberLineLinkService approval separation',()=>{
 it('fails closed when the target Person attempts to approve their own link request',async()=>{
  const request:any={accountRecoveryRequestId:'request',personId:'person',type:'EXISTING_MEMBER_LINE_LINK',status:'PENDING'};
  const tx:any={accountRecoveryRequest:{findUnique:jest.fn().mockResolvedValue(request)}};
  const service=new ExistingMemberLineLinkService({$transaction:(work:any)=>work(tx)} as any,{} as any,{} as any,{write:jest.fn()} as any);
  await expect(service.approve('request','person','audit-request')).rejects.toMatchObject({response:{code:'EXISTING_MEMBER_LINK_SELF_APPROVAL_FORBIDDEN'}});
  expect(tx.accountRecoveryRequest.update).toBeUndefined();
 });
});
