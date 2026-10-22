const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const {PrismaClient}=require('../backend/packages/database/node_modules/@prisma/client');
const url=new URL(process.env.DATABASE_URL||'');
assert.equal(url.hostname,'ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com');assert.equal(url.pathname,'/ucell_stage');assert.equal(process.env.UCELL_ENVIRONMENT,'STAGE');
const name='20261022010000_ai_stage_assistant',sql=fs.readFileSync(path.join(__dirname,'../backend/packages/database/prisma/migrations',name,'migration.sql'),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
const db=new PrismaClient();
(async()=>{try{await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ucell-ai-stage-migrate'))::text`;
 const old=await tx.$queryRaw`SELECT checksum,finished_at FROM public._prisma_migrations WHERE migration_name=${name} AND rolled_back_at IS NULL`;
 if(old.length){assert.equal(old.length,1);assert.equal(old[0].checksum,checksum);assert.ok(old[0].finished_at);return;}
 // This fixed migration has no multiline dollar-quoted bodies; each ends on one line.
 for(const statement of sql.split(/;[ \t]*\r?\n|;\s*$/).filter(s=>s.trim()))await tx.$executeRawUnsafe(statement);
 await tx.$executeRaw`INSERT INTO public._prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES(${randomUUID()},${checksum},now(),${name},now(),1)`;
 },{timeout:30000});
 const actor='51000000-0000-4000-8000-000000000001';const p=await db.person.findUnique({where:{personId:actor},select:{status:true,securityStatus:true}});assert.equal(p?.status,'EFFECTIVE');assert.equal(p?.securityStatus,'NORMAL');
 await db.$executeRaw`INSERT INTO ai.capability_grant(id,actor_id,capability,valid_to,granted_by,reason) VALUES(${randomUUID()}::uuid,${actor}::uuid,'AI_MEMBER_SELF','2026-11-22T00:00:00Z'::timestamptz,'AI_STAGE_RELEASE','Existing synthetic Stage UAT identity only') ON CONFLICT(actor_id,capability) DO NOTHING`;
 console.log(JSON.stringify({migration:name,checksum,applied:true,syntheticMemberGranted:true}));
 }finally{await db.$disconnect()}})().catch(e=>{console.error(e.code||e.name,e.meta?.code||'');process.exitCode=1});
