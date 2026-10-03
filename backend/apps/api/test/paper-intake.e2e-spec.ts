import {PaperIntakeService} from '../src/modules/order/paper-intake.service';

describe('PaperIntakeService',()=>{
 const base:any={paperApplicationNo:'PA-20260925-001',personId:'11111111-1111-4111-8111-111111111111',receivedAt:'2026-09-25T00:00:00.000Z',key:'paper-1',actorId:'22222222-2222-4222-8222-222222222222',requestId:'request-1'};
 const run=(tx:any)=>({execute:jest.fn(async(_scope:string,_key:string,_payload:any,work:any)=>({value:await work(tx),replayed:false}))});
 it('records provenance only for an existing Person and audits no sensitive paper payload',async()=>{
  const created:any={paperApplicationId:'33333333-3333-4333-8333-333333333333',paperApplicationNo:base.paperApplicationNo,status:'OPEN',receivedAt:new Date(base.receivedAt),evidenceDocumentRef:'secure://paper/1'};
  const tx:any={person:{findUnique:jest.fn().mockResolvedValue({personId:base.personId,memberNo:'2609000001',status:'DRAFT'})},paperApplication:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue(created)}};
  const audit={write:jest.fn()};const service=new PaperIntakeService({} as any,run(tx) as any,audit as any,{} as any);
  const result:any=await service.create({...base,evidenceDocumentRef:'secure://paper/1'});
  expect(result.value).toMatchObject({paperApplicationId:created.paperApplicationId,memberNo:'2609000001',status:'OPEN'});
  expect(audit.write).toHaveBeenCalledWith(tx,expect.objectContaining({action:'PAPER_APPLICATION_CREATED',afterData:expect.objectContaining({memberNo:'2609000001'})}));
  expect(JSON.stringify(audit.write.mock.calls)).not.toContain('nationalId');
 });
 it('fails closed when Person does not already exist',async()=>{
  const tx:any={person:{findUnique:jest.fn().mockResolvedValue(null)}};
  const service=new PaperIntakeService({} as any,run(tx) as any,{write:jest.fn()} as any,{} as any);
  await expect(service.create(base)).rejects.toMatchObject({response:{code:'PAPER_PERSON_NOT_FOUND'}});
 });
 it('rejects reuse of a paper number with different authoritative facts',async()=>{
  const tx:any={person:{findUnique:jest.fn().mockResolvedValue({personId:base.personId,memberNo:'2609000001'})},paperApplication:{findUnique:jest.fn().mockResolvedValue({personId:'other',receivedAt:new Date(base.receivedAt),evidenceDocumentRef:null})}};
  const service=new PaperIntakeService({} as any,run(tx) as any,{write:jest.fn()} as any,{} as any);
  await expect(service.create(base)).rejects.toMatchObject({response:{code:'PAPER_APPLICATION_IDENTITY_CONFLICT'}});
 });
 it('returns an operations read model with business identifiers and no Person UUID',async()=>{
  const db:any={paperApplication:{findMany:jest.fn().mockResolvedValue([{paperApplicationId:'internal-id',paperApplicationNo:'PA-1',status:'ORDER_CREATED',receivedAt:new Date('2026-09-26T00:00:00.000Z'),evidenceDocumentRef:'secure://paper/1',createdAt:new Date('2026-09-26T00:00:00.000Z'),updatedAt:new Date('2026-09-26T01:00:00.000Z'),person:{memberNo:'2609000001'},order:{orderNo:123n,status:'CONFIRMED',purpose:'ENTRY',netAmount:{toString:()=> '14400'},paidAt:null}}])}};
  const service=new PaperIntakeService(db,{} as any,{} as any,{} as any);
  const rows:any=await service.list({take:1});
  expect(rows[0]).toMatchObject({paperApplicationNo:'PA-1',memberNo:'2609000001',order:{orderNo:'123',purpose:'ENTRY'}});
  expect(rows[0]).not.toHaveProperty('paperApplicationId');
 });
});
