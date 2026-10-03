// Publish the user-supplied main products; preserve existing order/configuration history.
const {PrismaClient}=require('@prisma/client');
const {randomUUID,createHash}=require('node:crypto');
const {PackageConfigService}=require('/app/apps/api/dist/modules/package-config/package-config.service');
const {CommercialOfferingConfigService}=require('/app/apps/api/dist/modules/order/commercial-offering-config.service');
const {IdempotencyService}=require('/app/apps/api/dist/common/idempotency/idempotency.service');
const {AuditService}=require('/app/apps/api/dist/common/audit/audit.service');
const catalog=require('./tip-main-products.json');
async function main(){
 const u=new URL(process.env.DATABASE_URL),now=new Date(),expires=new Date('2026-10-10T00:00:00Z');
 if(process.env.UCELL_ENVIRONMENT!=='STAGE'||u.hostname!=='ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com'||u.pathname!=='/ucell_stage'||now>=expires)throw Error('STAGE_ONLY');
 const db=new PrismaClient(),actor='SYSTEM_STAGE_TIP_CATALOG_EXECUTOR',owner='USER_AUTHORIZED_STAGE_TIP_CATALOG',reference='USER_REQUEST_TIP_MAIN_PRODUCTS_20261003_V1';
 const audit=new AuditService(),seedAudit={write:(tx,input)=>audit.write(tx,{...input,actorType:'SYSTEM',actorId:undefined,actorRoleSnapshot:actor,evidenceRef:reference})};
 const idempotency=new IdempotencyService(db),offers=new CommercialOfferingConfigService(db,idempotency,seedAudit),packages=new PackageConfigService(db,idempotency,seedAudit),products=[],summary=[];
 try{
  for(const item of catalog){
   const p=await db.$transaction(async tx=>{const before=await tx.productReference.findUnique({where:{sku:item.sku}});const row=await tx.productReference.upsert({where:{sku:item.sku},update:{displayName:item.sku+' '+item.name},create:{sku:item.sku,displayName:item.sku+' '+item.name,currentPrice:'4800',currency:'TWD'}});await seedAudit.write(tx,{actorType:'SYSTEM',action:'STAGE_TIP_PRODUCT_CONFIGURED',entityType:'ProductReference',entityId:row.productId,beforeData:before?{sku:before.sku,currentPrice:before.currentPrice.toFixed(2)}:undefined,afterData:{sku:row.sku,currentPrice:row.currentPrice.toFixed(2),pricingPurpose:'STAGE_TEST_ONLY',source:item.source},requestId:reference,correlationId:randomUUID()});return row;});
   let rule=await db.productRuleProfile.findFirst({where:{productId:p.productId,ruleVersionCode:'R1.0B',effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
   if(!rule)rule=await db.productRuleProfile.create({data:{productId:p.productId,effectiveFrom:now,effectiveTo:expires,gpvRate:0,pvRate:0,ruleVersionCode:'R1.0B',parameterSnapshotHash:createHash('sha256').update(reference+item.sku+'ZERO_GPV').digest('hex')}});
   products.push({item,p,rule});
   await publish({code:'STAGE_CORE_'+item.sku.replace('-','_'),type:'CORE_PRODUCT',channels:['WEB_MEMBER'],composition:[],selectionRule:{selectionGroup:'TIP_MAIN_PRODUCT',requiredTotalQuantity:1,eligibleSkus:[item.sku]},recognitionProfile:{displayName:p.displayName,coverImage:item.coverImage,packaging:item.packaging,source:item.source,stageOnly:true,priceLabel:'Stage 測試價：NT$ '+p.currentPrice.toFixed(0)+'／盒；正式售價待確認'}});
  }
  // Retire sample main-product web listings through a governed replacement version.
  // Products remain available to existing sample promotion/order snapshots.
  for(const code of ['STAGE_MALL_CORE_A','STAGE_MALL_CORE_B']){
   const o=await db.commercialOffering.findUnique({where:{offeringCode:code}});
   if(!o)continue;
   const old=await db.commercialOfferingVersion.findFirst({where:{commercialOfferingId:o.commercialOfferingId,status:'ACTIVE'},orderBy:{version:'desc'}});
   if(old)await publish({code,type:'CORE_PRODUCT',channels:['ADMIN'],composition:old.composition,selectionRule:old.selectionRule,recognitionProfile:{...old.recognitionProfile,webListingReplacedByTipProducts:true}});
  }
  for(const code of ['STARTER','ELITE','LEADER','ACTIVE_QUARTER','ACTIVE_HALF_YEAR','ACTIVE_YEAR']){
   const profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:code}});
   const base=await db.packageProfileVersion.findFirstOrThrow({where:{packageProfileId:profile.packageProfileId,status:'ACTIVE'},orderBy:{version:'desc'}});
   let v=await db.packageProfileVersion.findFirst({where:{packageProfileId:profile.packageProfileId,createdByActor:actor},orderBy:{version:'desc'}});
   if(!v)v=(await packages.addVersionCommand(profile.packageProfileId,{displayName:base.displayName,currency:base.currency,priceAmount:base.priceAmount.toFixed(2),selectableProductQuantity:base.selectableProductQuantity,membershipEffect:base.membershipEffect,qualificationEffect:base.qualificationEffect,activeDurationUnit:base.activeDurationUnit??undefined,activeDurationValue:base.activeDurationValue??undefined,targetQualificationRequired:base.targetQualificationRequired,memberEligibilityPolicyRef:base.memberEligibilityPolicyRef??undefined,recognitionConfigRef:base.recognitionConfigRef??undefined},randomUUID(),reference,actor)).value;
   if(v.status==='DRAFT'){await packages.setProductsCommand(v.packageProfileVersionId,products.map(({rule},i)=>({productRuleProfileId:rule.productRuleProfileId,minQty:1,maxQty:base.selectableProductQuantity,sortOrder:i})),randomUUID(),reference,actor);v=(await packages.approveCommand(v.packageProfileVersionId,reference,randomUUID(),reference,owner)).value;}
   if(v.status==='APPROVED')v=(await packages.scheduleCommand(v.packageProfileVersionId,{effectiveFrom:now.toISOString(),effectiveTo:expires.toISOString()},randomUUID(),reference,actor)).value;
   if(v.status==='SCHEDULED')v=(await packages.activateCommand(v.packageProfileVersionId,randomUUID(),reference,actor)).value;
   summary.push({code,status:v.status,price:v.priceAmount.toFixed(2),quantity:v.selectableProductQuantity,productPool:catalog.map(p=>p.sku)});
  }
  const listed=await offers.memberList('WEB_MEMBER');
  const main=listed.filter(o=>o.offeringTypeLabel==='主商品').map(o=>({code:o.offeringCode,name:o.recognitionProfile.displayName,cover:o.recognitionProfile.coverImage,pricing:o.recognitionProfile.priceLabel}));
  if(main.length!==5||main.some(o=>!o.code.startsWith('STAGE_CORE_TIP_')))throw Error('TIP_MAIN_CATALOG_READBACK_FAILED');
  console.log(JSON.stringify({status:'STAGE_TIP_MAIN_PRODUCTS_PUBLISHED',mainProducts:main,packages:summary,pricing:'STAGE_TEST_ONLY',expiresAt:expires.toISOString(),automaticFormalApproval:false}));
 }finally{await db.$disconnect()}
 async function publish(d){
  let o=await db.commercialOffering.findUnique({where:{offeringCode:d.code}});
  if(!o)o=(await offers.createOffering({offeringCode:d.code,offeringType:d.type},randomUUID(),reference,actor)).value;
  let v=await db.commercialOfferingVersion.findFirst({where:{commercialOfferingId:o.commercialOfferingId,approvalReference:reference},orderBy:{version:'desc'}});
  if(!v)v=(await offers.addVersion(o.commercialOfferingId,{channels:d.channels,composition:d.composition,selectionRule:d.selectionRule,recognitionProfile:d.recognitionProfile,approvalReference:reference,effectiveFrom:now.toISOString(),effectiveTo:expires.toISOString()},randomUUID(),reference,actor)).value;
  if(v.status==='DRAFT')v=(await offers.approve(v.commercialOfferingVersionId,reference,randomUUID(),reference,owner)).value;
  if(v.status==='APPROVED')v=(await offers.activate(v.commercialOfferingVersionId,randomUUID(),reference,actor)).value;
  return v;
 }
}
main().catch(e=>{console.error('STAGE_TIP_MAIN_PRODUCTS_FAILED',e.code||e.name);process.exitCode=1});
