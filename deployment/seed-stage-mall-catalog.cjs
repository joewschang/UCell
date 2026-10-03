// User-authorized Stage catalog publication through the same services as Admin.
const {PrismaClient}=require('@prisma/client');
const {randomUUID,createHash}=require('node:crypto');
const {PackageConfigService}=require('/app/apps/api/dist/modules/package-config/package-config.service');
const {CommercialOfferingConfigService}=require('/app/apps/api/dist/modules/order/commercial-offering-config.service');
const {IdempotencyService}=require('/app/apps/api/dist/common/idempotency/idempotency.service');
const {AuditService}=require('/app/apps/api/dist/common/audit/audit.service');
async function main(){
 const u=new URL(process.env.DATABASE_URL),expires=new Date('2026-10-10T00:00:00Z'),now=new Date();
 if(process.env.UCELL_ENVIRONMENT!=='STAGE'||u.hostname!=='ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com'||u.pathname!=='/ucell_stage'||now>=expires)throw Error('STAGE_ONLY');
 const db=new PrismaClient(),actor='CODEX_USER_AUTHORIZED_STAGE_MALL',reference='USER_REQUEST_STAGE_MALL_20261003',summary=[];
 try{
  const products=[];
  for(const [sku,name,price] of [['STAGE-MALL-CORE-A','Stage 主商品 A（測試商品）','4800'],['STAGE-MALL-CORE-B','Stage 主商品 B（測試商品）','3000']]){
   const p=await db.productReference.upsert({where:{sku},update:{},create:{sku,displayName:name,currentPrice:price,currency:'TWD'}});
   let rule=await db.productRuleProfile.findFirst({where:{productId:p.productId,ruleVersionCode:'R1.0B'}});
   if(!rule)rule=await db.productRuleProfile.create({data:{productId:p.productId,effectiveFrom:now,effectiveTo:expires,gpvRate:0,pvRate:0,ruleVersionCode:'R1.0B',parameterSnapshotHash:createHash('sha256').update(reference+sku+'ZERO_GPV').digest('hex')}});
   products.push({p,rule});
  }
  const packages=new PackageConfigService(db);
  for(const code of ['ACTIVE_QUARTER','ACTIVE_HALF_YEAR','ACTIVE_YEAR']){
   const profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:code}});
   if(await db.packageProfileVersion.findFirst({where:{packageProfileId:profile.packageProfileId,status:'ACTIVE'}})){summary.push({code,status:'EXISTING_ACTIVE_PRESERVED'});continue;}
   const base=await db.packageProfileVersion.findUniqueOrThrow({where:{packageProfileId_version:{packageProfileId:profile.packageProfileId,version:1}}});
   let v=await db.packageProfileVersion.findFirst({where:{packageProfileId:profile.packageProfileId,createdByActor:actor},orderBy:{version:'desc'}});
   if(!v)v=await packages.addVersion(profile.packageProfileId,{displayName:base.displayName+'重購方案（Stage 測試）',currency:base.currency,priceAmount:base.priceAmount.toFixed(2),selectableProductQuantity:base.selectableProductQuantity,membershipEffect:base.membershipEffect,qualificationEffect:base.qualificationEffect,activeDurationUnit:base.activeDurationUnit,activeDurationValue:base.activeDurationValue,targetQualificationRequired:true,recognitionConfigRef:'R1.0B'},actor);
   if(v.status==='DRAFT'){await packages.setProducts(v.packageProfileVersionId,products.map(({rule})=>({productRuleProfileId:rule.productRuleProfileId,minQty:1,maxQty:base.selectableProductQuantity})));v=await packages.approve(v.packageProfileVersionId,reference,'PRODUCT_OWNER_USER_AUTHORIZATION');}
   if(v.status==='APPROVED')v=await packages.schedule(v.packageProfileVersionId,{effectiveFrom:now.toISOString(),effectiveTo:expires.toISOString()});
   if(v.status==='SCHEDULED')v=await packages.activate(v.packageProfileVersionId);
   summary.push({code,status:v.status,price:v.priceAmount.toFixed(2),quantity:v.selectableProductQuantity});
  }
  const audit=new AuditService();
  const seedAudit={write:(tx,input)=>audit.write(tx,{...input,actorType:'SYSTEM',actorId:undefined,actorRoleSnapshot:'USER_AUTHORIZED_STAGE_CATALOG_EXECUTOR',evidenceRef:reference})};
  const service=new CommercialOfferingConfigService(db,new IdempotencyService(db),seedAudit);
  const definitions=[...products.map(({p},i)=>({code:'STAGE_MALL_CORE_'+(i?'B':'A'),type:'CORE_PRODUCT',name:p.displayName,composition:[],selectionRule:{selectionGroup:'STAGE_CORE',requiredTotalQuantity:1,eligibleSkus:[p.sku]}})),{code:'STAGE_MALL_PROMO_AB',type:'PROMOTIONAL_BUNDLE',name:'Stage 促銷商品套組 A+B（測試組合）',composition:products.map(({p})=>({sku:p.sku,quantity:1}))}];
  for(const d of definitions){
   let offering=await db.commercialOffering.findUnique({where:{offeringCode:d.code}});
   if(!offering)offering=(await service.createOffering({offeringCode:d.code,offeringType:d.type},randomUUID(),reference,actor)).value;
   let v=await db.commercialOfferingVersion.findFirst({where:{commercialOfferingId:offering.commercialOfferingId,approvalReference:reference},orderBy:{version:'desc'}});
   if(!v)v=(await service.addVersion(offering.commercialOfferingId,{channels:['WEB_MEMBER'],composition:d.composition,selectionRule:d.selectionRule,recognitionProfile:{displayName:d.name,stageOnly:true,zeroGpv:true},approvalReference:reference,effectiveFrom:now.toISOString(),effectiveTo:expires.toISOString()},randomUUID(),reference,actor)).value;
   if(v.status==='DRAFT')v=(await service.approve(v.commercialOfferingVersionId,reference,randomUUID(),reference,'PRODUCT_OWNER_USER_AUTHORIZATION')).value;
   if(v.status==='APPROVED')v=(await service.activate(v.commercialOfferingVersionId,randomUUID(),reference,actor)).value;
   summary.push({code:d.code,type:d.type,status:v.status});
  }
  console.log(JSON.stringify({status:'STAGE_MALL_CATALOG_PUBLISHED',catalog:summary,qualificationPackagesPreserved:true,expiresAt:expires.toISOString(),realProducts:false}));
 }finally{await db.$disconnect()}
}
main().catch(e=>{console.error('STAGE_MALL_SEED_FAILED',e.code||e.name);process.exitCode=1});
