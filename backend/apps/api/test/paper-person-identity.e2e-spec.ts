import {PaperPersonIdentityService} from '../src/modules/order/paper-person-identity.service';

describe('PaperPersonIdentityService',()=>{
 const env=process.env;
 beforeEach(()=>{ process.env={ ...env, PAPER_IDENTITY_HMAC_KEY_V1:'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', PAPER_IDENTITY_DOCUMENT_POLICIES: JSON.stringify([{country:'ZZ',type:'TEST',pattern:'^[A-Z0-9]{6}$',allowedSeparators:'-'}]) }; });
 afterAll(()=>{process.env=env;});
 const input:any={paperApplicationNo:'PA-NEW-1',legalName:'Test Person',birthDate:'1990-01-01',documentCountry:'zz',documentType:'test',documentNo:'ab-1234',receivedAt:'2026-09-26T00:00:00.000Z',actorId:'11111111-1111-4111-8111-111111111111',requestId:'r1'};
 const audit={write:jest.fn().mockResolvedValue({})};
 it('reuses only exact fingerprint and does not allocate another member number',async()=>{
  const tx:any={paperPersonIdentityFingerprint:{findUnique:jest.fn().mockResolvedValue({person:{personId:'p1',memberNo:'M001',birthDate:new Date(input.birthDate)}})},person:{findFirst:jest.fn()}};
  const service=new PaperPersonIdentityService({} as any,audit as any);const result:any=await service.createOrReuse(tx,input);
  expect(result).toMatchObject({outcome:'EXACT_MATCH',person:{memberNo:'M001'}});expect(tx.person.create).toBeUndefined();expect(JSON.stringify(audit.write.mock.calls)).not.toContain(input.documentNo);
 });
 it('uses secondary signals only to block for review, never to auto-reuse',async()=>{
  const tx:any={paperPersonIdentityFingerprint:{findUnique:jest.fn().mockResolvedValue(null)},person:{findFirst:jest.fn().mockResolvedValue({personId:'p2',memberNo:'M002'})},paperIdentityDuplicateReview:{upsert:jest.fn().mockResolvedValue({paperIdentityDuplicateReviewId:'r',status:'DUPLICATE_REVIEW_REQUIRED'})}};
  const service=new PaperPersonIdentityService({} as any,audit as any);const result:any=await service.createOrReuse(tx,{...input,mobile:'0912'});
  expect(result.outcome).toBe('POSSIBLE_DUPLICATE');expect(tx.person.create).toBeUndefined();
 });
 it('fails closed for unconfigured document policy',async()=>{
  process.env.PAPER_IDENTITY_DOCUMENT_POLICIES='[]';const service=new PaperPersonIdentityService({} as any,audit as any);
  await expect(service.createOrReuse({} as any,input)).rejects.toMatchObject({response:{code:'INSUFFICIENT_OR_INVALID_IDENTITY'}});
 });
});


