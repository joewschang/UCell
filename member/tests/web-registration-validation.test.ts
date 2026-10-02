import {afterEach,expect,it,vi} from 'vitest';
import {completeRegistration,normalizeRegistrationMobile} from '../src/webAuth';
afterEach(()=>vi.unstubAllGlobals());
it('normalizes Taiwan mobile without changing international country codes',()=>{
 expect(normalizeRegistrationMobile('0912-345-678','TW')).toBe('+886912345678');
 expect(normalizeRegistrationMobile('+1 (202) 555-0123','TW')).toBe('+12025550123');
 expect(normalizeRegistrationMobile('0912345678','US')).toBe('0912345678');
});
it('shows server validation guidance without exposing generic codes or raw response data',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,json:async()=>({code:'DOMAIN_RULE_VIOLATION',message:['mobile must match regex']})})));
 const input={contractVersionId:'test',legalName:'Test',alias:'Test',gender:'UNDISCLOSED',birthDate:'1990-01-01',nationalityCode:'TW',identityDocumentType:'OTHER',identityDocumentNumber:'TEST',mobile:'0912345678',email:'test@example.invalid',password:'TEST-password-1234',googleIdToken:'TEST'};
 await expect(completeRegistration(input)).rejects.toThrow('手機號碼請使用');
});
