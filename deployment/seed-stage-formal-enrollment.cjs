// Explicit user authorization: Stage test catalog and blank contract only.
// Never run against Production or interpret this as formal document approval.
const {PrismaClient}=require('@prisma/client');
const {createHash,randomUUID}=require('node:crypto');
const {PackageConfigService}=require('/app/apps/api/dist/modules/package-config/package-config.service');
async function main(){
 const target=new URL(process.env.DATABASE_URL);
 if(process.env.UCELL_ENVIRONMENT!=='STAGE'||target.hostname!=='ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com'||target.pathname!=='/ucell_stage')throw Error('STAGE_ONLY');
 const db=new PrismaClient(),now=new Date(),expires=new Date('2026-10-10T00:00:00Z');
 if(now>=expires)throw Error('STAGE_AUTHORIZATION_EXPIRED');
 try{
  const contract=await db.contractDocumentVersion.upsert({where:{contractType_versionCode:{contractType:'FORMAL_MEMBER_STAGE_EMPTY',versionCode:'STAGE-EMPTY-20261003'}},update:{},create:{contractType:'FORMAL_MEMBER_STAGE_EMPTY',versionCode:'STAGE-EMPTY-20261003',title:'Stage 測試空白正式會員契約／隱私條款（非正式文件；上線前必須補件）',contentText:'',contentHash:createHash('sha256').update('').digest('hex'),audience:'FORMAL_MEMBER',required:true,effectiveFrom:now,effectiveTo:expires,approvalReference:'USER_APPROVED_STAGE_EMPTY_ONLY_20261003'}});
  const service=new PackageConfigService(db),result=[];
  for(const code of ['STARTER','ELITE','LEADER']){
   const profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:code}});
   const active=await db.packageProfileVersion.findFirst({where:{packageProfileId:profile.packageProfileId,status:'ACTIVE'}});
   if(active){result.push({code,status:'EXISTING_ACTIVE_PRESERVED'});continue;}
   // Preserve the governed initial price and quantity. Test products have zero GPV.
   const base=await db.packageProfileVersion.findUniqueOrThrow({where:{packageProfileId_version:{packageProfileId:profile.packageProfileId,version:1}}});
   const sku='STAGE-FORMAL-ENROLLMENT-TEST';
   const product=await db.productReference.upsert({where:{sku},update:{},create:{sku,displayName:'Stage 測試商品（非正式銷售；資格套組選購測試用）',currentPrice:'4800',currency:'TWD'}});
   let rule=await db.productRuleProfile.findFirst({where:{productId:product.productId,ruleVersionCode:'STAGE_FORMAL_ENROLLMENT_ZERO_GPV'}});
   if(!rule)rule=await db.productRuleProfile.create({data:{productId:product.productId,effectiveFrom:now,gpvRate:0,ruleVersionCode:'STAGE_FORMAL_ENROLLMENT_ZERO_GPV',parameterSnapshotHash:createHash('sha256').update('STAGE_ONLY_ZERO_GPV').digest('hex')}});
   let version=await db.packageProfileVersion.findFirst({where:{packageProfileId:profile.packageProfileId,createdByActor:'CODEX_STAGE_ENROLLMENT_20261003'},orderBy:{version:'desc'}});
   if(!version)version=await service.addVersion(profile.packageProfileId,{displayName:base.displayName+'（Stage 測試）',currency:base.currency,priceAmount:base.priceAmount.toFixed(2),selectableProductQuantity:base.selectableProductQuantity,membershipEffect:'FORMAL_ELIGIBILITY',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,recognitionConfigRef:'R1.0B'},'CODEX_STAGE_ENROLLMENT_20261003');
   if(version.status==='DRAFT'){await service.setProducts(version.packageProfileVersionId,[{productRuleProfileId:rule.productRuleProfileId,minQty:1,maxQty:base.selectableProductQuantity}]);version=await service.approve(version.packageProfileVersionId,'USER_AUTHORIZED_STAGE_TEST_CATALOG_20261003','PRODUCT_OWNER_USER_AUTHORIZATION');}
   if(version.status==='APPROVED')version=await service.schedule(version.packageProfileVersionId,{effectiveFrom:now.toISOString(),effectiveTo:expires.toISOString()});
   if(version.status==='SCHEDULED')version=await service.activate(version.packageProfileVersionId);
   result.push({code,status:version.status,price:version.priceAmount.toFixed(2),quantity:version.selectableProductQuantity});
  }
  await db.auditEvent.create({data:{actorType:'SYSTEM',action:'STAGE_FORMAL_ENROLLMENT_CATALOG_SEEDED',entityType:'StageTestConfiguration',requestId:'USER_REQUEST_FORMAL_ENROLLMENT_20261003',correlationId:randomUUID(),afterData:{catalog:result,blankContractId:contract.contractDocumentVersionId,productionAllowed:false,expiresAt:expires.toISOString()}}});
  console.log(JSON.stringify({status:'STAGE_TEST_CONFIGURATION_READY',catalog:result,formalContract:true,productionAllowed:false,expiresAt:expires.toISOString()}));
 }finally{await db.$disconnect()}
}
main().catch(e=>{console.error('STAGE_FORMAL_ENROLLMENT_SEED_FAILED',e.code||e.name);process.exitCode=1});
