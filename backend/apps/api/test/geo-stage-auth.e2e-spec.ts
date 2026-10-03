import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
describe('Geo Stage authentication bypass isolation',()=>{
 const tokens={authenticate:jest.fn(async()=>({provider:'ENTRA',role:'ORG_GEO_VIEW',sessionId:'TEST'}))};
 const config={get:(key:string)=>key==='ADMIN_AUTH_BYPASS'?'true':'staging'};
 const guard=new AdminAuthenticationGuard(tokens as any,config as any);
 const context=(request:any)=>({switchToHttp:()=>({getRequest:()=>request})} as any);
 it('rejects anonymous Geo requests even when Stage demo bypass is enabled',async()=>{
  await expect(guard.canActivate(context({url:'/api/v1/admin/organization/geo/summary?rootBallNo=A000001',headers:{}}))).rejects.toMatchObject({response:{code:'ADMIN_BEARER_REQUIRED'}});
 });
 it('authenticates the actual Geo bearer rather than replacing it with a demo super admin',async()=>{
  const request:any={url:'/api/v1/admin/organization/geo/export',headers:{authorization:'Bearer TEST_ONLY'}};
  await expect(guard.canActivate(context(request))).resolves.toBe(true);expect(request.user.provider).toBe('ENTRA');expect(request.user.role).toBe('ORG_GEO_VIEW');
 });
 it('preserves the existing non-Geo Stage demo flow',async()=>{
  const request:any={url:'/api/v1/admin/qualifications',headers:{}};
  await expect(guard.canActivate(context(request))).resolves.toBe(true);expect(request.user.provider).toBe('ADMIN_LOCAL');
 });
});
