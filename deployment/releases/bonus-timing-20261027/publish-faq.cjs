const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const {AdminFaqController}=require('/app/apps/api/dist/modules/public-website/faq.controller');
const db=new PrismaClient();
exports.publish=async items=>{try{
 const policy=await db.runtimeRuleParameter.findFirst({where:{parameterCode:'bonus.timing.policy',effectiveFrom:{lte:new Date()},effectiveTo:null}});
 if(policy?.valueJson!=='WEEK_CLOSE_PAYMENT_SNAPSHOT_20261027')throw Error('POLICY_NOT_ACTIVE');
 const controller=new AdminFaqController(db);
 for(const item of items){
  const rows=await db.$queryRaw`SELECT version,question,answer FROM content.faq_item WHERE id=${item.id}`;
  if(rows.length){if(rows[0].question===item.question&&rows[0].answer===item.answer)continue;throw Error('FAQ_EXISTING_CONFLICT');}
  await controller.item(item.id,{...item,published:true,version:0},{user:{subject:'USER_APPROVED_BONUS_TIMING_20261027'}});
 }
 console.log('FAQ_TIMING_PUBLISHED');
}finally{await db.$disconnect()}};
