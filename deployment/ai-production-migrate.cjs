const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const {PrismaClient}=require('../backend/packages/database/node_modules/@prisma/client');
const u=new URL(process.env.DATABASE_URL);assert.equal(u.hostname,'ucellprod-pg-m3z2zx4ohqyui.postgres.database.azure.com');assert.equal(u.pathname,'/ucell_production');assert.equal(process.env.UCELL_ENVIRONMENT,'PRODUCTION');
const db=new PrismaClient(),name='20261022010000_ai_stage_assistant';
const sql=fs.readFileSync(path.join(__dirname,'../backend/packages/database/prisma/migrations',name,'migration.sql'),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
const author='9bd317d4-e2a9-4e3a-adc4-454627d84ea0'; // Release automation identity, never a human login/session.
(async()=>{try{await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ucell-ai-production-release'))::text`;
 const old=await tx.$queryRaw`SELECT checksum,finished_at FROM public._prisma_migrations WHERE migration_name=${name} AND rolled_back_at IS NULL`;
 if(old.length){assert.equal(old.length,1);assert.equal(old[0].checksum,checksum);assert.ok(old[0].finished_at);}
 else{for(const statement of sql.split(/;[ \t]*\r?\n|;\s*$/).filter(s=>s.trim()))await tx.$executeRawUnsafe(statement);await tx.$executeRaw`INSERT INTO public._prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES(${randomUUID()},${checksum},now(),${name},now(),1)`;}
 for(const item of require('./ai-stage-knowledge.json')){
  const existing=await tx.$queryRaw`SELECT id FROM ai.knowledge_version WHERE topic=${item.topic} AND source_ref=${item.sourceRef}`;if(existing.length)continue;
  const id=randomUUID(),hash=createHash('sha256').update(item.body+'|'+item.sourceRef).digest('hex');
  const [v]=await tx.$queryRaw`SELECT COALESCE(max(version),0)+1 AS version FROM ai.knowledge_version WHERE topic=${item.topic}`;
  await tx.$executeRaw`INSERT INTO ai.knowledge_version(id,topic,version,title,body,audience,source_ref,source_hash,effective_from,effective_to,status,author_id,revision) VALUES(${id}::uuid,${item.topic},${v.version},${item.title},${item.body},'ALL',${item.sourceRef},${hash},now(),${new Date(item.topic==='coupon'?'2027-01-31T16:00:00Z':'2027-10-21T16:00:00Z')},'IN_REVIEW',${author}::uuid,2)`;
  await tx.$executeRaw`INSERT INTO ai.audit_event(id,actor_id,audience,action,entity_id,outcome,details) VALUES(${randomUUID()}::uuid,${author}::uuid,'ADMIN','RELEASE_DRAFT_PREPARED',${id}::uuid,'IN_REVIEW','{"actorType":"RELEASE_AUTOMATION","humanApproval":false}'::jsonb)`;
 }
},{timeout:30000});
 const knowledge=await db.$queryRaw`SELECT status,count(*)::int AS count FROM ai.knowledge_version GROUP BY status`;
 console.log(JSON.stringify({migration:name,checksum,applied:true,knowledge,operationalDataChanged:false,humanSessionsCreated:false}));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
