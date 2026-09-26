import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const root=fileURLToPath(new URL('../',import.meta.url));
const currentSchema=join(root,'packages','database','prisma','schema.prisma');
const migration87=join(root,'packages','database','prisma','migrations','20260926110000_g8_audit_event_core','migration.sql');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname),'G8 forensic runner permits local disposable PostgreSQL only');
const control=new URL(base);control.pathname='/postgres';
const suffix=randomUUID().replaceAll('-','');
const preName=`ucell_g8_pre87_${suffix}`;
const freshName=`ucell_g8_fresh_${suffix}`;
const preUrl=new URL(base);preUrl.pathname=`/${preName}`;
const freshUrl=new URL(base);freshUrl.pathname=`/${freshName}`;
const admin=new PrismaClient({datasources:{db:{url:control.href}}});
const sandbox=mkdtempSync(join(tmpdir(),'ucell-g8-pre87-'));
const prePrisma=join(sandbox,'prisma');
const evidence={schemaVersion:'G8_AUDIT_MIGRATION_FORENSICS_V1',migration:'20260926110000_g8_audit_event_core',pre87Upgrade:null,freshCurrent:null,cleanup:null};
function run(args,cwd=root,env={...process.env}){
  const result=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8'});
  return {status:result.status,stdout:result.stdout??'',stderr:result.stderr??''};
}
function migrateDeploy(schema,url){
  const result=run([require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],root,{...process.env,DATABASE_URL:url.href});
  assert.equal(result.status,0,`migrate deploy failed: ${result.stderr||result.stdout}`);
}
let preCreated=false,freshCreated=false;
try{
  mkdirSync(prePrisma,{recursive:true});
  cpSync(join(root,'packages','database','prisma','schema.prisma'),join(prePrisma,'schema.prisma'));
  cpSync(join(root,'packages','database','prisma','migrations'),join(prePrisma,'migrations'),{recursive:true,filter:source=>!source.includes('20260926110000_g8_audit_event_core')});
  await admin.$executeRawUnsafe(`CREATE DATABASE "${preName}"`);preCreated=true;
  migrateDeploy(join(prePrisma,'schema.prisma'),preUrl);
  const pre=new PrismaClient({datasources:{db:{url:preUrl.href}}});
  try{
    await pre.$executeRawUnsafe("INSERT INTO audit.audit_event(actor_type,action,entity_type,request_id,correlation_id) VALUES ('SYSTEM','LEGACY_AUDIT','MigrationForensics','REQ-G8','11111111-1111-4111-8111-111111111111')");
    const attempted=run([require.resolve('prisma/build/index.js'),'db','execute','--schema',currentSchema,'--file',migration87],root,{...process.env,DATABASE_URL:preUrl.href});
    const columns=await pre.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='audit' AND table_name='audit_event' AND column_name='event_code'");
    evidence.pre87Upgrade={
      appliedMigrations:await pre.$queryRawUnsafe('SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'),
      legacyAuditRows:await pre.$queryRawUnsafe('SELECT count(*)::int AS count FROM audit.audit_event'),
      attemptedMigration87ExitCode:attempted.status,
      rejectedByAppendOnly:(attempted.stderr+attempted.stdout).includes('UCell append-only table audit_event does not allow UPDATE/DELETE'),
      eventCodeColumnExistsAfterFailedAttempt:columns.length>0,
    };
    assert.notEqual(attempted.status,0,'migration 87 must fail against a pre-87 database containing append-only audit history');
    assert.equal(evidence.pre87Upgrade.rejectedByAppendOnly,true,'exact append-only rejection must be observed');
    assert.equal(evidence.pre87Upgrade.eventCodeColumnExistsAfterFailedAttempt,false,'failed migration must roll back its partial DDL');
  }finally{await pre.$disconnect();}

  await admin.$executeRawUnsafe(`CREATE DATABASE "${freshName}"`);freshCreated=true;
  migrateDeploy(currentSchema,freshUrl);
  const fresh=new PrismaClient({datasources:{db:{url:freshUrl.href}}});
  try{
    const migrationCount=await fresh.$queryRawUnsafe('SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    const inserted=await fresh.$queryRawUnsafe("INSERT INTO audit.audit_event(actor_type,action,entity_type,request_id,correlation_id) VALUES ('SYSTEM','G8_FORENSICS','MigrationForensics','REQ-G8-FRESH','22222222-2222-4222-8222-222222222222') RETURNING event_code,trace_id,created_at");
    let mutationBlocked=false;try{await fresh.$executeRawUnsafe("UPDATE audit.audit_event SET action='MUTATED' WHERE request_id='REQ-G8-FRESH'");}catch(error){mutationBlocked=String(error).includes('append-only');}
    evidence.freshCurrent={migrationCount,insertTriggerPopulatesEventCode:inserted[0]?.event_code==='G8_FORENSICS',insertTriggerPopulatesTrace:inserted[0]?.trace_id==='22222222-2222-4222-8222-222222222222',appendOnlyUpdateBlocked:mutationBlocked};
    assert.equal(evidence.freshCurrent.insertTriggerPopulatesEventCode,true);
    assert.equal(evidence.freshCurrent.insertTriggerPopulatesTrace,true);
    assert.equal(mutationBlocked,true);
  }finally{await fresh.$disconnect();}
  evidence.result='PASS';console.log(`G8_AUDIT_MIGRATION_FORENSICS_PASS ${JSON.stringify(evidence)}`);
}finally{
  if(preCreated)await admin.$executeRawUnsafe(`DROP DATABASE "${preName}" WITH (FORCE)`);
  if(freshCreated)await admin.$executeRawUnsafe(`DROP DATABASE "${freshName}" WITH (FORCE)`);
  rmSync(sandbox,{recursive:true,force:true});
  evidence.cleanup='PASS';await admin.$disconnect();
}
