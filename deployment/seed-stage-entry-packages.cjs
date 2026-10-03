const {PrismaClient}=require('@prisma/client');
const {randomUUID}=require('node:crypto');
const {PackageConfigService}=require('/app/apps/api/dist/modules/package-config/package-config.service');
const {IdempotencyService}=require('/app/apps/api/dist/common/idempotency/idempotency.service');
const {AuditService}=require('/app/apps/api/dist/common/audit/audit.service');
(async()=>{
 const u=new URL(process.env.DATABASE_URL),now=new Date(),expires=new Date('2026-10-10T00:00:00Z');
 if(process.env.UCELL_ENVIRONMENT!=='STAGE'||u.hostname!=='ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com'||u.pathname!=='/ucell_stage'||now>=expires)throw Error('STAGE_ONLY');
 const db=new PrismaClient(),reference='USER_REQUEST_ENTRY_PACKAGES_20261003',actor='SYSTEM_STAGE_ENTRY_PACKAGE_EXECUTOR',owner='USER_AUTHORIZED_ENTRY_PACKAGE_PUBLICATION',audit=new AuditService();
 const seedAudit={write:(tx,input)=>audit.write(tx,{...input,actorType:'SYSTEM',actorId:undefined,actorRoleSnapshot:actor,evidenceRef:reference})};
 const service=new PackageConfigService(db,new IdempotencyService(db),seedAudit),summary=[];
 try{
  const skus=['TIP-363','TIP-580','TIP-696','TIP-777','TIP-999'];
  const rules=await db.productRuleProfile.findMany({where:{product:{sku:{in:skus},isActive:true},ruleVersionCode:'R1.0B',effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},include:{product:true}});
  if(rules.length!==5||new Set(rules.map(r=>r.product.sku)).size!==5)throw Error('TIP_PRODUCT_POOL_NOT_READY');
  for(const [code,name,quantity,price] of [['STARTER','啟航',3,'14400'],['ELITE','菁英',9,'43200'],['LEADER','領袖',15,'72000']]){
   const profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:code}});
   const base=await db.packageProfileVersion.findFirstOrThrow({where:{packageProfileId:profile.packageProfileId,status:'ACTIVE'},orderBy:{version:'desc'}});
   if(base.priceAmount.toFixed(0)!==price||base.selectableProductQuantity!==quantity)throw Error('PACKAGE_BASELINE_MISMATCH');
   let v=await db.packageProfileVersion.findFirst({where:{packageProfileId:profile.packageProfileId,createdByActor:actor},orderBy:{version:'desc'}});
   if(!v)v=(await service.addVersionCommand(profile.packageProfileId,{displayName:name+'會員資格套組',currency:base.currency,priceAmount:price,selectableProductQuantity:quantity,membershipEffect:base.membershipEffect,qualificationEffect:base.qualificationEffect,targetQualificationRequired:false,recognitionConfigRef:base.recognitionConfigRef},randomUUID(),reference,actor)).value;
   if(v.status==='DRAFT'){await service.setProductsCommand(v.packageProfileVersionId,rules.map(r=>({productRuleProfileId:r.productRuleProfileId,minQty:1,maxQty:quantity,selectionIncrement:1,sortOrder:skus.indexOf(r.product.sku)})),randomUUID(),reference,actor);v=(await service.approveCommand(v.packageProfileVersionId,reference,randomUUID(),reference,owner)).value;}
   if(v.status==='APPROVED')v=(await service.scheduleCommand(v.packageProfileVersionId,{effectiveFrom:now.toISOString(),effectiveTo:expires.toISOString()},randomUUID(),reference,actor)).value;
   if(v.status==='SCHEDULED')v=(await service.activateCommand(v.packageProfileVersionId,randomUUID(),reference,actor)).value;
   const read=await service.memberProducts(v.packageProfileVersionId);
   if(read.products.length!==5||read.products.some(p=>!p.available))throw Error('ENTRY_PACKAGE_READBACK_FAILED');
   summary.push({code,name:v.displayName,quantity,price,status:v.status,versionId:v.packageProfileVersionId,products:read.products.map(p=>({sku:p.sku,available:p.available,maxQty:p.maxQty}))});
  }
  console.log(JSON.stringify({status:'STAGE_ENTRY_PACKAGES_PUBLISHED',packages:summary,stageOnly:true,expiresAt:expires.toISOString()}));
 }finally{await db.$disconnect()}
})().catch(e=>{console.error('STAGE_ENTRY_PACKAGES_FAILED',e.code||e.name);process.exitCode=1});
