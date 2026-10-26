import {networkProfile} from '../src/modules/auth/network-profile';
import {ContactVerificationService} from '../src/modules/auth/contact-verification.service';
import {MemberWebRegistrationService} from '../src/modules/auth/member-web-registration.service';
describe('minimal network membership',()=>{
 it('accepts phone-only without identity, birth date or gender',()=>expect(networkProfile({alias:'暱稱',mobile:'0912345678'})).toEqual({preferredName:'暱稱',mobile:'+886912345678',email:null,birthDate:null,genderCode:'UNDISCLOSED'}));
 it('accepts email-only and normalizes contact',()=>expect(networkProfile({alias:'暱稱',email:' TEST@example.com '})).toMatchObject({email:'test@example.com',mobile:null}));
 it.each([{alias:'暱稱'},{alias:'暱稱',mobile:'abc'},{alias:'暱稱',email:'bad'},{alias:'暱稱',email:'a@b.tw',birthDate:'2026-02-30'}])('rejects missing/invalid details',input=>expect(()=>networkProfile(input)).toThrow());
 it('leaves one supplied contact unverified when registration verification is disabled',async()=>{
  const service=new ContactVerificationService({} as any,{get:(key:string)=>key==='REGISTRATION_CONTACT_VERIFICATION_REQUIRED'?'false':undefined} as any,{} as any,{} as any,{} as any,{} as any);
  await expect(service.consumeRegistration({},'PERSON:test',{email:'test@example.com'})).resolves.toEqual({mobileVerifiedAt:null,emailVerifiedAt:null});
  await expect(service.consumeRegistration({},'PERSON:test',{mobile:'0912345678'})).resolves.toEqual({mobileVerifiedAt:null,emailVerifiedAt:null});
  await expect(service.consumeRegistration({},'PERSON:test',{})).rejects.toThrow();
 });
 it('does not query duplicate people using an absent phone',async()=>{
  const findFirst=jest.fn(async()=>null),create=jest.fn(async(input:any)=>({...input.data,personId:'person',memberNo:'2610009999'}));
  const tx:any={$queryRaw:jest.fn(),person:{findFirst,create},identityLink:{findUnique:async()=>null,create:async()=>({})},contractDocumentVersion:{findFirst:async()=>({contractDocumentVersionId:'contract',contentHash:'hash'})},memberPasswordCredential:{create:async()=>({})},consentEvidence:{create:async()=>({})},personMembershipStateEvent:{create:async()=>({})},authSession:{create:async()=>({authSessionId:'session'})}};
  const idempotency:any={execute:async(_s:string,_k:string,_i:unknown,fn:any)=>({value:await fn(tx),replayed:false})};
  const contacts:any={consumeRegistration:async()=>({mobileVerifiedAt:null,emailVerifiedAt:null})};
  const service=new MemberWebRegistrationService(tx,idempotency,{} as any,{} as any,{} as any,{} as any,contacts);
  await service.complete({contractVersionId:'contract',accepted:true,alias:'Nickname',email:'test@example.com',localAccount:'qauser',password:'Test1234'},'key');
  expect(findFirst).toHaveBeenCalledTimes(1);expect(findFirst.mock.calls[0][0]).toMatchObject({where:{email:{equals:'test@example.com'}}});expect(create.mock.calls[0][0].data).toMatchObject({legalName:'',mobile:null,preferredName:'Nickname'});
 });
});
