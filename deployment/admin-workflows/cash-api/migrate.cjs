'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const name='20261113010000_formal_payout_method';
async function migration(tx,command,source){
 if(!['check','apply','trial'].includes(command))throw Error('Use check, trial, or apply');
 const sql=source.replace(/\r\n/g,'\n'),checksum=crypto.createHash('sha256').update(sql).digest('hex');
 if(command!=='check')await tx.$queryRawUnsafe('SELECT TRUE FROM (SELECT pg_advisory_xact_lock(20261113,101)) AS l');
 const journal=await tx.$queryRawUnsafe('SELECT checksum,finished_at FROM public._prisma_migrations WHERE migration_name=$1 AND rolled_back_at IS NULL',name);
 const [tables]=await tx.$queryRawUnsafe("SELECT to_regclass('identity.formal_payout_method') IS NOT NULL AS application, to_regclass('membership.holder_payout_method') IS NOT NULL AS holder");
 if(journal.length){if(journal.length!==1||!journal[0].finished_at||journal[0].checksum!==checksum||!tables.application||!tables.holder)throw Error('Migration verification failed');return {status:'applied',checksum};}
 if(tables.holder||tables.application)throw Error('Untracked payout method tables');
 if(command==='check')return {status:'pending',checksum};
 for(const statement of sql.split(';').map(v=>v.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
 await tx.$executeRawUnsafe('INSERT INTO public._prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,now(),$3,now(),1)',crypto.randomUUID(),checksum,name);
 return {status:command==='trial'?'trial':'applied',checksum};
}
module.exports={migration};
if(require.main===module){
 const db=new(require('node:module').createRequire('/app/apps/api/dist/main.js')('@ucell/database').PrismaService)(),command=process.argv[2];
 const source=fs.readFileSync(path.join(__dirname,'migration.sql'),'utf8');
 (async()=>{let result;try{await db.$transaction(async tx=>{result=await migration(tx,command,source);if(command==='trial')throw Error('ROLLBACK_TRIAL')});}catch(e){if(!(command==='trial'&&result&&e.message==='ROLLBACK_TRIAL'))throw e;}console.log(JSON.stringify(result));})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
}
