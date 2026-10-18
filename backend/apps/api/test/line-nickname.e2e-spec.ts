import {MemberService} from '../src/modules/member/member.service';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';

describe('LINE nickname synchronization',()=>{
 afterEach(()=>jest.restoreAllMocks());
 function fixture(displayName?:string,status='ACTIVE'){
  const update=jest.fn(),binding={identityLinkId:'binding',personId:'person',displayName:'Old',status,person:{status:'EFFECTIVE',securityStatus:'NORMAL'}};
  const tx={identityLink:{findUnique:jest.fn().mockResolvedValue(binding),update},idempotencyRecord:{create:jest.fn()}};
  const db={$transaction:jest.fn(async(work:any)=>work(tx))};
  jest.spyOn(IdentityTokenService.prototype,'issue').mockResolvedValue({} as any);
  const service=new MemberService(db as any,{verify:jest.fn().mockResolvedValue({subject:'verified-subject',expiresAt:Math.floor(Date.now()/1000)+600,displayName})} as any,{} as any,{} as any);
  return {service,update};
 }
 it('updates the bound nickname from a verified LINE login',async()=>{const f=fixture('新的 LINE 暱稱');await f.service.exchange('token');expect(f.update).toHaveBeenCalledWith({where:{identityLinkId:'binding'},data:{displayName:'新的 LINE 暱稱'}});});
 it('keeps the last known nickname when LINE omits the name',async()=>{const f=fixture();await f.service.exchange('token');expect(f.update).not.toHaveBeenCalled();});
 it('never refreshes a revoked binding or issues a session',async()=>{const f=fixture('New','REVOKED');await expect(f.service.exchange('token')).rejects.toThrow();expect(f.update).not.toHaveBeenCalled();expect(IdentityTokenService.prototype.issue).not.toHaveBeenCalled();});
});
