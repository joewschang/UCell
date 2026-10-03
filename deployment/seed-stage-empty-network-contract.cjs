// Product Owner explicitly approved empty documents for Stage only, 2026-10-03.
// Never use this placeholder or its consent evidence for Production acceptance.
const {createHash}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
async function main(){
 const target=new URL(process.env.DATABASE_URL);
 if(process.env.UCELL_ENVIRONMENT!=='STAGE'||target.hostname!=='ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com'||target.pathname!=='/ucell_stage')throw Error('STAGE_ONLY');
 const db=new PrismaClient();
 try{
  const row=await db.contractDocumentVersion.upsert({where:{contractType_versionCode:{contractType:'NETWORK_MEMBER_STAGE_EMPTY',versionCode:'STAGE-EMPTY-20261003'}},update:{},create:{contractType:'NETWORK_MEMBER_STAGE_EMPTY',versionCode:'STAGE-EMPTY-20261003',title:'Stage 測試空白文件：會員契約／隱私條款（非正式文件；上線前必須補件）',contentText:'',contentHash:createHash('sha256').update('').digest('hex'),audience:'NETWORK_MEMBER',required:true,effectiveFrom:new Date('2026-10-02T00:00:00Z'),effectiveTo:new Date('2026-10-10T00:00:00Z'),approvalReference:'USER_APPROVED_STAGE_EMPTY_ONLY_20261003'}});
  console.log(JSON.stringify({status:'STAGE_EMPTY_CONTRACT_CREATED',versionId:row.contractDocumentVersionId,expiresAt:row.effectiveTo.toISOString(),productionAllowed:false}));
 }finally{await db.$disconnect()}
}
main().catch(()=>{console.error('STAGE_EMPTY_CONTRACT_FAILED');process.exitCode=1});
