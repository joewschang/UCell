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
const migration87='20260926110000_g8_audit_event_core';
const migration87Sql=join(root,'packages','database','prisma','migrations',migration87,'migration.sql');
const reconciliationSql=join(root,'packages','database','prisma','recovery','migration-87-append-safe-reconciliation.sql');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname),'G8 recovery Golden permits local disposable PostgreSQL only');
const token=randomUUID().replaceAll('-',''),preName=`ucell_g8_recovery_${token}`,freshName=`ucell_g8_fresh_${token}`;
const control=new URL(base);control.pathname='/postgres';
const preUrl=new URL(base);preUrl.pathname=`/${preName}`;
const freshUrl=new URL(base);freshUrl.pathname=`/${freshName}`;
const admin=new PrismaClient({datasources:{db:{url:control.href}}});
const sandbox=mkdtempSync(join(tmpdir(),'ucell-g8-recovery-')),prePrisma=join(sandbox,'prisma');
const evidence={schemaVersion:'G8_MIGRATION_87_RECOVERY_GOLDEN_V1',migration:migration87,pre87Failure:null,ledger:null,schemaEquivalence:null,auditIntegrity:null,freshCurrent:null,cleanup:null};
function run(args,url){const r=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,DATABASE_URL:url.href},encoding:'utf8'});return {status:r.status,stdout:r.stdout??'',stderr:r.stderr??''};}
function mustPass(args,url,label){const r=run(args,url);assert.equal(r.status,0,`${label}: ${r.stderr||r.stdout}`);return r;}
function migrateDeploy(schema,url){return mustPass([require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],url,'migrate deploy');}
async function schemaSnapshot(db){
 const columns=await db.$queryRawUnsafe("SELECT column_name,data_type,udt_schema,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='audit' AND table_name='audit_event' ORDER BY ordinal_position");
 const indexes=await db.$queryRawUnsafe("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='audit' AND tablename='audit_event' ORDER BY indexname");
 const constraints=await db.$queryRawUnsafe("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='audit.audit_event'::regclass ORDER BY conname");
 const triggers=await db.$queryRawUnsafe("SELECT tgname,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='audit.audit_event'::regclass AND NOT tgisinternal ORDER BY tgname");
 const functions=await db.$queryRawUnsafe("SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='audit' AND p.proname LIKE 'ucell_audit_event_%' ORDER BY p.proname");
 return {columns,indexes,constraints,triggers,functions};
}
async function legacyRow(db){return (await db.$queryRawUnsafe("SELECT audit_event_id::text,actor_type,actor_id::text,action,entity_type,entity_id::text,before_data,after_data,reason_code,request_id,correlation_id::text,occurred_at FROM audit.audit_event WHERE request_id='G8-LEGACY-ROW'"))[0];}
let preCreated=false,freshCreated=false;
try{
 mkdirSync(prePrisma,{recursive:true});
 cpSync(join(root,'packages','database','prisma','schema.prisma'),join(prePrisma,'schema.prisma'));
 cpSync(join(root,'packages','database','prisma','migrations'),join(prePrisma,'migrations'),{recursive:true,filter:source=>!source.includes(migration87)});
 await admin.$executeRawUnsafe(`CREATE DATABASE "${preName}"`);preCreated=true;
 migrateDeploy(join(prePrisma,'schema.prisma'),preUrl);
 const pre=new PrismaClient({datasources:{db:{url:preUrl.href}}});
 try{
  await pre.$executeRawUnsafe("INSERT INTO audit.audit_event(actor_type,action,entity_type,before_data,after_data,reason_code,request_id,correlation_id) VALUES ('SYSTEM','LEGACY_AUDIT','G8Recovery','{\"legacy\":true}'::jsonb,'{\"safe\":true}'::jsonb,'LEGACY','G8-LEGACY-ROW','11111111-1111-4111-8111-111111111111')");
  const before=await legacyRow(pre);
  const fail=run([require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',currentSchema],preUrl);
  const failedLedger=await pre.$queryRawUnsafe(`SELECT migration_name,finished_at IS NULL AS unfinished,rolled_back_at IS NULL AS not_rolled_back FROM public._prisma_migrations WHERE migration_name='${migration87}' ORDER BY started_at DESC LIMIT 1`);
  evidence.pre87Failure={exitCode:fail.status,appendOnlyRejected:(fail.stderr+fail.stdout).includes('UCell append-only table audit_event does not allow UPDATE/DELETE'),failedLedger};
  assert.notEqual(fail.status,0);assert.equal(evidence.pre87Failure.appendOnlyRejected,true);assert.equal(failedLedger.length,1);assert.equal(failedLedger[0].unfinished,true);

  const rolledBack=mustPass([require.resolve('prisma/build/index.js'),'migrate','resolve','--rolled-back',migration87,'--schema',currentSchema],preUrl,'Prisma supported rollback resolve');
  const afterRollback=await pre.$queryRawUnsafe(`SELECT finished_at IS NULL AS unfinished,rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations WHERE migration_name='${migration87}' ORDER BY started_at DESC LIMIT 1`);
  mustPass([require.resolve('prisma/build/index.js'),'db','execute','--schema',currentSchema,'--file',reconciliationSql],preUrl,'append-safe schema reconciliation');
  const applied=mustPass([require.resolve('prisma/build/index.js'),'migrate','resolve','--applied',migration87,'--schema',currentSchema],preUrl,'Prisma supported applied resolve');
  migrateDeploy(currentSchema,preUrl);
  const afterApplied=await pre.$queryRawUnsafe(`SELECT finished_at IS NOT NULL AS finished,rolled_back_at IS NULL AS not_rolled_back,checksum FROM public._prisma_migrations WHERE migration_name='${migration87}' ORDER BY started_at DESC LIMIT 1`);
  evidence.ledger={rollbackResolveExitCode:rolledBack.status,appliedResolveExitCode:applied.status,afterRollback,afterApplied};
  assert.equal(afterRollback[0].rolled_back,true);assert.equal(afterApplied[0].finished,true);assert.equal(afterApplied[0].not_rolled_back,true);

  assert.deepEqual(await legacyRow(pre),before,'historical protected audit fields must remain unchanged');
  let updateBlocked=false,deleteBlocked=false;
  try{await pre.$executeRawUnsafe("UPDATE audit.audit_event SET action='MUTATED' WHERE request_id='G8-LEGACY-ROW'");}catch(error){updateBlocked=String(error).includes('append-only');}
  try{await pre.$executeRawUnsafe("DELETE FROM audit.audit_event WHERE request_id='G8-LEGACY-ROW'");}catch(error){deleteBlocked=String(error).includes('append-only');}
  const inserted=await pre.auditEvent.create({data:{actorType:'SYSTEM',action:'G8_RECOVERED_INSERT',entityType:'G8Recovery',requestId:'G8-NEW-ROW',correlationId:'33333333-3333-4333-8333-333333333333'}});
  evidence.auditIntegrity={legacyUnchanged:true,updateBlocked,deleteBlocked,newEventCode:inserted.eventCode,newTraceId:inserted.traceId};
  assert.equal(updateBlocked,true);assert.equal(deleteBlocked,true);assert.equal(inserted.eventCode,'G8_RECOVERED_INSERT');assert.equal(inserted.traceId,'33333333-3333-4333-8333-333333333333');

  await admin.$executeRawUnsafe(`CREATE DATABASE "${freshName}"`);freshCreated=true;migrateDeploy(currentSchema,freshUrl);
  const fresh=new PrismaClient({datasources:{db:{url:freshUrl.href}}});
  try{evidence.schemaEquivalence={recovered:await schemaSnapshot(pre),fresh:await schemaSnapshot(fresh)};assert.deepEqual(evidence.schemaEquivalence.recovered,evidence.schemaEquivalence.fresh,'recovered and fresh migration-87 schema/runtime catalog must match');evidence.schemaEquivalence='PASS';evidence.freshCurrent='PASS';}finally{await fresh.$disconnect();}
 }finally{await pre.$disconnect();}
 evidence.result='PASS';console.log(`G8_MIGRATION_87_RECOVERY_GOLDEN_PASS ${JSON.stringify({pre87Failure:evidence.pre87Failure,ledger:evidence.ledger,auditIntegrity:evidence.auditIntegrity,schemaEquivalence:evidence.schemaEquivalence,freshCurrent:evidence.freshCurrent})}`);
}finally{
 if(preCreated)await admin.$executeRawUnsafe(`DROP DATABASE "${preName}" WITH (FORCE)`);
 if(freshCreated)await admin.$executeRawUnsafe(`DROP DATABASE "${freshName}" WITH (FORCE)`);
 rmSync(sandbox,{recursive:true,force:true});evidence.cleanup='PASS';await admin.$disconnect();
}
