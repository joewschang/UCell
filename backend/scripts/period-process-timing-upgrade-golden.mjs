import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url)),{PrismaClient}=require('@prisma/client');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const database='ucell_timing_upgrade_'+randomUUID().replaceAll('-','');assert.match(database,/^ucell_timing_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-timing-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});let created=false;
function deploy(schema){const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0);}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<'20261001040000_period_job_process_timing')cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const events=[];
 for(const processStatus of ['PENDING','PROCESSING','PROCESSED','DEAD'])events.push(await db.outboxEvent.create({data:{eventType:'PERIOD_CLOSE_REQUESTED',aggregateType:'PERIOD_CLOSE_JOB',aggregateId:randomUUID(),payload:{},processStatus,createdAt:new Date('2020-01-01Z'),correlationId:randomUUID()}}));
 const person=await db.person.create({data:{legalName:'SYNTHETIC TIMING UPGRADE'}});
 deploy(join(root,'schema.prisma'));
 for(const event of events){
  assert.deepEqual(await db.outboxEvent.findUnique({where:{outboxEventId:event.outboxEventId}}),event);
  const rows=await db.periodJobProcessTransition.findMany({where:{outboxEventId:event.outboxEventId}});
  assert.equal(rows.length,1);assert.equal(rows[0].enteredAt,null);assert.equal(rows[0].toStatus,event.processStatus);
  await db.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{attemptCount:{increment:1}}});
  assert.deepEqual(await db.periodJobProcessTransition.findMany({where:{outboxEventId:event.outboxEventId}}),rows);
 }
 assert.deepEqual(await db.person.findUnique({where:{personId:person.personId}}),person);
 await db.outboxEvent.update({where:{outboxEventId:events[0].outboxEventId},data:{processStatus:'PROCESSING'}});
 const changed=await db.periodJobProcessTransition.findMany({where:{outboxEventId:events[0].outboxEventId},orderBy:{revision:'desc'}});
 assert.equal(changed.length,2);assert.equal(changed[0].revision,2);assert.ok(changed[0].enteredAt);assert.equal(changed[1].enteredAt,null);
 console.log('PERIOD_PROCESS_TIMING_124_TO_125_PRESERVATION_PASS');
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('PERIOD_PROCESS_TIMING_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-timing-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
