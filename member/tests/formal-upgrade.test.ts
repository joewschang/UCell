import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {consentFormalContract,getFormalRequiredContracts,saveFormalDraft} from '../src/memberData';
const envelope=(data:unknown,status=200)=>new Response(JSON.stringify({data,meta:{request_id:'formal-test',api_version:'v1',timestamp:'2026-09-17T00:00:00Z'}}),{status});
beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

it('reads formal contract, records consent and sends an individual spouse-aware identity-document draft',async()=>{
 const contract={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',type:'FORMAL_MEMBERSHIP',version:'V1',title:'Formal',content:'Terms',contentHash:'a'.repeat(64),required:true,effectiveFrom:'2026-01-01T00:00:00Z',effectiveTo:null,acceptedAt:null};
 const fetch=vi.fn().mockResolvedValueOnce(envelope([contract])).mockResolvedValueOnce(envelope({contractVersionId:contract.id,acceptedAt:'2026-09-17T00:00:00Z'},201)).mockResolvedValueOnce(envelope({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status:'DRAFT',version:1,applicantType:'INDIVIDUAL',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID',identityDocumentNumberMasked:'***0001',spouseIdentityDocumentNumberMasked:'***0002',bankAccountMasked:'***9012',replayed:false},201));
 vi.stubGlobal('fetch',fetch);
 expect((await getFormalRequiredContracts(new AbortController().signal))[0].id).toBe(contract.id);
 await consentFormalContract(contract.id,'11111111-1111-4111-8111-111111111111');
 const input={formalContractVersionId:contract.id,applicantType:'INDIVIDUAL' as const,legalName:'測試會員',gender:'FEMALE',birthDate:'1990-01-02',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID' as const,identityDocumentNumber:'TEST-ID-0001',hasSpouse:true,spouseName:'測試配偶',spouseNationalityCode:'TW',spouseIdentityDocumentType:'NATIONAL_ID' as const,spouseIdentityDocumentNumber:'TEST-ID-0002',communicationAddress:'TEST ADDRESS',phone:'+886900000001',email:'formal@example.invalid',bankCode:'012',bankAccount:'123456789012',accountHolder:'測試會員'};
 const saved=await saveFormalDraft(input,'22222222-2222-4222-8222-222222222222');
 expect(saved.status).toBe('DRAFT');
 expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual(input);
 expect(String(fetch.mock.calls[2][0])).not.toContain(input.identityDocumentNumber);
 expect(String(fetch.mock.calls[2][0])).not.toContain(input.spouseIdentityDocumentNumber);
 expect(String(fetch.mock.calls[2][0])).not.toContain(input.bankAccount);
});
