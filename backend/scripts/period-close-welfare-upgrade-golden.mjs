import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const firstNewMigration='20260930010000_period_close_welfare';
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const database='ucell_welfare_upgrade_'+randomUUID().replaceAll('-','');
assert.match(database,/^ucell_welfare_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-welfare-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});
function deploy(schema){const r=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(r.error)throw r.error;assert.equal(r.status,0);}
let created=false;
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<firstNewMigration)cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const jobs=[],receipts=[],events=[];
 for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL']){
  const id=randomUUID();
  const event=await db.outboxEvent.create({data:{eventType:'PERIOD_CLOSE_REQUESTED',aggregateType:'PERIOD_CLOSE_JOB',aggregateId:id,payload:{periodCloseJobId:id},correlationId:randomUUID(),processStatus:'PROCESSED'}});events.push(event);
  const job=await db.periodCloseJob.create({data:{periodCloseJobId:id,kind,periodStart:new Date('2020-01-01Z'),periodEnd:new Date('2020-01-08Z'),ruleVersionCode:'TEST_UPGRADE',parameterSnapshot:{historical:'unchanged'},prerequisiteIds:[],requestedBy:'TEST',approvalReference:'TEST',outboxEventId:event.outboxEventId}});jobs.push(job);
  receipts.push(await db.periodCloseReceipt.create({data:{periodCloseJobId:id,sourceId:randomUUID(),snapshotId:randomUUID()}}));
 }
 deploy(join(root,'schema.prisma'));
 for(let index=0;index<jobs.length;index++){
  assert.deepEqual(await db.periodCloseJob.findUnique({where:{periodCloseJobId:jobs[index].periodCloseJobId}}),jobs[index]);
  assert.deepEqual(await db.periodCloseReceipt.findUnique({where:{periodCloseJobId:jobs[index].periodCloseJobId}}),receipts[index]);
  assert.deepEqual(await db.outboxEvent.findUnique({where:{outboxEventId:events[index].outboxEventId}}),events[index]);
 }
 await assert.rejects(db.periodCloseJob.update({where:{periodCloseJobId:jobs[0].periodCloseJobId},data:{approvalReference:'MUTATED'}}));
 await assert.rejects(db.periodCloseReceipt.delete({where:{periodCloseJobId:jobs[0].periodCloseJobId}}));
 const id=randomUUID(),event=await db.outboxEvent.create({data:{eventType:'PERIOD_CLOSE_REQUESTED',aggregateType:'PERIOD_CLOSE_JOB',aggregateId:id,payload:{periodCloseJobId:id},correlationId:randomUUID()}});
 const {createdAt,...template}=jobs[0];
 const welfare=await db.periodCloseJob.create({data:{...template,periodCloseJobId:id,kind:'WELFARE',prerequisiteIds:[jobs[3].periodCloseJobId],outboxEventId:event.outboxEventId}});
 assert.equal(welfare.kind,'WELFARE');
 const [{count}]=await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
 console.log(`PERIOD_CLOSE_WELFARE_UPGRADE_113_TO_${count}_PRESERVATION_AND_GUARDS_PASS`);
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('PERIOD_CLOSE_WELFARE_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-welfare-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
