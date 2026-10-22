const assert=require('node:assert/strict');
const {PrismaClient}=require('../backend/packages/database/node_modules/@prisma/client');
const {ConfigService}=require('../backend/apps/api/node_modules/@nestjs/config');
const {AiData}=require('../backend/apps/api/dist/modules/ai/ai-data');
const {AiProvider}=require('../backend/apps/api/dist/modules/ai/ai-provider');
const u=new URL(process.env.DATABASE_URL);assert.equal(u.hostname,'ucellprod-pg-m3z2zx4ohqyui.postgres.database.azure.com');assert.equal(u.pathname,'/ucell_production');
const db=new PrismaClient(),config=new ConfigService();
(async()=>{try{
 const [schema]=await db.$queryRaw`SELECT to_regclass('ai.turn')::text AS ai,to_regclass('commerce.coupon_redemption')::text AS coupon`;
 assert.ok(schema.coupon,'Production coupon source missing');
 const grants=await db.adminAccessGrant.findMany({where:{status:'ACTIVE',roleCode:'SUPER_ADMIN',validFrom:{lte:new Date()},OR:[{validTo:null},{validTo:{gt:new Date()}}]},select:{provider:true,providerSubject:true,personId:true}});
 assert.ok(grants.length,'No active production Super Admin');
 const data=new AiData(db,config),actor={audience:'ADMIN',id:'00000000-0000-4000-8000-000000000001'};
 for(const intent of ['MEMBERSHIP_COUNTS','SUMMARY','COUPON']){const answer=await data.execute(actor,{intent,...(intent==='COUPON'?{couponCode:'UCELL888'}:{})},null);assert.equal(answer.status,'AVAILABLE',intent+':'+answer.text);assert.ok(!answer.notice?.includes('Stage'));console.log(JSON.stringify({read:intent,status:answer.status,facts:answer.facts}));}
 const provider=new AiProvider(config);const plan=await provider.plan('目前會員數與會員資格數是多少？','ADMIN',AbortSignal.timeout(24000));assert.equal(plan.plan.intent,'MEMBERSHIP_COUNTS');
 console.log(JSON.stringify({result:'PASS',schema,activeSuperAdminGrants:grants.length,model:plan.model,tokens:plan.tokens,humanSessionsCreated:false}));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
