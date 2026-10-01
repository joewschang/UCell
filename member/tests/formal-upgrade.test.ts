import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {consentFormalContract,getFormalRequiredContracts,saveFormalDraft} from '../src/memberData';
const envelope=(data:unknown,status=200)=>new Response(JSON.stringify({data,meta:{request_id:'formal-test',api_version:'v1',timestamp:'2026-09-17T00:00:00Z'}}),{status});
beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

it('reads formal contract, records consent and sends an individual spouse-aware draft',async()=>{
 const contract={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',type:'FORMAL_MEMBERSHIP',version:'V1',title:'Formal',content:'Terms',contentHash:'a'.repeat(64),required:true,effectiveFrom:'2026-01-01T00:00:00Z',effectiveTo:null,acceptedAt:null};
 const fetch=vi.fn().mockResolvedValueOnce(envelope([contract])).mockResolvedValueOnce(envelope({contractVersionId:contract.id,acceptedAt:'2026-09-17T00:00:00Z'},201)).mockResolvedValueOnce(envelope({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status:'DRAFT',version:1,applicantType:'INDIVIDUAL',nationalIdMasked:'***0001',spouseNationalIdMasked:'***0002',bankAccountMasked:'***9012',replayed:false},201));
 vi.stubGlobal('fetch',fetch);
 expect((await getFormalRequiredContracts(new AbortController().signal))[0].id).toBe(contract.id);
 await consentFormalContract(contract.id,'11111111-1111-4111-8111-111111111111');
 const input={formalContractVersionId:contract.id,applicantType:'INDIVIDUAL' as const,legalName:'測試會員',gender:'FEMALE',birthDate:'1990-01-02',nationalId:'TEST-ID-0001',hasSpouse:true,spouseName:'測試配偶',spouseNationalId:'TEST-ID-0002',communicationAddress:'TEST ADDRESS',phone:'+886900000001',email:'formal@example.invalid',bankCode:'012',bankAccount:'123456789012',accountHolder:'測試會員'};
 const saved=await saveFormalDraft(input,'22222222-2222-4222-8222-222222222222');
 expect(saved.status).toBe('DRAFT');
 expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual(input);
 expect(String(fetch.mock.calls[2][0])).not.toContain(input.nationalId);
 expect(String(fetch.mock.calls[2][0])).not.toContain(input.spouseNationalId);
 expect(String(fetch.mock.calls[2][0])).not.toContain(input.bankAccount);
});

it('accepts a legal-entity draft with a natural-person representative and no spouse',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(envelope({id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',status:'DRAFT',version:1,applicantType:'LEGAL_ENTITY',nationalIdMasked:'***0003',spouseNationalIdMasked:null,bankAccountMasked:'***9012',replayed:false},201));
 vi.stubGlobal('fetch',fetch);
 const input={formalContractVersionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',applicantType:'LEGAL_ENTITY' as const,legalEntityName:'測試有限公司',legalEntityRegistrationNo:'TEST-CORP-001',legalEntityRegisteredAddress:'TEST ADDRESS',representativeLegalName:'測試代表',representativeNationalId:'TEST-ID-0003',hasSpouse:false,communicationAddress:'TEST ADDRESS',phone:'+886900000002',email:'corp@example.invalid',bankCode:'012',bankAccount:'123456789012',accountHolder:'測試有限公司'};
 const saved=await saveFormalDraft(input,'33333333-3333-4333-8333-333333333333');
 expect(saved.applicantType).toBe('LEGAL_ENTITY');
 const body=JSON.parse(fetch.mock.calls[0][1].body);
 expect(body).toEqual(input);
 expect(body).not.toHaveProperty('spouseNationalId');
});
