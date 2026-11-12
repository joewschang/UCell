const assert=require('node:assert/strict');
const load=require('node:module').createRequire('/app/apps/api/dist/modules/admin-observability/admin-observability.module.js');
const {SponsorMapController}=load('./sponsor-map.controller');
const {BinaryMapController}=load('./binary-map.controller');
const {AdminObservabilityModule}=load('./admin-observability.module');
const {AdminRoleGuard}=load('../auth/admin-role.guard');
const {Reflector}=load('@nestjs/core');
async function main(){
 const controllers=Reflect.getMetadata('controllers',AdminObservabilityModule);
 assert.ok(controllers.includes(BinaryMapController)&&controllers.includes(SponsorMapController));
 const role=name=>new AdminRoleGuard(new Reflector()).canActivate({switchToHttp:()=>({getRequest:()=>({
   url:'/api/v1/admin/observability/organization/sponsor-map',user:{role:name}
 })}),getClass:()=>SponsorMapController,getHandler:()=>SponsorMapController.prototype.read});
 for(const name of ['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT'])assert.equal(role(name),true);
 for(const name of ['FINANCE','ORDER_OPS','MEMBER'])assert.throws(()=>role(name));
 const when=new Date();
 const node=(id,parentId)=>({id,parentId,createdAt:when,ballNo:null,name:'測試',plan:null,active:false,sponsorSequenceNo:null});
 const read=rows=>new SponsorMapController({$queryRaw:async()=>rows}).read();
 assert.equal((await read([])).meta.total,0);
 const long=Array.from({length:2500},(_,i)=>node('q'+i,i===0?null:'q'+(i-1)));
 long.push(node('secondRoot',null),node('left','q0'),node('middle','q0'),node('right','q0'));
 long.reverse();
 assert.deepEqual((await read(long)).data,long);
 for(const rows of [[node('a','b')],[node('a','a')],[node('a','b'),node('b','a')],[node('a',null),node('a',null)],
   [{...node('missing',null),createdAt:null}]])await assert.rejects(read(rows),e=>e.getStatus?.()===409&&e.getResponse().code==='SPONSOR_MAP_INCONSISTENT');
 console.log('Passed sponsor map registration, authorization, complete wide/deep forest and fail-closed integrity checks.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
