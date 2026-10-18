import { PrismaClient } from '@prisma/client';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';
import { QualificationWorkflowController } from '../src/modules/qualification/qualification-workflow.controller';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
describe('User-approved manual ERP payment reference policy',()=>{
 const db=new PrismaClient({datasources:{db:{url}}});
 const service=new QualificationWorkflowService(db as any,{} as any);
 const controller=new QualificationWorkflowController(service);
 let principal:any;
 beforeAll(async()=>{const p=await db.person.create({data:{legalName:'ERP 收款確認管理員'}});principal={personId:p.personId,provider:'ENTRA',role:'SUPER_ADMIN'};});
 afterAll(()=>db.$disconnect());
 async function fixture(from='STARTER',to='ELITE'){
  const p=await db.person.create({data:{legalName:'SYNTHETIC ERP MEMBER'}});
  const q=await db.qualification.create({data:{currentHolderPersonId:p.personId,planLevelCode:from,status:'EFFECTIVE'}});
  await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:from,effectiveFrom:new Date('2024-01-01Z'),sourceType:'TEST'}});
  return service.submit({qualificationId:q.qualificationId,workflowType:'UPGRADE',targetPlanCode:to,payload:{reviewFeePaid:true,manualPayment:{confirmedBy:'forged',erpPaymentVoucher:'FORGED'}}});
 }
 async function unchanged(wf:any){
  expect(await db.qualificationWorkflow.findUnique({where:{qualificationWorkflowId:wf.qualificationWorkflowId}})).toMatchObject({status:'SUBMITTED'});
  expect(await db.qualificationPlanHistory.count({where:{qualificationId:wf.qualificationId}})).toBe(1);
  expect(await db.qualification.findUnique({where:{qualificationId:wf.qualificationId}})).toMatchObject({planLevelCode:'STARTER'});
 }
 it.each([['STARTER','ELITE'],['ELITE','LEADER'],['STARTER','LEADER']])('%s -> %s accepts manual ERP reference without local payment orders',async(from,to)=>{
  const wf=await fixture(from,to);
  expect((wf.payload as any).manualPayment).toBeUndefined();
  expect(await db.order.count({where:{qualificationId:wf.qualificationId}})).toBe(0);
  const {data}=await controller.approve(wf.qualificationWorkflowId,{paymentConfirmed:true,erpPaymentVoucher:'  ERP-001（差額及審核費合併收款）  '},{user:principal});
  expect(data.status).toBe('EFFECTIVE');
  expect((data.payload as any).manualPayment).toEqual({paymentConfirmed:true,erpPaymentVoucher:'ERP-001（差額及審核費合併收款）',confirmedBy:principal.personId,confirmedByName:'ERP 收款確認管理員',confirmedAt:data.approvedAt!.toISOString(),method:'MANUAL_ERP_REFERENCE'});
  expect(await db.qualification.findUnique({where:{qualificationId:wf.qualificationId}})).toMatchObject({planLevelCode:to});
  expect(await db.auditEvent.count({where:{entityId:wf.qualificationId,actorId:principal.personId}})).toBe(1);
  await expect(controller.approve(wf.qualificationWorkflowId,{paymentConfirmed:true,erpPaymentVoucher:'REPLACED'},{user:principal})).rejects.toThrow('Workflow is not SUBMITTED');
  expect(await db.qualificationPlanHistory.count({where:{qualificationId:wf.qualificationId}})).toBe(2);
  const stored=await db.qualificationWorkflow.findUniqueOrThrow({where:{qualificationWorkflowId:wf.qualificationWorkflowId}});
  expect((stored.payload as any).manualPayment).toEqual((data.payload as any).manualPayment);
 });
 it.each([undefined,false,'true',1])('confirmation %j cannot be substituted by legacy payload',async value=>{
  const wf=await fixture();
  await expect(controller.approve(wf.qualificationWorkflowId,{paymentConfirmed:value as any,erpPaymentVoucher:'ERP-001'},{user:principal})).rejects.toThrow('UPGRADE_PAYMENT_CONFIRMATION_REQUIRED');await unchanged(wf);
 });
 it.each([undefined,'','   ',123,'x'.repeat(501),'ERP\n001'])('invalid reference %j leaves workflow unchanged',async value=>{
  const wf=await fixture();await expect(controller.approve(wf.qualificationWorkflowId,{paymentConfirmed:true,erpPaymentVoucher:value as any},{user:principal})).rejects.toThrow('ERP_PAYMENT_VOUCHER_REQUIRED_OR_INVALID');await unchanged(wf);
 });
 it.each(['COMPLIANCE_AUDIT','FINANCE','MEMBER'])('role %s cannot confirm payment and approve',async role=>{
  const wf=await fixture();await expect(controller.approve(wf.qualificationWorkflowId,{paymentConfirmed:true,erpPaymentVoucher:'ERP-001'},{user:{...principal,role}})).rejects.toThrow('PAYMENT_CONFIRMER_REQUIRED');await unchanged(wf);
 });
 it('audit failure rolls back plan and payment confirmation atomically',async()=>{
  const wf=await fixture();const broken=new QualificationWorkflowService({$transaction:(fn:any,options:any)=>db.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='auditEvent')return {create:async()=>{throw Error('AUDIT_UNAVAILABLE');}};return (target as any)[key];}})),options)} as any,{} as any);
  await expect(broken.approve(wf.qualificationWorkflowId,undefined,principal,{paymentConfirmed:true,erpPaymentVoucher:'ERP-001'})).rejects.toThrow('AUDIT_UNAVAILABLE');await unchanged(wf);
 });
 it.each(['STAGE_OK','PRODUCTION','NOT_STAGE','BYPASS_OFF','WRONG_ROLE','WRONG_SUBJECT'])('Stage test admin boundary %s',async mode=>{
  const keys=['UCELL_ENVIRONMENT','NODE_ENV','ADMIN_AUTH_BYPASS'];const old=keys.map(k=>process.env[k]);
  try{
   process.env.UCELL_ENVIRONMENT=mode==='NOT_STAGE'?'LOCAL':'STAGE';process.env.NODE_ENV=mode==='PRODUCTION'?'production':'staging';process.env.ADMIN_AUTH_BYPASS=mode==='BYPASS_OFF'?'false':'true';
   const wf=await fixture();const p={provider:'ADMIN_LOCAL',sessionId:'DEV_BYPASS',subject:mode==='WRONG_SUBJECT'?'forged':'dev-bypass',role:mode==='WRONG_ROLE'?'FINANCE':'SUPER_ADMIN'};
   const action=controller.approve(wf.qualificationWorkflowId,{paymentConfirmed:true,erpPaymentVoucher:'STAGE-ERP-TEST'},{user:p});
   if(mode==='STAGE_OK'){const {data}=await action;expect((data.payload as any).manualPayment).toMatchObject({confirmedBy:null,confirmedByName:'Stage Super Admin（測試管理員）',stageTestAdmin:true,confirmedBySubject:'dev-bypass'});expect(await db.auditEvent.findFirst({where:{entityId:wf.qualificationId}})).toMatchObject({actorType:'STAGE_TEST_ADMIN',actorId:null});}
   else{await expect(action).rejects.toThrow('PAYMENT_CONFIRMER_REQUIRED');await unchanged(wf);}
  }finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
 });
});
