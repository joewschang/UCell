import { AdminStructuredExplainService } from '../src/modules/explain/admin-structured-explain.service';
const pid='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222',rid='33333333-3333-4333-8333-333333333333';
const query={resourceId:rid,time:{timezone:'Asia/Taipei' as const,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2026-02-01T00:00:00.000Z',asOf:'2026-02-01T00:00:00.000Z',knowledgeCutoff:'2026-02-02T00:00:00.000Z'}};
function fixture(){
 const request={user:{personId:pid,sessionId:sid,subject:'entra-private',provider:'ENTRA',role:'FINANCE'}};
 const session:any={provider:'ENTRA',personId:pid,subject:'entra-private',roleCode:'FINANCE',status:'ACTIVE',revokedAt:null,expiresAt:new Date(Date.now()+60000)};
 const db:any={authSession:{findUnique:jest.fn(async()=>session)},identityLink:{findUnique:jest.fn(async()=>({personId:pid}))},adminAccessGrant:{findMany:jest.fn(async()=>[{adminAccessGrantId:rid}])},reservoirBEffect:{findUnique:jest.fn(async()=>null)},reservoirLedgerEffect:{findUnique:jest.fn(async()=>null)},auditEvent:{create:jest.fn(async()=>({}))}};
 db.$transaction=jest.fn(async(f:any)=>f(db));return {request,db,session,service:new AdminStructuredExplainService(db)};
}
describe('Admin structured Explain live finance authorization',()=>{
 it('B uses the authorized source adapter and returns unavailable when evidence is absent',async()=>{const h=fixture();expect(await h.service.explain(h.request,'explainReservoirB',query)).toMatchObject({result:null,explainCode:'SOURCE_UNAVAILABLE',dataClassification:'FINANCE_CONFIDENTIAL'});expect(h.db.reservoirBEffect.findUnique).toHaveBeenCalledTimes(1);expect(h.db.adminAccessGrant.findMany).toHaveBeenCalledTimes(2);});
 it.each(['MEMBERSHIP_OPS','ORDER_OPS','MEMBER'])('denies role %s',async role=>{const h=fixture();h.request.user.role=role;await expect(h.service.explain(h.request,'explainReservoirA',query)).rejects.toMatchObject({status:403});expect(h.db.$transaction).not.toHaveBeenCalled();});
 it('does not accept local development bypass as a finance principal',async()=>{const h=fixture();h.request.user.provider='ADMIN_LOCAL';await expect(h.service.explain(h.request,'explainReservoirA',query)).rejects.toMatchObject({status:403});});
 it('requires a live nonambiguous grant',async()=>{const h=fixture();h.db.adminAccessGrant.findMany.mockResolvedValue([]);await expect(h.service.explain(h.request,'explainReservoirA',query)).rejects.toMatchObject({status:403});});
 it('rechecks grant after source access',async()=>{const h=fixture();h.db.reservoirLedgerEffect.findUnique.mockImplementation(async()=>{h.db.adminAccessGrant.findMany.mockResolvedValue([]);return null;});await expect(h.service.explain(h.request,'explainReservoirA',query)).rejects.toMatchObject({status:403});});
 it('rejects expired session even if request role claims FINANCE',async()=>{const h=fixture();h.session.expiresAt=new Date(0);await expect(h.service.explain(h.request,'explainReservoirA',query)).rejects.toMatchObject({status:403});});
});
