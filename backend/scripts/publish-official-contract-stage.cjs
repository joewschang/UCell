const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
function validateBundle(b){
 if(b?.schemaVersion!==1||b.contractType!=='FORMAL_MEMBERSHIP'||b.audience!=='FORMAL_MEMBER'||b.required!==true||b.versionCode!=='OFFICIAL-20261014'||typeof b.contentText!=='string'||!b.contentText.trim()||b.approvalReference!=='USER_DESIGNATED_OFFICIAL_DOCUMENTS_20261014')throw Error('OFFICIAL_CONTRACT_BUNDLE_INVALID');
 if(createHash('sha256').update(b.contentText,'utf8').digest('hex')!==b.contentHash)throw Error('OFFICIAL_CONTRACT_HASH_MISMATCH');
 if(!Array.isArray(b.sources)||b.sources.length!==2||b.sources.some(s=>!/^filings\/.+\.pdf$/.test(s.path)||!/^[a-f0-9]{64}$/.test(s.sha256)))throw Error('OFFICIAL_CONTRACT_SOURCES_INVALID');
 return b;
}
function requireStage(env=process.env){const u=new URL(env.DATABASE_URL);if(env.UCELL_ENVIRONMENT!=='STAGE'||u.hostname!=='ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com'||u.pathname!=='/ucell_stage')throw Error('OFFICIAL_CONTRACT_STAGE_ONLY');}
async function publish(db,input,at=new Date()){
 const b=validateBundle(input);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261014, 1)`;
  const existing=await tx.contractDocumentVersion.findUnique({where:{contractType_versionCode:{contractType:b.contractType,versionCode:b.versionCode}}});
  if(existing){if(existing.contentHash!==b.contentHash||existing.contentText!==b.contentText||existing.audience!==b.audience)throw Error('OFFICIAL_CONTRACT_VERSION_CONFLICT');return {versionId:existing.contractDocumentVersionId,version:b.versionCode,contentHash:b.contentHash,replayed:true};}
  const row=await tx.contractDocumentVersion.create({data:{contractType:b.contractType,versionCode:b.versionCode,title:b.title,contentText:b.contentText,contentHash:b.contentHash,audience:b.audience,required:true,effectiveFrom:at,approvalReference:b.approvalReference}});
  await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'OFFICIAL_CONTRACT_PUBLISHED',eventCode:'OFFICIAL_CONTRACT_PUBLISHED',environment:'STAGE',entityType:'ContractDocumentVersion',entityId:row.contractDocumentVersionId,requestId:'official-documents-20261014',correlationId:randomUUID(),afterData:{versionCode:b.versionCode,contentHash:b.contentHash,sourceHashes:b.sources.map(s=>s.sha256),approvalReference:b.approvalReference}}});
  return {versionId:row.contractDocumentVersionId,version:b.versionCode,contentHash:b.contentHash,replayed:false};
 });
}
module.exports={validateBundle,requireStage,publish};
if(require.main===module){(async()=>{if(!process.argv.includes('--apply'))throw Error('EXPLICIT_APPLY_REQUIRED');requireStage();const b=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../Docs/official/2026-10-14/contracts/formal-membership.json'),'utf8'));const {PrismaClient}=require('@prisma/client'),db=new PrismaClient();try{console.log(JSON.stringify(await publish(db,b)));}finally{await db.$disconnect();}})().catch(error=>{console.error(error.message);process.exitCode=1;});}
