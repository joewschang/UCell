const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const db=new PrismaClient();
(async()=>{await db.$transaction(async tx=>{
  const existing=await tx.couponDefinition.findUnique({where:{code:'UCELL168'}});
  if(existing){if(existing.ruleCode!=='CORE_BUY3_PAY2_V1')throw Error('Coupon code collision');return;}
  await tx.$executeRawUnsafe("ALTER TABLE commerce.coupon_definition DROP CONSTRAINT coupon_definition_category_check, DROP CONSTRAINT coupon_definition_rule_code_check, ADD CONSTRAINT coupon_definition_category_check CHECK ((category='QUALIFICATION' AND rule_code IN ('ENTRY_MINUS_14400_3_V1','LEADER_MINUS_57600_12_V1','LEADER_FULL_WAIVER_72600_15_V1','LEADER_GOODS_WAIVER_72000_15_V1')) OR (category='CORE_PRODUCT' AND rule_code='CORE_BUY3_PAY2_V1' AND code='UCELL168' AND max_uses=0 AND per_person_limit=0))");
  const row=await tx.couponDefinition.create({data:{code:'UCELL168',name:'主商品三盒付兩盒',category:'CORE_PRODUCT',ruleCode:'CORE_BUY3_PAY2_V1',description:'限所選活躍正式會員資格。每滿三盒折一盒，以最低價盒數折抵，可混搭、可重複使用。',packageCodes:['STARTER','ELITE','LEADER'],startsAt:new Date('2026-11-17T00:00:00+08:00'),endsAt:new Date('2027-03-01T00:00:00+08:00'),enabled:true,maxUses:0,perPersonLimit:0}});
  await new (require('/app/apps/api/dist/common/audit/audit.service').AuditService)().write(tx,{actorType:'SYSTEM',action:'COUPON_CREATED',entityType:'Coupon',entityId:row.id,afterData:JSON.parse(JSON.stringify(row)),requestId:require('crypto').randomUUID(),correlationId:require('crypto').randomUUID()});
});const c=await db.couponDefinition.findUniqueOrThrow({where:{code:'UCELL168'}}); console.log('VERIFIED_REPORT '+[c.code,c.enabled,c.endsAt.toISOString(),c.maxUses,c.perPersonLimit].join(' '));})().catch(e=>console.log('REPORT_CHECK_FAILED '+e.message)).finally(()=>db.$disconnect());

