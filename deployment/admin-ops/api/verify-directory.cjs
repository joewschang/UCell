const assert=require("node:assert/strict");
const {createRequire}=require("node:module");
const load=createRequire("/app/apps/api/dist/modules/member/formal-member-application.service.js");
const {AdminFormalMemberApplicationController}=load("./admin-formal-member-application.controller");
const {FormalMemberApplicationService}=load("./formal-member-application.service");
const {AdminRoleGuard}=load("../auth/admin-role.guard");
const {Reflector}=load("@nestjs/core");
const queryLog=[];
const sample=Array.from({length:103},(_,i)=>({
  formalMemberApplicationId:String(i),sourceChannel:"ADMIN_PAPER",status:"SUBMITTED",decisionReasonCode:null,
  applicantType:i===102?"LEGAL_ENTITY":"INDIVIDUAL",updatedAt:new Date(1700000000000-i*1000),
  person:{legalName:i===102?"林春梅":"申請人"+i,memberNo:"member"+i,mobile:i===102?"+886912345678":null,membershipState:"FORMAL_PENDING"},
  legalEntity:i===102?{registeredName:"春光公司",memberNo:"entity102",membershipState:"FORMAL_MEMBER"}:null
}));
const db={formalMemberApplication:{findMany:async args=>{
  queryLog.push(args);
  assert.equal(JSON.stringify(args).includes("snapshot"),false);
  assert.equal(JSON.stringify(args).includes("document"),false);
  assert.ok(args.take<=101);
  assert.deepEqual(args.orderBy,[{updatedAt:"desc"},{formalMemberApplicationId:"asc"}]);
  let rows=sample.filter(row=>args.where.AND.every(group=>group.OR.some(match=>{
    const [rel,condition]=Object.entries(match)[0];
    const [field,op]=Object.entries(condition)[0];
    return String(row[rel]?.[field]??"").toLowerCase().includes(op.contains.toLowerCase());
  })));
  return rows.slice(args.skip,args.skip+args.take);
}}};
function role(name) {
  const ctrl=AdminFormalMemberApplicationController;
  const req={url:"/api/v1/admin/formal-member-applications",user:{role:name}};
  return new AdminRoleGuard(new Reflector()).canActivate({switchToHttp:()=>({getRequest:()=>req}),getClass:()=>ctrl,getHandler:()=>ctrl.prototype.list});
}
async function main(){
  const service=Object.create(FormalMemberApplicationService.prototype);service.db=db;
  service.pii={decrypt:()=>{throw Error("Directory must not decrypt");}};
  const ctrl=new AdminFormalMemberApplicationController(service);
  assert.throws(()=>role("ORDER_OPS"));assert.equal(role("MEMBERSHIP_OPS"),true);assert.equal(role("COMPLIANCE_AUDIT"),true);
  assert.equal((await ctrl.list("SUBMITTED","20",undefined,"1")).meta.hasNext,true);
  assert.equal(queryLog.at(-1).where.status,"SUBMITTED");
  const last=await ctrl.list(undefined,"20",undefined,"6");
  assert.equal(last.data.length,3);assert.equal(last.meta.hasNext,false);assert.equal(last.data[2].id,"102");
  for(const q of ["春光公司","林春梅","TW0912-345-678","entity102","member102","春光 林春梅"]){
    const result=await ctrl.list(undefined,"20","ADMIN_PAPER","1",q);
    assert.equal(result.data.length,1);assert.equal(result.data[0].personName,"春光公司");
    assert.equal(result.data[0].displayMemberNo,"entity102");assert.equal(result.data[0].representativeName,"林春梅");
    assert.equal("mobile" in result.data[0],false);assert.equal("decisionReasonCode" in result.data[0],false);
    assert.equal(queryLog.at(-1).where.sourceChannel,"ADMIN_PAPER");
  }
  assert.equal((await ctrl.list(undefined,"20",undefined,"1","不存在")).data.length,0);
  for(const page of ["0","-1","1.2","99999999999999999"]) await assert.rejects(ctrl.list(undefined,"25",undefined,page));
  await assert.rejects(ctrl.list(undefined,"20",undefined,"1","x".repeat(121)));
  service.adminList=async input=>{assert.equal(input.take,100);return ["legacy"];};
  assert.deepEqual(await ctrl.list(undefined,"100"),["legacy"]);
  console.log("Passed KYC request authorization, metadata-only cross-page search, stable pagination, partial matches and original contract.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
